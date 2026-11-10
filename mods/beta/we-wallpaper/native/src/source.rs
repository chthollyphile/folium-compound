use napi::{Error, Result};
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::UI::Controls::WM_MOUSELEAVE;
use windows::Win32::UI::HiDpi::{SetThreadDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2};
use windows::Win32::UI::WindowsAndMessaging::*;
use windows::Win32::UI::Shell::{ITaskbarList, TaskbarList};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};

// The WE window stays visible to WGC, underneath the desktop, without activation.
pub fn parse_hwnd(value: &str) -> Result<*mut std::ffi::c_void> {
    value.parse::<usize>().map(|value| value as *mut _)
        .map_err(|error| Error::from_reason(error.to_string()))
}

pub fn find_window(title: &str) -> Option<*mut std::ffi::c_void> {
    struct Search<'a> { title: &'a str, found: Option<*mut std::ffi::c_void> }
    unsafe extern "system" fn visit(hwnd: HWND, data: LPARAM) -> BOOL {
        let search = &mut *(data.0 as *mut Search<'_>);
        let mut text = [0u16; 512];
        let length = GetWindowTextW(hwnd, &mut text);
        if length > 0 && String::from_utf16_lossy(&text[..length as usize]) == search.title {
            search.found = Some(hwnd.0);
            return BOOL(0);
        }
        BOOL(1)
    }
    let mut search = Search { title, found: None };
    unsafe { let _ = EnumWindows(Some(visit), LPARAM(&mut search as *mut _ as isize)); }
    search.found
}

pub fn place_window(raw: *mut std::ffi::c_void, x: i32, y: i32, width: i32, height: i32) -> windows::core::Result<()> {
    unsafe {
        let previous = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let hwnd = HWND(raw);
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !(WS_CAPTION.0 | WS_THICKFRAME.0 | WS_BORDER.0)) as isize);
        let extended = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        // WGC rejects windows marked TOOLWINDOW or NOACTIVATE on Windows 11 23H2.
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (extended & !(WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0)) as isize);
        let result = SetWindowPos(hwnd, Some(HWND_BOTTOM), x, y, width, height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
        SetThreadDpiAwarenessContext(previous);
        let taskbar: ITaskbarList = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)?;
        taskbar.HrInit()?;
        taskbar.DeleteTab(hwnd)?;
        result
    }
}

pub fn pointer(raw: *mut std::ffi::c_void, kind: &str, x: i32, y: i32, buttons: u32, delta: i32) -> windows::core::Result<()> {
    let message = match kind {
        "down" => WM_LBUTTONDOWN,
        "up" => WM_LBUTTONUP,
        "wheel" => WM_MOUSEWHEEL,
        "leave" => WM_MOUSELEAVE,
        _ => WM_MOUSEMOVE,
    };
    let coordinates = LPARAM(((y as u16 as u32) << 16 | x as u16 as u32) as isize);
    let flags = if buttons & 1 != 0 { 1 } else { 0 };
    let parameter = if kind == "wheel" { ((delta as u16 as usize) << 16) | flags } else { flags };
    unsafe { PostMessageW(Some(HWND(raw)), message, WPARAM(parameter), coordinates) }
}

// The input surface belongs above desktop icons and below ordinary application windows.
pub fn place_above_desktop(raw: *mut std::ffi::c_void) -> windows::core::Result<()> {
    unsafe extern "system" fn find_icons(hwnd: HWND, data: LPARAM) -> BOOL {
        use windows::core::s;
        if unsafe { FindWindowExA(Some(hwnd), None, s!("SHELLDLL_DefView"), None) }.is_ok() {
            unsafe { *(data.0 as *mut HWND) = hwnd; }
            return BOOL(0);
        }
        BOOL(1)
    }
    unsafe {
        let mut icons = HWND::default();
        let _ = EnumWindows(Some(find_icons), LPARAM(&mut icons as *mut HWND as isize));
        if icons.0.is_null() { return Err(windows::core::Error::new(windows::core::HRESULT(0x80004005u32 as i32), "Desktop icon window not found")); }
        let hwnd = HWND(raw);
        let previous = GetWindow(icons, GW_HWNDPREV).unwrap_or(HWND_TOP);
        if previous == hwnd { return Ok(()); }
        let after = if GetWindowLongPtrW(previous, GWL_EXSTYLE) as u32 & WS_EX_TOPMOST.0 != 0 { HWND_TOP } else { previous };
        SetWindowPos(hwnd, Some(after), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
    }
}

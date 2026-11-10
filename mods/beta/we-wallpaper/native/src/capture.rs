use super::{Command, FrameCallback, FramePacket};
use napi::bindgen_prelude::Buffer;
use napi::threadsafe_function::ThreadsafeFunctionCallMode;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc::{Receiver, Sender, SyncSender}, Arc};
use std::time::{Duration, Instant};
use windows::core::{factory, Interface, PCWSTR};
use windows::Foundation::TypedEventHandler;
use windows::Graphics::Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem};
use windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use windows::Graphics::DirectX::DirectXPixelFormat;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HMODULE, HWND, WAIT_OBJECT_0};
use windows::Win32::Graphics::Direct3D::{D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_UNKNOWN};
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::*;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
use windows::Win32::System::Threading::{CreateEventW, WaitForSingleObject};
use windows::Win32::System::WinRT::Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;

// Three leased textures bound both GPU memory and in-flight renderer work.
struct Slot {
    texture: ID3D11Texture2D,
    handle: HANDLE,
    width: u32,
    height: u32,
    lease: u32,
}

impl Drop for Slot {
    fn drop(&mut self) { unsafe { let _ = CloseHandle(self.handle); } }
}

struct Apartment;
impl Drop for Apartment {
    fn drop(&mut self) { unsafe { CoUninitialize(); } }
}

struct Gpu {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    fence: ID3D11Fence,
    context4: ID3D11DeviceContext4,
    event: HANDLE,
    sequence: u64,
}

impl Drop for Gpu {
    fn drop(&mut self) { unsafe { let _ = CloseHandle(self.event); } }
}

impl Gpu {
    fn new(vendor: u32, device_id: u32) -> windows::core::Result<Self> {
        unsafe {
            let factory: IDXGIFactory1 = CreateDXGIFactory1()?;
            let mut adapter = None;
            let mut index = 0;
            while let Ok(candidate) = factory.EnumAdapters1(index) {
                let description = candidate.GetDesc1()?;
                if description.VendorId == vendor && description.DeviceId == device_id {
                    adapter = Some(candidate.cast::<IDXGIAdapter>()?);
                    break;
                }
                index += 1;
            }
            let driver = if adapter.is_some() { D3D_DRIVER_TYPE_UNKNOWN } else { D3D_DRIVER_TYPE_HARDWARE };
            let mut device = None;
            let mut context = None;
            D3D11CreateDevice(adapter.as_ref(), driver, HMODULE::default(), D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                None, D3D11_SDK_VERSION, Some(&mut device), None, Some(&mut context))?;
            let device = device.unwrap();
            let context = context.unwrap();
            let device5: ID3D11Device5 = device.cast()?;
            let mut fence = None;
            device5.CreateFence(0, D3D11_FENCE_FLAG_NONE, &mut fence)?;
            let fence = fence.unwrap();
            let context4 = context.cast()?;
            let event = CreateEventW(None, false, false, None)?;
            Ok(Self { device, context, fence, context4, event, sequence: 0 })
        }
    }

    fn slot(&self, width: u32, height: u32) -> windows::core::Result<Slot> {
        let description = D3D11_TEXTURE2D_DESC {
            Width: width, Height: height, MipLevels: 1, ArraySize: 1,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: (D3D11_BIND_SHADER_RESOURCE.0 | D3D11_BIND_RENDER_TARGET.0) as u32,
            CPUAccessFlags: 0,
            MiscFlags: (D3D11_RESOURCE_MISC_SHARED_NTHANDLE.0 | D3D11_RESOURCE_MISC_SHARED.0) as u32,
        };
        unsafe {
            let mut texture = None;
            self.device.CreateTexture2D(&description, None, Some(&mut texture))?;
            let texture = texture.unwrap();
            let resource: IDXGIResource1 = texture.cast()?;
            let handle = resource.CreateSharedHandle(None, DXGI_SHARED_RESOURCE_READ.0 | DXGI_SHARED_RESOURCE_WRITE.0, PCWSTR::null())?;
            Ok(Slot { texture, handle, width, height, lease: 0 })
        }
    }

    fn copy(&mut self, target: &ID3D11Texture2D, source: &ID3D11Texture2D) -> windows::core::Result<()> {
        unsafe {
            self.context.CopyResource(target, source);
            self.sequence += 1;
            self.context4.Signal(&self.fence, self.sequence)?;
            self.fence.SetEventOnCompletion(self.sequence, self.event)?;
            self.context.Flush();
            if WaitForSingleObject(self.event, 2000) != WAIT_OBJECT_0 {
                return Err(windows::core::Error::new(windows::core::HRESULT(0x800705B4u32 as i32), "GPU copy timed out"));
            }
        }
        Ok(())
    }
}

pub fn run(hwnd: usize, fps: u32, vendor: u32, device_id: u32, sender: Sender<Command>, receiver: Receiver<Command>,
    started: &SyncSender<Result<(), String>>, callback: &FrameCallback) -> windows::core::Result<()> {
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()?; }
    let _apartment = Apartment;
    let mut gpu = Gpu::new(vendor, device_id)?;
    let dxgi: IDXGIDevice = gpu.device.cast()?;
    let direct_device: IDirect3DDevice = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi)?.cast()? };
    let interop: IGraphicsCaptureItemInterop = factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
    let item: GraphicsCaptureItem = unsafe { interop.CreateForWindow(HWND(hwnd as *mut _))? };
    let mut size = item.Size()?;
    let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(&direct_device, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size)?;
    let session = pool.CreateCaptureSession(&item)?;
    session.SetIsCursorCaptureEnabled(false)?;
    let pending = Arc::new(AtomicBool::new(false));
    let frame_pending = pending.clone();
    let frame_sender = sender.clone();
    let frame_token = pool.FrameArrived(&TypedEventHandler::new(move |_, _| {
        if !frame_pending.swap(true, Ordering::AcqRel) { let _ = frame_sender.send(Command::Frame); }
        Ok(())
    }))?;
    let close_token = item.Closed(&TypedEventHandler::new(move |_, _| { let _ = sender.send(Command::SourceClosed); Ok(()) }))?;
    session.StartCapture()?;
    let _ = started.send(Ok(()));
    let mut slots: Vec<Slot> = Vec::new();
    let interval = Duration::from_secs_f64(1.0 / fps.max(1) as f64);
    let mut next_frame = Instant::now();
    let mut lease = 0u32;
    let result = (|| -> windows::core::Result<()> {
        while let Ok(command) = receiver.recv() {
            match command {
                Command::Stop => break,
                Command::SourceClosed => return Err(windows::core::Error::new(windows::core::HRESULT(0x80000013u32 as i32), "Wallpaper Engine source window closed")),
                Command::Release(id) => {
                    if let Some(slot) = slots.iter_mut().find(|slot| slot.lease == id) { slot.lease = 0; }
                }
                Command::Frame => {
                    pending.store(false, Ordering::Release);
                    let mut latest = pool.TryGetNextFrame().ok();
                    while let Ok(next) = pool.TryGetNextFrame() {
                        if let Some(previous) = latest.replace(next) { previous.Close()?; }
                    }
                    let Some(frame) = latest else { continue };
                    let next_size = frame.ContentSize()?;
                    if next_size.Width != size.Width || next_size.Height != size.Height {
                        frame.Close()?;
                        size = next_size;
                        pool.Recreate(&direct_device, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size)?;
                        continue;
                    }
                    let frame_time = Instant::now();
                    if frame_time < next_frame || size.Width <= 0 || size.Height <= 0 { frame.Close()?; continue; }
                    let free = slots.iter().position(|slot| slot.lease == 0);
                    let index = match free {
                        Some(index) => index,
                        None if slots.len() < 3 => {
                            slots.push(gpu.slot(size.Width as u32, size.Height as u32)?);
                            slots.len() - 1
                        }
                        None => { frame.Close()?; continue; }
                    };
                    if slots[index].width != size.Width as u32 || slots[index].height != size.Height as u32 {
                        slots[index] = gpu.slot(size.Width as u32, size.Height as u32)?;
                    }
                    let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
                    let source: ID3D11Texture2D = unsafe { access.GetInterface()? };
                    gpu.copy(&slots[index].texture, &source)?;
                    frame.Close()?;
                    lease = lease.wrapping_add(1).max(1);
                    let slot = &mut slots[index];
                    slot.lease = lease;
                    let packet = FramePacket {
                        frame_id: lease, width: slot.width, height: slot.height,
                        handle: Buffer::from((slot.handle.0 as usize).to_ne_bytes().to_vec()),
                    };
                    if callback.call(Ok(packet), ThreadsafeFunctionCallMode::NonBlocking) != napi::Status::Ok { slot.lease = 0; }
                    next_frame += interval;
                    if next_frame < frame_time { next_frame = frame_time + interval; }
                }
            }
        }
        Ok(())
    })();
    let _ = pool.RemoveFrameArrived(frame_token);
    let _ = item.RemoveClosed(close_token);
    let _ = session.Close();
    let _ = pool.Close();
    result
}

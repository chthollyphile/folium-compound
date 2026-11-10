use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction};
use napi_derive::napi;
use std::sync::mpsc::{self, Sender};
use std::thread::JoinHandle;

mod capture;
mod source;

// Texture leases end only after Electron has finished using the GPU resource.
#[napi(object)]
pub struct FramePacket {
    pub frame_id: u32,
    pub width: u32,
    pub height: u32,
    pub handle: Buffer,
}

pub type FrameCallback = ThreadsafeFunction<FramePacket, ErrorStrategy::CalleeHandled>;

pub enum Command {
    Frame,
    Release(u32),
    Stop,
    SourceClosed,
}

#[napi]
pub struct Capture {
    sender: Sender<Command>,
    worker: Option<JoinHandle<()>>,
}

pub struct CreateCapture {
    hwnd: usize,
    fps: u32,
    vendor_id: u32,
    device_id: u32,
    callback: Option<FrameCallback>,
}

impl Task for CreateCapture {
    type Output = Capture;
    type JsValue = Capture;

    fn compute(&mut self) -> Result<Capture> {
        let hwnd = self.hwnd;
        let fps = self.fps;
        let vendor_id = self.vendor_id;
        let device_id = self.device_id;
        let callback = self.callback.take().unwrap();
        let (sender, receiver) = mpsc::channel();
        let (started, ready) = mpsc::sync_channel(1);
        let frame_sender = sender.clone();
        let worker = std::thread::Builder::new().name("folia-we-capture".into()).spawn(move || {
            if let Err(error) = capture::run(hwnd, fps, vendor_id, device_id, frame_sender, receiver, &started, &callback) {
                let message = error.to_string();
                if started.send(Err(message.clone())).is_err() {
                    callback.call(Err(Error::from_reason(message)), ThreadsafeFunctionCallMode::NonBlocking);
                }
            }
        }).map_err(|error| Error::from_reason(error.to_string()))?;
        let initialized = match ready.recv() {
            Ok(result) => result.map_err(Error::from_reason),
            Err(error) => Err(Error::from_reason(error.to_string())),
        };
        if let Err(error) = initialized {
            let _ = sender.send(Command::Stop);
            let _ = worker.join();
            return Err(error);
        }
        Ok(Capture { sender, worker: Some(worker) })
    }

    fn resolve(&mut self, _env: Env, capture: Capture) -> Result<Capture> {
        Ok(capture)
    }
}

pub struct StopCapture {
    worker: Option<JoinHandle<()>>,
}

impl Task for StopCapture {
    type Output = ();
    type JsValue = ();

    fn compute(&mut self) -> Result<()> {
        if let Some(worker) = self.worker.take() {
            worker.join().map_err(|_| Error::from_reason("Capture worker panicked"))?;
        }
        Ok(())
    }

    fn resolve(&mut self, _env: Env, _output: ()) -> Result<()> {
        Ok(())
    }
}

#[napi]
impl Capture {
    #[napi]
    pub fn create(env: Env, hwnd: String, fps: u32, vendor_id: u32, device_id: u32, callback: JsFunction) -> Result<AsyncTask<CreateCapture>> {
        let hwnd = source::parse_hwnd(&hwnd)? as usize;
        let mut callback: FrameCallback = callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        callback.unref(&env)?;
        Ok(AsyncTask::new(CreateCapture { hwnd, fps, vendor_id, device_id, callback: Some(callback) }))
    }

    #[napi]
    pub fn release(&self, frame_id: u32) {
        let _ = self.sender.send(Command::Release(frame_id));
    }

    #[napi]
    pub fn stop(&mut self) -> AsyncTask<StopCapture> {
        let _ = self.sender.send(Command::Stop);
        AsyncTask::new(StopCapture { worker: self.worker.take() })
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        // Finalization can run on Electron's main thread; the worker owns its resources.
        let _ = self.sender.send(Command::Stop);
    }
}

#[napi]
pub fn find_window(title: String) -> Option<String> {
    source::find_window(&title).map(|hwnd| (hwnd as usize).to_string())
}

#[napi]
pub fn place_window(hwnd: String, x: i32, y: i32, width: i32, height: i32) -> Result<()> {
    source::place_window(source::parse_hwnd(&hwnd)?, x, y, width, height)
        .map_err(|error| Error::from_reason(error.to_string()))
}

#[napi]
pub fn pointer(hwnd: String, kind: String, x: i32, y: i32, buttons: u32, delta: i32) -> Result<()> {
    source::pointer(source::parse_hwnd(&hwnd)?, &kind, x, y, buttons, delta)
        .map_err(|error| Error::from_reason(error.to_string()))
}

#[napi]
pub fn place_above_desktop(hwnd: String) -> Result<()> {
    source::place_above_desktop(source::parse_hwnd(&hwnd)?)
        .map_err(|error| Error::from_reason(error.to_string()))
}

"""
內建於 Folium 模組內的 Python 麥克風即時辨識 Worker（透過 stdin/stdout NDJSON 與 index.cjs 通訊）
依賴：pip install shazamio sounddevice numpy
"""

import asyncio
from collections import deque
import io
import json
import math
import sys
import threading
import time
import wave
from aiohttp_retry import ExponentialRetry
import numpy as np
import sounddevice as sd
from shazamio import HTTPClient, Serialize, Shazam

SAMPLE_RATE = 44100
WINDOW_SEC = 12.0               # ShazamIO 0.9+ 建議的 12 秒最佳辨識視窗
DEFAULT_POLL_INTERVAL_SEC = 30.0  # 預設每 30 秒辨識一次，大幅降低 429 限流風險
MIN_POLL_INTERVAL_SEC = 5.0
MAX_POLL_INTERVAL_SEC = 300.0
POLL_INTERVAL_SEC = DEFAULT_POLL_INTERVAL_SEC
RECOGNIZE_TIMEOUT = 15.0
MIN_RMS = 0.0008
MAX_SKEW = 0.02


def clamp_poll_interval(value: object) -> float:
    """將辨識間隔秒數限制在安全範圍內，無效值則回傳預設 30 秒。"""
    if isinstance(value, bool):
        return DEFAULT_POLL_INTERVAL_SEC
    try:
        sec = float(value)
    except (TypeError, ValueError):
        return DEFAULT_POLL_INTERVAL_SEC
    if not math.isfinite(sec):
        return DEFAULT_POLL_INTERVAL_SEC
    return max(MIN_POLL_INTERVAL_SEC, min(MAX_POLL_INTERVAL_SEC, sec))


def emit(obj: dict) -> None:
    try:
        sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except OSError:
        pass


def emit_log(level: str, text: str) -> None:
    emit({"type": "log", "level": level, "text": text})


def _resolve_default_input_index(hostapis: list[dict] | tuple[dict, ...]) -> int | None:
    """安全取得系統預設麥克風裝置索引。"""
    try:
        default_dev = getattr(sd.default, "device", None)
        if isinstance(default_dev, (list, tuple)) and len(default_dev) >= 1:
            candidate = default_dev[0]
        else:
            candidate = default_dev
        if candidate is not None and not isinstance(candidate, bool):
            idx = int(candidate)
            if idx >= 0:
                return idx
    except (TypeError, ValueError):
        pass

    for api in hostapis:
        try:
            idx = int(api.get("default_input_device", -1))
            if idx >= 0:
                return idx
        except (TypeError, ValueError, AttributeError):
            continue
    return None


def _refresh_portaudio() -> None:
    """安全重新初始化 PortAudio 裝置列表。"""
    try:
        if hasattr(sd, "_terminate") and hasattr(sd, "_initialize"):
            sd._terminate()
            sd._initialize()
    except Exception:
        pass


def _hostapi_priority(api_name: str) -> int:
    """為備援裝置排序 HostAPI 優先順序（避開 Windows MME error 11）。"""
    lowered = api_name.lower()
    if "wasapi" in lowered:
        return 0
    if "directsound" in lowered:
        return 1
    if "mme" in lowered:
        return 2
    if "wdm-ks" in lowered:
        return 3
    return 4


def list_input_devices(refresh: bool = False) -> list[dict]:
    """列舉目前可用的麥克風輸入裝置清單。"""
    if refresh:
        _refresh_portaudio()

    try:
        devices = sd.query_devices()
        hostapis = list(sd.query_hostapis() or [])
    except Exception as exc:
        emit_log("ERROR", f"掃描麥克風裝置失敗：{exc}")
        return []

    default_in = _resolve_default_input_index(hostapis)
    result = []
    for idx, dev in enumerate(devices):
        try:
            if int(dev.get("max_input_channels", 0) or 0) <= 0:
                continue
            raw_name = str(dev.get("name") or f"Device {idx}").strip()
            hostapi_idx = dev.get("hostapi")
            api_name = ""
            if isinstance(hostapi_idx, int) and 0 <= hostapi_idx < len(hostapis):
                api_name = str(hostapis[hostapi_idx].get("name") or "").strip()
            display_name = f"{raw_name} ({api_name})" if api_name else raw_name
            result.append(
                {
                    "id": idx,
                    "raw_name": raw_name,
                    "hostapi": api_name,
                    "name": display_name,
                    "is_default": default_in is not None and idx == default_in,
                }
            )
        except Exception:
            continue
    return result


class WorkerEngine:
    def __init__(self) -> None:
        self.device_id: int | None = None
        self.samplerate = SAMPLE_RATE
        self.stream_latency = 0.0
        self.max_samples = int(self.samplerate * (WINDOW_SEC + 2))
        self._lock = threading.Lock()
        self._chunks: deque[np.ndarray] = deque()
        self._total_samples = 0
        self.stream: sd.InputStream | None = None
        self.latest_peak = 0.0
        self.latest_rms = 0.0
        self.sync_active = False
        self.recognition_paused = False
        self.poll_interval_sec = DEFAULT_POLL_INTERVAL_SEC
        self.test_active = False
        self.should_quit = False
        self._wake_event: asyncio.Event | None = None

    def ensure_wake_event(self) -> asyncio.Event:
        if self._wake_event is None:
            self._wake_event = asyncio.Event()
        return self._wake_event

    def wake(self) -> None:
        if self._wake_event is not None:
            self._wake_event.set()

    def clear_audio_buffer(self) -> None:
        with self._lock:
            self._chunks.clear()
            self._total_samples = 0

    def set_poll_interval(self, value: object) -> float:
        self.poll_interval_sec = clamp_poll_interval(value)
        emit_log("INFO", f"辨識間隔已設定為 {self.poll_interval_sec:.0f} 秒（下一輪生效）")
        return self.poll_interval_sec

    def set_recognition_paused(self, paused: bool) -> None:
        target = bool(paused)
        if self.recognition_paused == target:
            return
        self.recognition_paused = target
        self.clear_audio_buffer()
        if target:
            emit_log("INFO", "歌曲播放中，已暫停重複辨識（將於播畢後自動繼續）")
        else:
            emit_log("INFO", "恢復麥克風辨識，開始收集下一首音訊...")
        self.wake()

    def _audio_callback(self, indata: np.ndarray, frames: int, _time_info, status) -> None:
        mono = indata[:, 0].copy() if indata.ndim > 1 else indata.copy()
        n = len(mono)
        if n == 0:
            return
        self.latest_peak = float(np.max(np.abs(mono)))
        self.latest_rms = float(np.sqrt(np.mean(mono * mono)))

        if self.sync_active and not self.recognition_paused:
            with self._lock:
                self._chunks.append(mono)
                self._total_samples += n
                while self._total_samples > self.max_samples and self._chunks:
                    dropped = self._chunks.popleft()
                    self._total_samples -= len(dropped)

    @staticmethod
    def _build_stream_candidates(target_device_id: int | None) -> list[dict]:
        """建立麥克風輸入串流的裝置與參數備援清單。"""
        try:
            devices = list(sd.query_devices() or [])
        except Exception:
            devices = []
        try:
            hostapis = list(sd.query_hostapis() or [])
        except Exception:
            hostapis = []

        def api_name_for(dev: dict) -> str:
            idx = dev.get("hostapi")
            if isinstance(idx, int) and 0 <= idx < len(hostapis):
                return str(hostapis[idx].get("name") or "").strip()
            return ""

        candidates: list[dict] = []
        seen_ids: set[int | None] = set()

        def add_candidate(dev_id: int | None, dev_info: dict | None, fallback: bool = False) -> None:
            if dev_id in seen_ids:
                return
            seen_ids.add(dev_id)
            info = dev_info if isinstance(dev_info, dict) else {}
            max_ch = int(info.get("max_input_channels", 1) or 1)
            default_sr = int(info.get("default_samplerate") or SAMPLE_RATE)
            name = str(info.get("name") or (f"Device {dev_id}" if dev_id is not None else "預設麥克風")).strip()
            api = api_name_for(info)
            channels_list = [1] + ([min(2, max_ch)] if max_ch >= 2 else [])
            rates_list: list[int] = []
            for sr in (default_sr, 48000, SAMPLE_RATE, 16000):
                if sr > 0 and sr not in rates_list:
                    rates_list.append(sr)
            candidates.append(
                {
                    "device_id": dev_id,
                    "name": f"{name} ({api})" if api else name,
                    "raw_name": name,
                    "channels_list": channels_list,
                    "rates_list": rates_list,
                    "fallback": fallback,
                }
            )

        primary_id = target_device_id if target_device_id is not None else _resolve_default_input_index(hostapis)
        primary_info: dict | None = None
        if primary_id is not None and 0 <= primary_id < len(devices):
            primary_info = devices[primary_id]
            add_candidate(primary_id, primary_info, fallback=False)
        else:
            try:
                queried = sd.query_devices(target_device_id, kind="input")
                if isinstance(queried, dict):
                    primary_info = queried
            except Exception:
                primary_info = None
            add_candidate(target_device_id, primary_info, fallback=False)

        primary_raw_name = str(primary_info.get("name") or "").strip().lower() if isinstance(primary_info, dict) else ""

        other_inputs: list[tuple[int, int, dict]] = []
        for idx, dev in enumerate(devices):
            try:
                if int(dev.get("max_input_channels", 0) or 0) <= 0:
                    continue
                other_inputs.append((_hostapi_priority(api_name_for(dev)), idx, dev))
            except Exception:
                continue
        other_inputs.sort(key=lambda item: (item[0], item[1]))

        if primary_raw_name:
            for _, idx, dev in other_inputs:
                if str(dev.get("name") or "").strip().lower() == primary_raw_name:
                    add_candidate(idx, dev, fallback=True)

        if target_device_id is None:
            for _, idx, dev in other_inputs:
                add_candidate(idx, dev, fallback=True)

        return candidates

    def _try_open_stream(self, candidates: list[dict]) -> tuple[object, dict, int] | tuple[None, None, Exception | None]:
        """依序嘗試開啟麥克風串流，失敗時安全關閉暫存物件並記錄最後錯誤。"""
        last_exc: Exception | None = None
        for cand in candidates:
            for channels in cand["channels_list"]:
                for samplerate in cand["rates_list"]:
                    stream = None
                    try:
                        stream = sd.InputStream(
                            device=cand["device_id"],
                            channels=channels,
                            samplerate=samplerate,
                            dtype="float32",
                            callback=self._audio_callback,
                        )
                        stream.start()
                        return stream, cand, samplerate
                    except Exception as exc:
                        last_exc = exc
                        if stream is not None:
                            try:
                                stream.close()
                            except Exception:
                                pass
        return None, None, last_exc

    def ensure_stream(self) -> None:
        if self.stream is not None:
            return
        with self._lock:
            self._chunks.clear()
            self._total_samples = 0

        candidates = self._build_stream_candidates(self.device_id)
        stream, chosen, samplerate = self._try_open_stream(candidates)
        if stream is None:
            _refresh_portaudio()
            candidates = self._build_stream_candidates(self.device_id)
            stream, chosen, samplerate = self._try_open_stream(candidates)

        if stream is None or chosen is None:
            last_err = samplerate
            raise RuntimeError(f"無法開啟麥克風輸入串流（請確認系統隱私權已允許麥克風存取，或於設定中改選其他麥克風裝置）：{last_err}")

        self.stream = stream
        self.samplerate = int(samplerate)
        self.max_samples = int(self.samplerate * (WINDOW_SEC + 2))
        self.stream_latency = float(getattr(self.stream, "latency", 0.0) or 0.0)
        fallback_note = "（已自動切換相容驅動）" if chosen.get("fallback") else ""
        emit_log(
            "INFO",
            f"麥克風已開啟{fallback_note}：[{chosen['device_id']}] {chosen['name']} ({self.samplerate}Hz, 緩衝延遲={self.stream_latency*1000:.0f}ms)",
        )

    def stop_stream_if_idle(self) -> None:
        if not self.sync_active and not self.test_active and self.stream is not None:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
            emit_log("INFO", "麥克風串流已暫停")

    def select_mic(self, device_id: int | None) -> None:
        self.device_id = device_id
        if self.stream is not None:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
        if self.sync_active or self.test_active:
            self.ensure_stream()

    def snapshot_wav(self) -> tuple[bytes, float, float, float, float] | None:
        with self._lock:
            if self._total_samples < int(self.samplerate * 4.5):
                return None
            merged = np.concatenate(list(self._chunks))
            snapshot_mono = time.monotonic()

        needed = int(self.samplerate * WINDOW_SEC)
        samples = merged[-needed:].copy() if len(merged) > needed else merged
        duration = len(samples) / self.samplerate

        samples -= float(np.mean(samples))
        rms = float(np.sqrt(np.mean(samples * samples)))
        peak = float(np.max(np.abs(samples)))
        peak_db = 20.0 * math.log10(max(peak, 1e-6))

        if rms < MIN_RMS:
            return b"", duration, rms, peak_db, snapshot_mono

        gain = min(25.0, 0.88 / max(peak, 1e-6))
        pcm16 = (np.clip(samples * gain, -1.0, 1.0) * 32767.0).astype(np.int16)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.samplerate)
            wf.writeframes(pcm16.tobytes())
        return buf.getvalue(), duration, rms, peak_db, snapshot_mono


async def level_loop(engine: WorkerEngine) -> None:
    while not engine.should_quit:
        if engine.test_active and engine.stream is not None:
            emit({"type": "level", "peak": round(engine.latest_peak, 4), "rms": round(engine.latest_rms, 4)})
        await asyncio.sleep(0.15)


async def interruptible_sleep(engine: WorkerEngine, seconds: float) -> None:
    """可被控制指令即時中斷的等待，避免調整設定或停止時卡在長間隔 sleep。"""
    if seconds <= 0 or engine.should_quit:
        return
    wake_event = engine.ensure_wake_event()
    wake_event.clear()
    try:
        await asyncio.wait_for(wake_event.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        pass
    finally:
        wake_event.clear()


async def recognition_loop(engine: WorkerEngine) -> None:
    round_id = 0
    # 不在底層靜默重試 429，讓 RateLimited 立刻浮出以便記錄並冷卻
    client = HTTPClient(
        retry_options=ExponentialRetry(
            attempts=2,
            start_timeout=1.0,
            max_timeout=3.0,
            statuses={500, 502, 503, 504},
        )
    )
    async with Shazam(http_client=client) as shazam:
        while not engine.should_quit:
            if not engine.sync_active or engine.recognition_paused:
                await interruptible_sleep(engine, 0.3)
                continue

            snap = engine.snapshot_wav()
            if snap is None:
                await interruptible_sleep(engine, 1.0)
                continue

            round_id += 1
            wav_bytes, duration, rms, peak_db, snapshot_mono = snap
            if not wav_bytes:
                emit_log("INFO", f"#{round_id} 環境安靜 (RMS={rms:.5f}, Peak={peak_db:.1f}dBFS)，等待音樂中...")
                await interruptible_sleep(engine, engine.poll_interval_sec)
                continue

            emit_log("INFO", f"#{round_id} 開始辨識 | 時長={duration:.1f}s, RMS={rms:.4f}, Peak={peak_db:.1f}dBFS")
            t0 = time.perf_counter()
            try:
                raw_out = await asyncio.wait_for(shazam.recognize(wav_bytes), timeout=RECOGNIZE_TIMEOUT)
                serialized = Serialize.full_track(raw_out)
            except asyncio.TimeoutError:
                emit_log("WARN", f"#{round_id} ShazamIO 網路請求逾時（>{RECOGNIZE_TIMEOUT}s，請檢查網路或代理設定）")
                await interruptible_sleep(engine, engine.poll_interval_sec)
                continue
            except Exception as exc:
                err_name = type(exc).__name__
                if "RateLimited" in err_name or "429" in str(exc):
                    cooldown = max(20.0, engine.poll_interval_sec)
                    emit_log("WARN", f"#{round_id} 觸發 Shazam 429 限流，自動冷卻 {cooldown:.0f} 秒後再試...")
                    await interruptible_sleep(engine, cooldown)
                else:
                    emit_log("ERROR", f"#{round_id} 辨識錯誤 ({err_name})：{exc}")
                    await interruptible_sleep(engine, engine.poll_interval_sec)
                continue

            elapsed_ms = (time.perf_counter() - t0) * 1000
            track = serialized.track
            matches = serialized.matches or []

            if not track or not matches:
                emit_log("INFO", f"#{round_id} 未比對到歌曲 | 耗時={elapsed_ms:.0f}ms, retry_ms={serialized.retry_ms}")
                await interruptible_sleep(engine, engine.poll_interval_sec)
                continue

            best = matches[0]
            t_skew = float(best.time_skew or 0.0)
            f_skew = float(best.frequency_skew or 0.0)
            if abs(t_skew) > MAX_SKEW or abs(f_skew) > MAX_SKEW:
                emit_log("WARN", f"#{round_id} 忽略高偏差匹配 (time_skew={t_skew:.4f}, freq_skew={f_skew:.4f})")
                await interruptible_sleep(engine, engine.poll_interval_sec)
                continue

            offset_sec = float(best.offset or 0.0)
            live_pos = offset_sec + duration + (time.monotonic() - snapshot_mono) + engine.stream_latency
            title = track.title or ""
            artist = track.subtitle or ""

            emit_log(
                "INFO",
                f"#{round_id} 辨識成功 | {title} - {artist} | 現場進度={live_pos:.2f}s | "
                f"耗時={elapsed_ms:.0f}ms, skew=({t_skew:.4f}, {f_skew:.4f})",
            )
            emit(
                {
                    "type": "state",
                    "ok": True,
                    "title": title,
                    "artist": artist,
                    "position_sec": round(live_pos, 3),
                    "updated_at_ms": int(time.time() * 1000),
                    "elapsed_ms": round(elapsed_ms),
                }
            )
            await interruptible_sleep(engine, engine.poll_interval_sec)


def stdin_reader(loop: asyncio.AbstractEventLoop, engine: WorkerEngine) -> None:
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except Exception:
            continue

        def handle(m=msg):
            cmd = m.get("cmd")
            try:
                if cmd == "list_mics":
                    devices = list_input_devices(refresh=(engine.stream is None))
                    emit({"type": "mics", "current_device_id": engine.device_id, "devices": devices})
                elif cmd == "select_mic":
                    engine.select_mic(m.get("device_id"))
                elif cmd == "set_test":
                    engine.test_active = bool(m.get("enabled"))
                    if engine.test_active:
                        engine.ensure_stream()
                    else:
                        engine.stop_stream_if_idle()
                elif cmd == "start_sync":
                    if "poll_interval_sec" in m:
                        engine.poll_interval_sec = clamp_poll_interval(m.get("poll_interval_sec"))
                    engine.sync_active = True
                    engine.recognition_paused = False
                    engine.clear_audio_buffer()
                    engine.ensure_stream()
                    engine.wake()
                    emit_log("INFO", f"開始收集麥克風滑動視窗音訊（辨識間隔 {engine.poll_interval_sec:.0f} 秒）...")
                elif cmd == "stop_sync":
                    engine.sync_active = False
                    engine.recognition_paused = False
                    engine.clear_audio_buffer()
                    engine.stop_stream_if_idle()
                    engine.wake()
                elif cmd == "set_poll_interval":
                    engine.set_poll_interval(m.get("seconds"))
                elif cmd == "pause_recognition":
                    if engine.sync_active:
                        engine.set_recognition_paused(True)
                elif cmd == "resume_recognition":
                    if engine.sync_active:
                        engine.set_recognition_paused(False)
                elif cmd == "quit":
                    engine.should_quit = True
                    engine.sync_active = False
                    engine.recognition_paused = False
                    engine.test_active = False
                    engine.stop_stream_if_idle()
                    engine.wake()
            except Exception as exc:
                if cmd == "start_sync":
                    engine.sync_active = False
                    engine.recognition_paused = False
                    engine.clear_audio_buffer()
                    engine.wake()
                elif cmd == "set_test":
                    engine.test_active = False
                    engine.wake()
                emit_log("ERROR", f"處理指令 {cmd} 失敗：{exc}")

        loop.call_soon_threadsafe(handle)


async def main() -> None:
    engine = WorkerEngine()
    engine.ensure_wake_event()
    loop = asyncio.get_running_loop()
    emit({"type": "mics", "current_device_id": engine.device_id, "devices": list_input_devices()})
    threading.Thread(target=stdin_reader, args=(loop, engine), daemon=True).start()
    await asyncio.gather(recognition_loop(engine), level_loop(engine))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

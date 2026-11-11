// mods/lizi-imessage-504/beat.mjs
// A small onset detector for the voice-message waveform. It watches the rise
// of the low end (spectral flux when the host exposes a spectrum, otherwise the
// bass band), compares it with its own recent mean and deviation, and reports a
// beat at most every MIN_GAP seconds. Silence still gets a filler beat every
// MAX_GAP seconds so the waveform does not freeze in quiet passages.

const LOW_BIN_START = 1;
const LOW_BIN_END = 12;
const TRACK_SEC = 1.2;
const MIN_GAP_SEC = 0.28;
const MAX_GAP_SEC = 2;
const FLOOR = 0.012;

export const createBeatDetector = () => {
  let previousBins = null;
  let previousLow = 0;
  let mean = 0;
  let variance = 0;
  let lastBeat = -Infinity;

  const lowFlux = (audio) => {
    const spectrum = audio.getSpectrum();
    if (spectrum && spectrum.length > LOW_BIN_END) {
      const count = LOW_BIN_END - LOW_BIN_START + 1;
      if (!previousBins) previousBins = new Float32Array(count);
      let flux = 0;
      for (let i = 0; i < count; i += 1) {
        const value = spectrum[LOW_BIN_START + i] / 255;
        flux += Math.max(0, value - previousBins[i]);
        previousBins[i] = value;
      }
      return flux / count;
    }
    const bands = audio.getBands();
    const low = 0.7 * bands.bass + 0.3 * bands.lowMid;
    const flux = Math.max(0, low - previousLow);
    previousLow = low;
    return flux;
  };

  return {
    reset() {
      previousBins = null;
      previousLow = 0;
      mean = 0;
      variance = 0;
      lastBeat = -Infinity;
    },

    /**
     * Feeds one reading at song time `time` (dt seconds after the previous
     * one). `sensitivity` above 1 lowers the threshold. Returns true on a beat.
     */
    step(audio, time, dt, sensitivity = 1) {
      const flux = audio ? lowFlux(audio) : 0;
      const alpha = 1 - Math.exp(-Math.max(dt, 0) / TRACK_SEC);
      const deviation = Math.sqrt(Math.max(variance, 0));
      const threshold = Math.max(FLOOR, mean + (1.8 / Math.max(sensitivity, 0.1)) * deviation);
      const sinceLast = time - lastBeat;
      const onset = flux > threshold && sinceLast >= MIN_GAP_SEC;
      mean += alpha * (flux - mean);
      variance += alpha * ((flux - mean) ** 2 - variance);
      if (onset || sinceLast >= MAX_GAP_SEC) {
        lastBeat = time;
        return true;
      }
      return false;
    },
  };
};

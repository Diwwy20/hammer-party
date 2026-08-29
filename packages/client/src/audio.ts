/**
 * Tiny synthesized SFX (Phase 04 juice). No asset files — everything is generated
 * with the WebAudio API, so it works offline on the event LAN. The AudioContext is
 * created lazily and resumed on demand (browsers require a user gesture first; the
 * first sound is always driven by a tap/click, so it unlocks fine).
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One enveloped oscillator blip, optionally sliding in pitch. */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.14,
  slideTo?: number,
) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

/** A burst of filtered noise — the only thing that reads as an explosion or rain. */
function noise(dur: number, gain: number, startFreq: number, endFreq: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(startFreq, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

export const sfx = {
  swing: () => tone(340, 0.12, "triangle", 0.07, 560),
  hit: () => tone(170, 0.14, "square", 0.12, 80),
  /** a meteor landing: a low thud under a decaying crack of noise */
  boom: () => {
    tone(90, 0.45, "sine", 0.18, 34);
    noise(0.4, 0.16, 1800, 120);
  },
  pickup: () => {
    tone(660, 0.09, "sine", 0.12);
    window.setTimeout(() => tone(880, 0.1, "sine", 0.12), 80);
  },
  die: () => tone(300, 0.5, "sawtooth", 0.14, 70),
  prank: () => tone(900, 0.12, "square", 0.1, 480),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      window.setTimeout(() => tone(f, 0.24, "triangle", 0.14), i * 130),
    );
  },
};

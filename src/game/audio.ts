let ctx: AudioContext | null = null;
let muted = false;
let musicTimer: number | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;

function ensure() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new Ctx({ latencyHint: "interactive" });
  master = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.gain.value = 0.35;
  sfxBus.gain.value = 0.7;
  musicBus.connect(master);
  sfxBus.connect(master);
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const ac = ensure();
  if (ac.state === "suspended") void ac.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.02);
}

function beep(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number) {
  if (!ctx || !sfxBus || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur: number, gain: number) {
  if (!ctx || !sfxBus || muted) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  src.buffer = buf;
  f.type = "bandpass";
  f.frequency.value = 900;
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start();
}

export const sfx = {
  punch() { beep(220, 0.07, "square", 0.05, 90); noise(0.05, 0.06); },
  kick() { beep(120, 0.1, "sawtooth", 0.07, 50); noise(0.07, 0.08); },
  special() { beep(420, 0.18, "sawtooth", 0.07, 90); beep(840, 0.14, "square", 0.04, 160); },
  bite() {
    beep(80, 0.16, "sawtooth", 0.12, 36); noise(0.14, 0.2);
    window.setTimeout(() => { beep(55, 0.16, "square", 0.12, 28); noise(0.12, 0.18); }, 70);
  },
  hit() { noise(0.09, 0.16); beep(180, 0.08, "triangle", 0.06, 70); },
  block() { beep(700, 0.06, "square", 0.04, 300); },
  ko() { beep(160, 0.4, "sawtooth", 0.08, 40); },
  win() {
    beep(523, 0.12, "square", 0.05);
    window.setTimeout(() => beep(659, 0.12, "square", 0.05), 120);
    window.setTimeout(() => beep(784, 0.22, "square", 0.06), 240);
  },
  ui() { beep(660, 0.06, "square", 0.04); },
};

function pulse() {
  if (!ctx || !musicBus || muted) return;
  const notes = [98, 98, 116, 87];
  const n = notes[Math.floor(Date.now() / 480) % notes.length]!;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = n;
  g.gain.value = 0.04;
  o.connect(g);
  g.connect(musicBus);
  o.start(t);
  o.stop(t + 0.22);
}

export function startMusic() {
  unlockAudio();
  if (musicTimer != null) return;
  pulse();
  musicTimer = window.setInterval(pulse, 480);
}

export function stopMusic() {
  if (musicTimer != null) { clearInterval(musicTimer); musicTimer = null; }
}

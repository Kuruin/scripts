// Generates the launch video's background track: public/music/dockside-bed.wav
// A calm bed at 100 BPM: warm chord pads, a soft plucked arpeggio, and a light
// kick + shaker that come in after the intro. Deterministic, no samples, so the
// track is ours to use anywhere. Run: node scripts/make-music.mjs
import fs from "node:fs";
import path from "node:path";

const SR = 44100;
const SECONDS = 36.2;          // the video is 1076 frames at 30fps (35.9s)
const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.floor(SR * SECONDS);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Deterministic noise.
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

// Cmaj9 → Am9 → Fmaj7#11 → G6sus: bright but unhurried.
const CHORDS = [
  [48, 55, 59, 62, 64],
  [45, 52, 55, 59, 64],
  [41, 48, 52, 57, 59],
  [43, 50, 55, 57, 62],
];
const ARP = [
  [72, 76, 79, 83, 79, 76, 74, 76],
  [69, 72, 76, 79, 76, 72, 71, 72],
  [69, 72, 76, 77, 76, 72, 71, 72],
  [67, 71, 74, 76, 74, 71, 69, 71],
];

function add(buf, start, data, gain) {
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < data.length && s0 + i < N; i++) if (s0 + i >= 0) buf[s0 + i] += data[i] * gain;
}

// Pad: detuned sines and a soft triangle, slow attack and release.
function pad(freq, dur, detune) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  const att = 1.2, rel = 1.4;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / att) * Math.min(1, (dur - t) / rel);
    const f = freq * (1 + detune);
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
    out[i] = env * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.25 * tri + 0.15 * Math.sin(2 * Math.PI * f * 2 * t));
  }
  return out;
}

// Pluck: triangle with a quick exponential decay and a little brightness on the attack.
function pluck(freq, dur = 0.9) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 5.5);
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
    out[i] = env * (0.8 * tri + 0.2 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 18));
  }
  return out;
}

// Kick: a short pitched-down sine thump.
function kick() {
  const n = Math.floor(0.35 * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 48 + 90 * Math.exp(-t * 32);
    phase += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t * 9);
  }
  return out;
}

// Shaker: high-passed noise burst.
function shaker() {
  const n = Math.floor(0.09 * SR);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rnd();
    const hp = x - prev;   // crude high-pass
    prev = x;
    out[i] = hp * Math.exp(-t * 45) * 0.5;
  }
  return out;
}

const bars = Math.ceil(SECONDS / BAR);
const K = kick();
for (let b = 0; b < bars; b++) {
  const t0 = b * BAR;
  const ch = CHORDS[b % 4];
  // Pads, slightly wider in the stereo field.
  ch.forEach((m, j) => {
    add(L, t0, pad(midi(m), BAR + 1.2, -0.0025 * (j % 2 ? 1 : -1)), 0.05);
    add(R, t0, pad(midi(m), BAR + 1.2, 0.0025 * (j % 2 ? 1 : -1)), 0.05);
  });
  // Bass: root note, held.
  add(L, t0, pad(midi(ch[0] - 12), BAR, 0), 0.07);
  add(R, t0, pad(midi(ch[0] - 12), BAR, 0), 0.07);
  // Arpeggio from bar 2, eighth notes, gently panned.
  if (b >= 1) {
    ARP[b % 4].forEach((m, k) => {
      const at = t0 + k * (BEAT / 2);
      const p = pluck(midi(m));
      const pan = k % 2 ? 0.65 : 0.35;
      add(L, at, p, 0.075 * (1 - pan) * 2);
      add(R, at, p, 0.075 * pan * 2);
    });
  }
  // Kick on 1 and 3, shaker on the off-beats, from bar 3 until the last bar.
  if (b >= 2 && b < bars - 1) {
    for (const q of [0, 2]) {
      add(L, t0 + q * BEAT, K, 0.22);
      add(R, t0 + q * BEAT, K, 0.22);
    }
    for (let q = 0; q < 8; q++) {
      if (q % 2 === 0) continue;
      const s = shaker();
      add(L, t0 + q * (BEAT / 2), s, 0.05);
      add(R, t0 + q * (BEAT / 2), s, 0.06);
    }
  }
}

// Fade in and out, then normalise to a calm level.
const fadeIn = 1.0 * SR, fadeOut = 3.0 * SR;
let peak = 0;
for (let i = 0; i < N; i++) {
  const g = Math.min(1, i / fadeIn) * Math.min(1, (N - i) / fadeOut);
  L[i] *= g;
  R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.7 / peak;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-1, Math.min(1, L[i] * norm)) * 32767, i * 4);
  data.writeInt16LE(Math.max(-1, Math.min(1, R[i] * norm)) * 32767, i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const out = path.join(process.cwd(), "public", "music", "dockside-bed.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`wrote ${out} (${SECONDS}s, peak normalised)`);

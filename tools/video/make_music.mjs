// Original ambient score for the Lumen film, synthesized in code (no samples, no licensing):
// warm detuned pad over a D-major progression, a soft pluck pulse under the demo, risers into the reveal and
// the zoom, low impacts on the logo hits, and a near-silent drop for "One more thing".
//   node tools/video/make_music.mjs <out.wav> <durationSec> <json timings>
import fs from "node:fs";

const [out, durS, timingJson] = process.argv.slice(2);
const T = JSON.parse(timingJson); // { reveal, zoom, demo0, omt, logo1, logo2, end }
const SR = 48000, N = Math.ceil(Number(durS) * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// Chords (MIDI), 8 s each: Dmaj9 · Bm9 · Gmaj7(#11) · Asus2
const CHORDS = [[50, 57, 62, 66, 69, 76], [47, 54, 59, 62, 66, 73], [43, 50, 55, 59, 66, 73], [45, 52, 57, 59, 64, 71]];
const BAR = 8;
function pad(t0, t1, notes, gain) {
  const a = Math.floor(t0 * SR), b = Math.min(N, Math.floor(t1 * SR));
  for (const m of notes) for (const det of [-0.07, 0.07]) {
    const f = hz(m) * (1 + det / 100), pan = det < 0 ? 0.35 : 0.65;
    let ph = Math.random() * 6.28;
    for (let i = a; i < b; i++) {
      const t = (i - a) / SR, len = (b - a) / SR;
      const env = Math.min(1, t / 2.2) * Math.min(1, (len - t) / 2.4);
      ph += (2 * Math.PI * f) / SR;
      const s = (Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * env * gain * (0.85 + 0.15 * Math.sin(t * 0.7 + m));
      L[i] += s * (1 - pan); R[i] += s * pan;
    }
  }
}
function pluck(t, m, gain, pan = 0.5) {
  const a = Math.floor(t * SR), len = Math.floor(1.4 * SR), f = hz(m);
  for (let i = 0; i < len && a + i < N; i++) {
    const tt = i / SR, env = Math.exp(-tt * 4.2) * Math.min(1, tt * 300);
    const s = (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt * 9)) * env * gain;
    L[a + i] += s * (1 - pan); R[a + i] += s * pan;
  }
}
function riser(t1, len, gain) {
  const a = Math.floor((t1 - len) * SR), b = Math.floor(t1 * SR);
  let lp = 0, lpR = 0;
  for (let i = Math.max(0, a); i < b && i < N; i++) {
    const k = (i - a) / (b - a), c = 0.01 + 0.25 * k * k;
    lp += (rnd() - lp) * c; lpR += (rnd() - lpR) * c;
    const env = k * k * gain;
    L[i] += lp * env; R[i] += lpR * env;
  }
}
function impact(t, gain) {
  const a = Math.floor(t * SR), len = Math.floor(2.6 * SR);
  for (let i = 0; i < len && a + i < N; i++) {
    const tt = i / SR, f = 46 + 40 * Math.exp(-tt * 7);
    const s = Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 1.6) * gain + rnd() * Math.exp(-tt * 18) * gain * 0.25;
    L[a + i] += s; R[a + i] += s;
  }
}

const dur = Number(durS);
// Pad bed across the film (quiet under the problem, fuller from the reveal on).
for (let t = 0, c = 0; t < dur; t += BAR, c++) {
  const g = t < T.reveal - 1 ? 0.010 : 0.014;
  pad(t, Math.min(dur, t + BAR + 1.5), CHORDS[c % 4], g);
}
// Pulse: soft eighth-note plucks from the zoom to the end of the demo, rests around "One more thing".
const ARP = [[62, 69, 74, 69], [59, 66, 71, 66], [55, 62, 67, 62], [57, 64, 69, 64]];
for (let t = T.zoom; t < T.demoEnd; t += 0.375) {
  if (t > T.omt - 0.4 && t < T.omt + 2.2) continue;
  const c = Math.floor(t / BAR) % 4, i = Math.round(t / 0.375) % 4;
  pluck(t, ARP[c][i], 0.020, i % 2 ? 0.35 : 0.65);
}
riser(T.logo1, 2.2, 0.05); impact(T.logo1, 0.22);
riser(T.reveal + 2.0, 2.0, 0.04);
riser(T.zoom + 2.1, 2.2, 0.05); impact(T.zoom + 2.1, 0.12);
impact(T.omt, 0.14);
riser(T.logo2, 2.4, 0.05); impact(T.logo2, 0.24);

// "One more thing": dip the bed to near silence, then swell back.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = 1;
  if (t > T.omt - 0.5 && t < T.omt + 3) g = Math.max(0.12, Math.min(1, Math.abs(t - (T.omt + 1.2)) / 1.7));
  const fade = Math.min(1, t / 1.5) * Math.min(1, (dur - t) / 2.5);
  L[i] *= g * fade; R[i] *= g * fade;
}
// Gentle stereo widening + soft clip, then 16-bit WAV.
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const l = Math.tanh(L[i] * 2.2) * 0.9, r = Math.tanh(R[i] * 2.2) * 0.9;
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log("wrote", out);

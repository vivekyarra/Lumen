/**
 * Lumen's sound cues, generated from code so every engine plays the same sounds.
 * tools/gen-audio.ts renders them to WAV for Lens Studio; the web preview renders them to AudioBuffers.
 * All short and soft: peak amplitude ≤ 0.4.
 */
export type CueId = "tick" | "markers" | "red" | "green" | "confirm" | "alarm" | "resolved";

export const CUE_IDS: CueId[] = ["tick", "markers", "red", "green", "confirm", "alarm", "resolved"];

export const SAMPLE_RATE = 44100;
export const PEAK = 0.4;

interface Note {
  start: number; // s
  dur: number; // s
  freq: number; // Hz (start)
  freqEnd?: number; // Hz (glide target)
  gain: number;
  attack: number;
  decay: number; // exponential decay time constant
  harmonics?: number[]; // relative gains of 2nd, 3rd… partials
}

const CUES: { [K in CueId]: { length: number; notes: Note[] } } = {
  tick: { length: 0.06, notes: [{ start: 0, dur: 0.05, freq: 2200, gain: 0.6, attack: 0.001, decay: 0.008 }] },
  markers: {
    length: 0.32,
    notes: [
      { start: 0, dur: 0.14, freq: 660, gain: 0.5, attack: 0.006, decay: 0.08, harmonics: [0.15] },
      { start: 0.12, dur: 0.2, freq: 880, gain: 0.5, attack: 0.006, decay: 0.1, harmonics: [0.15] },
    ],
  },
  red: {
    length: 0.42,
    notes: [
      { start: 0, dur: 0.16, freq: 196, gain: 0.9, attack: 0.008, decay: 0.07, harmonics: [0.35, 0.12] },
      { start: 0.2, dur: 0.2, freq: 185, gain: 0.9, attack: 0.008, decay: 0.08, harmonics: [0.35, 0.12] },
    ],
  },
  green: { length: 0.3, notes: [{ start: 0, dur: 0.28, freq: 988, gain: 0.55, attack: 0.005, decay: 0.1, harmonics: [0.1] }] },
  confirm: {
    length: 0.9,
    notes: [
      { start: 0, dur: 0.85, freq: 523.25, gain: 0.4, attack: 0.01, decay: 0.35, harmonics: [0.2, 0.05] },
      { start: 0.06, dur: 0.8, freq: 659.25, gain: 0.35, attack: 0.01, decay: 0.32, harmonics: [0.2] },
      { start: 0.12, dur: 0.75, freq: 783.99, gain: 0.35, attack: 0.01, decay: 0.3, harmonics: [0.2] },
    ],
  },
  alarm: {
    length: 0.5,
    notes: [
      { start: 0, dur: 0.2, freq: 880, gain: 0.7, attack: 0.005, decay: 1, harmonics: [0.25] },
      { start: 0.24, dur: 0.2, freq: 660, gain: 0.7, attack: 0.005, decay: 1, harmonics: [0.25] },
    ],
  },
  resolved: {
    length: 0.34,
    notes: [{ start: 0, dur: 0.32, freq: 880, freqEnd: 440, gain: 0.6, attack: 0.005, decay: 0.15, harmonics: [0.1] }],
  },
};

/** Renders a cue to mono float samples in −PEAK..PEAK. */
export function renderCue(id: CueId, sampleRate?: number): Float32Array {
  const sr = sampleRate || SAMPLE_RATE;
  const cue = CUES[id];
  const n = Math.ceil(cue.length * sr);
  const out = new Float32Array(n);
  for (let k = 0; k < cue.notes.length; k++) {
    const note = cue.notes[k];
    const s0 = Math.floor(note.start * sr);
    const len = Math.floor(note.dur * sr);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / sr;
      const f = note.freqEnd ? note.freq + (note.freqEnd - note.freq) * (t / note.dur) : note.freq;
      phase += (2 * Math.PI * f) / sr;
      const attack = Math.min(1, t / note.attack);
      const release = Math.min(1, (note.dur - t) / 0.01); // 10 ms tail, no clicks
      const env = attack * Math.exp(-t / note.decay) * Math.max(0, release);
      let v = Math.sin(phase);
      if (note.harmonics) {
        for (let h = 0; h < note.harmonics.length; h++) v += note.harmonics[h] * Math.sin(phase * (h + 2));
      }
      out[s0 + i] += v * env * note.gain;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) {
    const g = PEAK / peak;
    for (let i = 0; i < n; i++) out[i] *= g;
  }
  return out;
}

export function cueDuration(id: CueId): number {
  return CUES[id].length;
}

/** 16-bit PCM mono WAV bytes. */
export function encodeWav(samples: Float32Array, sampleRate?: number): Uint8Array {
  const sr = sampleRate || SAMPLE_RATE;
  const bytes = new Uint8Array(44 + samples.length * 2);
  const dv = new DataView(bytes.buffer);
  const str = function (o: number, s: string): void {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  dv.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return bytes;
}

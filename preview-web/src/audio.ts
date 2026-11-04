// Spatial sound cues with WebAudio HRTF panners, using the shared synth.
import * as THREE from "three";
import { CUE_IDS, CueId, renderCue } from "../../Assets/Lumen/Core/SoundGen";

export class SpatialAudio {
  private ctx: AudioContext | null = null;
  private buffers = new Map<CueId, AudioBuffer>();
  private lastPlayed = new Map<CueId, number>();
  muted = false;
  /** Every cue played, with its stereo pan as heard from the camera (for the recorded demo's soundtrack). */
  readonly cueLog: { id: CueId; t: number; pan: number; gain: number }[] = [];
  private camera: THREE.Camera | null = null;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    for (const id of CUE_IDS) {
      const data = renderCue(id, this.ctx.sampleRate);
      const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      buf.copyToChannel(new Float32Array(data), 0);
      this.buffers.set(id, buf);
    }
  }

  updateListener(camera: THREE.Camera): void {
    this.camera = camera;
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = new THREE.Vector3();
    const f = new THREE.Vector3();
    camera.getWorldPosition(p);
    camera.getWorldDirection(f);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    // Positions in metres for the panner's distance model.
    if (l.positionX) {
      l.positionX.value = p.x / 100;
      l.positionY.value = p.y / 100;
      l.positionZ.value = p.z / 100;
      l.forwardX.value = f.x;
      l.forwardY.value = f.y;
      l.forwardZ.value = f.z;
      l.upX.value = u.x;
      l.upY.value = u.y;
      l.upZ.value = u.z;
    }
  }

  /** Records the cue (for tests) and plays it from `at` if audio is unlocked. */
  play(id: CueId, at: THREE.Vector3, now: number): void {
    this.lastPlayed.set(id, now);
    if (this.camera) {
      const local = at.clone().applyMatrix4(this.camera.matrixWorldInverse);
      const dist = Math.max(30, local.length());
      this.cueLog.push({ id: id, t: now, pan: Math.max(-1, Math.min(1, local.x / dist)), gain: Math.min(1, 100 / dist) });
    }
    if (!this.ctx || this.muted) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const pan = this.ctx.createPanner();
    pan.panningModel = "HRTF";
    pan.distanceModel = "inverse";
    pan.refDistance = 1;
    pan.positionX.value = at.x / 100;
    pan.positionY.value = at.y / 100;
    pan.positionZ.value = at.z / 100;
    src.connect(pan).connect(this.ctx.destination);
    src.start();
  }

  lastPlayedAt(id: CueId): number | null {
    const t = this.lastPlayed.get(id);
    return t === undefined ? null : t;
  }

  reset(): void {
    this.lastPlayed.clear();
    this.cueLog.length = 0;
  }
}

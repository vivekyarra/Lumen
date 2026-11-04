import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../../Assets/Lumen/Core/MeshGen";
import { v3 } from "../../Assets/Lumen/Core/Vec";
import { CUE_IDS, PEAK, SAMPLE_RATE, cueDuration, encodeWav, renderCue } from "../../Assets/Lumen/Core/SoundGen";
import { LINE_LAYOUT, CURVE_SAMPLES_PER_SEGMENT, GLOW_RADIUS } from "../../Assets/Lumen/Core/LumenLayout";
import { sampleCurve } from "../../Assets/Lumen/Core/Curves";

function valid(m: M.MeshData, name: string) {
  const n = M.vertexCount(m);
  assert.equal(m.normals.length, n * 3, name + " normals");
  assert.equal(m.uvs.length, n * 2, name + " uvs");
  assert.equal(m.indices.length % 3, 0, name + " triangles");
  for (const i of m.indices) assert.ok(i >= 0 && i < n, name + " index range");
  for (const x of [...m.positions, ...m.normals, ...m.uvs]) assert.ok(Number.isFinite(x), name + " finite");
  for (let i = 0; i < m.normals.length; i += 3) {
    const l = Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]);
    assert.ok(Math.abs(l - 1) < 1e-6, name + " unit normals");
  }
  assert.ok(n < 65536, name + " fits 16-bit indices");
}

/** Every triangle's geometric normal should face +z (toward the viewer) for billboard shapes. */
function facesViewer(m: M.MeshData): boolean {
  const p = m.positions;
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i] * 3, m.indices[i + 1] * 3, m.indices[i + 2] * 3];
    const z = (p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a]);
    if (z <= 0) return false;
  }
  return true;
}

test("closed meshes wind outward with the right volume", () => {
  const b = M.box(v3(10, 20, 30), v3(2, 3, 4));
  valid(b, "box");
  assert.ok(Math.abs(M.signedVolume(b) - 24) < 1e-9);
  const s = M.sphere(v3(0, 0, 0), 5, 24, 32);
  valid(s, "sphere");
  assert.ok(Math.abs(M.signedVolume(s) - (4 / 3) * Math.PI * 125) / ((4 / 3) * Math.PI * 125) < 0.02);
  const c = M.cylinder(v3(0, 0, 0), v3(0, 0, 10), 2, 32);
  valid(c, "cylinder");
  assert.ok(Math.abs(M.signedVolume(c) - Math.PI * 4 * 10) / (Math.PI * 40) < 0.02);
  const e = M.ellipsoid(v3(1, 2, 3), v3(2, 3, 4), 24, 32);
  valid(e, "ellipsoid");
  assert.ok(Math.abs(M.signedVolume(e) - (4 / 3) * Math.PI * 24) / ((4 / 3) * Math.PI * 24) < 0.02);
});

test("IV line tubes are valid, unclipped by 16-bit indices, and wind outward", () => {
  for (const l of [1, 2, 3, 4] as const) {
    const pts = sampleCurve(LINE_LAYOUT[l].control, CURVE_SAMPLES_PER_SEGMENT).points;
    const t = M.tube(pts, GLOW_RADIUS, 10, true);
    valid(t, "tube " + l);
    assert.ok(M.signedVolume(t) > 0, "tube " + l + " winds outward");
  }
});

test("billboard shapes face the viewer", () => {
  for (const [name, m] of Object.entries({
    ring: M.ringXY(4, 0.5, 48), disc: M.discXY(1, 24), check: M.checkXY(2, 0.4), cross: M.crossXY(2, 0.4),
    chevron: M.chevronXY(4, 0.6), outline: M.rectOutlineXY(9, 4, 0.3), rect: M.rectXY(9, 4),
  })) {
    valid(m, name);
    assert.ok(facesViewer(m), name + " faces +z");
  }
  const ring = M.ringXY(4, 0.5, 48);
  let maxR = 0;
  for (let i = 0; i < ring.positions.length; i += 3) maxR = Math.max(maxR, Math.hypot(ring.positions[i], ring.positions[i + 1]));
  assert.ok(Math.abs(maxR - 2) < 1e-9, "ring is 4 cm across");
});

test("merge keeps indices pointing at the right vertices", () => {
  const a = M.box(v3(0, 0, 0), v3(1, 1, 1));
  const b = M.box(v3(5, 0, 0), v3(1, 1, 1));
  const m = M.merge([a, b]);
  valid(m, "merged");
  assert.ok(Math.abs(M.signedVolume(m) - 2) < 1e-9);
});

test("sound cues are short, soft and click-free", () => {
  for (const id of CUE_IDS) {
    const s = renderCue(id);
    assert.equal(s.length, Math.ceil(cueDuration(id) * SAMPLE_RATE));
    let peak = 0;
    for (const x of s) { assert.ok(Number.isFinite(x)); peak = Math.max(peak, Math.abs(x)); }
    assert.ok(Math.abs(peak - PEAK) < 1e-6, id + " normalised to the soft peak");
    assert.ok(cueDuration(id) <= 1, id + " is short");
    assert.ok(Math.abs(s[s.length - 1]) < 0.01, id + " ends at silence");
  }
  assert.ok(cueDuration("alarm") < 1.2, "alarm beep fits its 1.2 s repeat");
});

test("committed WAV files match the synth (regenerate with npm run gen:audio)", () => {
  for (const id of CUE_IDS) {
    const onDisk = readFileSync(`Assets/Lumen/Audio/lumen_${id}.wav`);
    const fresh = encodeWav(renderCue(id));
    assert.equal(onDisk.length, fresh.length, id);
    assert.ok(Buffer.from(fresh).equals(onDisk), id + " bytes");
    assert.equal(onDisk.toString("ascii", 0, 4), "RIFF");
    assert.equal(onDisk.readUInt32LE(24), SAMPLE_RATE);
  }
});

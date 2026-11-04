// Static checks on the Lens Studio sources (they can't run outside Lens Studio).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = "Assets/Lumen/Lens";
const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
const src = (f: string) => readFileSync(`${dir}/${f}`, "utf8");

test("every component named in spec §9.2 exists", () => {
  for (const name of ["LumenLens", "PortMarker", "LineTracer", "SyringeTray", "PushButton", "RedirectArrow", "AlarmController", "EdgeArrow", "AudioCues", "SceneBuilder", "LumenSelfTest"]) {
    assert.ok(files.includes(`${name}.ts`), name);
  }
});

test("Lens code holds no sample data (one data file rule)", () => {
  const drugWords = /Midazolam|Dobutamine|Heparin|Furosemide|Morphine|mL\/h|mcg\/kg/;
  for (const f of files) assert.ok(!drugWords.test(src(f)), `${f} must read data from Core/LumenData`);
});

test("no optional chaining / nullish coalescing in Lens Studio sources (older JS engines)", () => {
  for (const f of [...files.map((f) => `${dir}/${f}`), ...readdirSync("Assets/Lumen/Core").filter((f) => f.endsWith(".ts")).map((f) => `Assets/Lumen/Core/${f}`)]) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/\?\.[a-zA-Z_(]/.test(s), `${f} uses ?.`);
    assert.ok(!/\?\?/.test(s), `${f} uses ??`);
  }
});

test("Core is engine-agnostic (no Lens Studio or DOM globals)", () => {
  for (const f of readdirSync("Assets/Lumen/Core")) {
    const s = readFileSync(`Assets/Lumen/Core/${f}`, "utf8");
    assert.ok(!/\b(SceneObject|vec3|global\.scene|document\.|window\.)/.test(s), f);
  }
});

test("only LumenLens is a @component (one thing to add to the scene)", () => {
  const comps = files.filter((f) => /^@component/m.test(src(f)));
  assert.deepEqual(comps, ["LumenLens.ts"]);
});

test("the debug alarm trigger is never on screen: no text or mesh mentions it", () => {
  for (const f of files) assert.ok(!/setText\([^)]*[Dd]ebug/.test(src(f)), f);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { HEX, darkPaletteEntries, luminance } from "../../Assets/Lumen/Lens/Palette";

test("DC8: no dark colours in the Lens palette (additive display: black is invisible)", () => {
  assert.equal(darkPaletteEntries(), 0);
  for (const [k, v] of Object.entries(HEX)) assert.ok(luminance(v) >= 0.3, k);
});

test("state colours are the spec's exact hex values", () => {
  assert.equal(HEX.cyan, 0x3fe0ff);
  assert.equal(HEX.green, 0x3dff7a);
  assert.equal(HEX.red, 0xff4d4d);
  assert.equal(HEX.amber, 0xffb020);
});

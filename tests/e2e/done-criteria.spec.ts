// DC1–DC8 in the rendered web preview: the shared scenarios run with a SceneProbe, so they check
// what is actually drawn (visibility, text, screen-space overlaps in the SPECS FOV, distances, colours).
import { test, expect } from "./fixtures";

const IDS = ["DC1", "DC2", "DC3", "DC4", "DC5", "DC6", "DC7", "DC8"];

for (const id of IDS) {
  test(`${id} passes in the rendered preview`, async ({ lens }) => {
    const [r] = await lens.evaluate((only) => (window as any).lumen.runScenarios([only]), id);
    expect(r.error).toBeNull();
    expect(r.pass).toBe(true);
  });
}

test("DC8 extra: hub labels stay readable from a few steps left and right", async ({ lens }) => {
  for (const dr of [-30, 0, 30]) {
    const bad = await lens.evaluate((dr) => {
      const l = (window as any).lumen;
      l.reset();
      l.driver.pinchSyringe("S1");
      l.step(0.4);
      const out: string[] = [];
      for (const p of ["B", "C", "A"]) {
        l.driver.pinchPort(p);
        l.setPose(0, 0, { r: dr, f: 0, u: 165 });
        l.lookAt && null;
        const eye = { r: dr, f: 0, u: 165 };
        // look at the hub from the shifted position
        const t = { r: -27, f: 56, u: 88 };
        const yaw = (Math.atan2(t.r - eye.r, t.f - eye.f) * 180) / Math.PI;
        const pitch = (Math.atan2(t.u - eye.u, Math.hypot(t.r - eye.r, t.f - eye.f)) * 180) / Math.PI;
        l.setPose(yaw, pitch, eye);
        out.push(...l.probe.overlappingLabels().map((x: string) => `${dr}/${p}: ${x}`));
      }
      return out;
    }, dr);
    expect(bad).toEqual([]);
  }
});

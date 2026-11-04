// Ruthless input: random clicks all over the screen, random head poses, time jumps, resets.
import { test, expect } from "./fixtures";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test("600 random clicks / poses / waits never break an invariant or throw", async ({ lens }) => {
  const r = rng(42);
  for (let i = 0; i < 600; i++) {
    const k = r();
    if (k < 0.55) {
      await lens.mouse.click(Math.floor(r() * 1280), Math.floor(r() * 800));
    } else if (k < 0.7) {
      await lens.evaluate(([y, p]) => (window as any).lumen.setPose(y, p), [-80 + r() * 120, -70 + r() * 70]);
    } else if (k < 0.8) {
      await lens.evaluate(() => (window as any).lumen.probe.lookAtHub());
    } else if (k < 0.85) {
      await lens.evaluate(() => (window as any).lumen.probe.lookAtCart());
    } else if (k < 0.97) {
      await lens.evaluate((dt) => (window as any).lumen.step(dt), r() < 0.8 ? r() * 0.6 : r() * 9);
    } else {
      await lens.evaluate(() => (window as any).lumen.driver.triggerAlarm());
    }
    const bad = await lens.evaluate(() => (window as any).lumen.invariants());
    expect(bad, `step ${i}`).toEqual([]);
  }
});

test("targeted clicks on real targets in random order keep the scene consistent with the state", async ({ lens }) => {
  const r = rng(7);
  const targets = ["syringe.S1", "syringe.S2", "port.A", "port.B", "port.C", "port.D", "push", "resolved", "pole"];
  for (let i = 0; i < 160; i++) {
    const t = targets[Math.floor(r() * targets.length)];
    await lens.evaluate((t) => {
      const l = (window as any).lumen;
      if (t.startsWith("syringe")) l.probe.lookAtCart();
      else if (t === "port.D") l.lookAt({ r: 15, f: 95, u: 80 });
      else if (t === "resolved") l.lookAt({ r: -4, f: 22.5, u: 102 });
      else if (t === "pole") l.lookAt({ r: -70, f: 100, u: 160 });
      else l.probe.lookAtHub();
    }, t);
    const p = await lens.evaluate((t) => (window as any).lumen.screenPoint(t), t);
    if (p) await lens.mouse.click(p.x, p.y);
    if (r() < 0.3) await lens.evaluate((dt) => (window as any).lumen.step(dt), r() * 3);
    const res = await lens.evaluate(() => {
      const l = (window as any).lumen;
      const v = l.view();
      const pr = l.probe;
      const issues: string[] = [...l.invariants()];
      if (pr.visible("button.push") !== (v.pushButtonPort !== null)) issues.push("push visibility");
      if (pr.visible("button.resolved") !== (v.alarm !== null)) issues.push("resolved visibility");
      if (pr.visible("redirect.arrow") !== (v.redirect !== null)) issues.push("arrow visibility");
      for (const p of ["A", "B", "C", "D"]) {
        if (pr.text("port." + p) !== v.ports[p].label) issues.push("label " + p);
        const ring = v.ports[p].marker !== "idle" && v.ports[p].opacity > 0.001;
        if (pr.visible("port.ring", p) !== ring) issues.push("ring " + p);
      }
      for (const l2 of ["1", "2", "3", "4"]) if (pr.visible("line.glow", l2) !== (v.glowLine === Number(l2))) issues.push("glow " + l2);
      if (pr.darkContentCount() !== 0) issues.push("dark content");
      return issues;
    });
    expect(res, `step ${i} (${t})`).toEqual([]);
  }
});

test("50 resets do not leak scene objects", async ({ lens }) => {
  const n0 = await lens.evaluate(() => (window as any).lumen.sceneObjectCount());
  for (let i = 0; i < 50; i++) {
    await lens.evaluate(() => {
      const l = (window as any).lumen;
      l.driver.pinchSyringe("S1"); l.driver.pinchPort("B"); l.driver.pinchPort("A"); l.driver.pinchPush(); l.step(5); l.reset();
    });
  }
  const n1 = await lens.evaluate(() => (window as any).lumen.sceneObjectCount());
  expect(n1).toBeLessThanOrEqual(n0 + 3);
});

test("live (real-time) mode runs the alarm on its own clock", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).lumen);
  await page.evaluate(() => { const l = (window as any).lumen; l.driver.pinchSyringe("S1"); l.driver.pinchPort("A"); l.driver.pinchPush(); });
  await page.waitForFunction(() => (window as any).lumen.view().mode === "IDLE", null, { timeout: 15000 });
  await page.waitForFunction(() => (window as any).lumen.view().alarm !== null, null, { timeout: 20000 });
});

// The core moment driven by real mouse clicks (click = pinch), through the same raycast picking a user hits.
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function click(page: Page, target: string) {
  const p = await page.evaluate((t) => (window as any).lumen.screenPoint(t), target);
  expect(p, `${target} is on screen`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

const look = (page: Page, where: "hub" | "cart") =>
  page.evaluate((w) => (w === "hub" ? (window as any).lumen.probe.lookAtHub() : (window as any).lumen.probe.lookAtCart()), where);
const view = (page: Page) => page.evaluate(() => (window as any).lumen.view());

test("pick up → red port → redirect → green port → Push here → quiet, all by clicking", async ({ lens }) => {
  await look(lens, "cart");
  await click(lens, "syringe.S1");
  let v = await view(lens);
  expect(v.chipText).toBe("Holding: Furosemide 40 mg");

  await look(lens, "hub");
  await click(lens, "port.B");
  v = await view(lens);
  expect(v.mode).toBe("PORT_FOCUS");
  expect(v.ports.B.focused).toBe(true);
  expect(v.redirect.to).toBe("A");

  await click(lens, "port.A");
  v = await view(lens);
  expect(v.pushButtonPort).toBe("A");

  await click(lens, "push");
  v = await view(lens);
  expect(v.mode).toBe("CONFIRMED");
  expect(v.logText).toMatch(/^Furosemide 40 mg → CVC Distal · \d\d:\d\d$/);
  await lens.evaluate(() => (window as any).lumen.step(1.6));
  expect((await view(lens)).mode).toBe("IDLE");
});

test("each CVC port is hit precisely despite overlapping 6 cm targets", async ({ lens }) => {
  await look(lens, "hub");
  for (const p of ["A", "B", "C", "A", "C", "B"]) {
    await click(lens, `port.${p}`);
    const v = await view(lens);
    expect(v.mode).toBe("TRACE");
    expect(v.ports[p].focused, `clicked ${p}`).toBe(true);
  }
});

test("alarm: Resolved button works by click; clicking empty space changes nothing", async ({ lens }) => {
  await lens.evaluate(() => (window as any).lumen.driver.triggerAlarm());
  await lens.evaluate(() => (window as any).lumen.lookAt({ r: -4, f: 22.5, u: 102 }));
  const before = await view(lens);
  await lens.mouse.click(30, 30);
  expect(await view(lens)).toEqual(before);
  await click(lens, "resolved");
  expect((await view(lens)).alarm).toBeNull();
});

test("dragging to look is not a pinch", async ({ lens }) => {
  await look(lens, "hub");
  const p = await lens.evaluate(() => (window as any).lumen.screenPoint("port.B"));
  await lens.mouse.move(p.x, p.y);
  await lens.mouse.down();
  await lens.mouse.move(p.x + 60, p.y + 10, { steps: 5 });
  await lens.mouse.up();
  expect((await view(lens)).mode).toBe("IDLE");
});

test("shift-handoff: clicking the IV pole walks every line, then goes quiet with a log", async ({ lens }) => {
  await lens.evaluate(() => (window as any).lumen.lookAt({ r: -70, f: 100, u: 160 }));
  await click(lens, "pole");
  let v = await view(lens);
  expect(v.mode).toBe("HANDOFF");
  expect(v.glowLine).toBe(1);
  await lens.evaluate(() => (window as any).lumen.step(10.1));
  v = await view(lens);
  expect(v.mode).toBe("IDLE");
  expect(v.logText).toMatch(/^Lines checked · 4 of 4 · \d\d:\d\d$/);
});

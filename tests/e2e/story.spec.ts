// Story mode (the hands-free demo) plays end to end: every scripted pinch lands, captions and title show.
import { test, expect } from "./fixtures";

test("story mode plays the whole spatial moment and ends quiet", async ({ lens }) => {
  const seen = await lens.evaluate(() => {
    const l = (window as any).lumen;
    l.startStory();
    const modes = new Set<string>();
    const captions = new Set<string>();
    let alarm = false;
    let title = 0;
    let handoffLog = "";
    let t = 0;
    while (t >= 0 && t < l.storyLength + 1) {
      t = l.storyFrame(0.25);
      const v = l.view();
      modes.add(v.mode);
      if (v.alarm) alarm = true;
      if (v.logText && v.logText.startsWith("Lines checked")) handoffLog = v.logText;
      const c = document.getElementById("caption")!.textContent;
      if (c) captions.add(c);
      title = Math.max(title, Number(document.getElementById("title-card")!.style.opacity || 0));
    }
    return { handoffLog, modes: [...modes], captions: captions.size, alarm, view: l.view(), title, titleAfter: document.getElementById("title-card")!.style.opacity, cues: l.cueLog().map((c: any) => c.id) };
  });
  for (const m of ["IDLE", "HOLDING", "PORT_FOCUS", "CONFIRMED", "HANDOFF"]) expect(seen.modes).toContain(m);
  expect(seen.alarm).toBe(true);
  expect(seen.view.alarm).toBeNull();
  expect(seen.view.mode).toBe("IDLE");
  expect(seen.handoffLog).toMatch(/^Lines checked · 4 of 4/);
  expect(seen.captions).toBeGreaterThanOrEqual(10);
  expect(seen.title).toBe(1);
  expect(Number(seen.titleAfter)).toBe(0);
  for (const c of ["tick", "markers", "red", "green", "confirm", "alarm", "resolved"]) expect(seen.cues).toContain(c);
});

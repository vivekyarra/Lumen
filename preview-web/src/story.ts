// Story mode: the spatial moment from LUMEN_SPEC.md §6 / §13 played hands-free, with captions.
// Deterministic in Lens time, so tools/record-demo.mjs can render it frame-perfect to a video.
import { V3, v3 } from "../../Assets/Lumen/Core/Vec";
import * as L from "../../Assets/Lumen/Core/LumenLayout";

export type StoryAction =
  | { kind: "syringe"; id: "S1" | "S2" }
  | { kind: "port"; id: "A" | "B" | "C" | "D" }
  | { kind: "push" }
  | { kind: "resolved" }
  | { kind: "pole" };

interface Cue { at: number; action: StoryAction }
interface Shot { at: number; look: V3 }
interface Caption { from: number; to: number; text: string }

const HUB = L.HUB_TARGET;
const CART = L.CART_TARGET;

export const SHOTS: Shot[] = [
  { at: 0, look: v3(-85, 95, 140) },
  { at: 8, look: v3(-10, 80, 92) },
  { at: 10, look: v3(-10, 80, 92) },
  { at: 14, look: v3(-68, 64, 104) },
  { at: 16, look: v3(-68, 64, 104) },
  { at: 20, look: CART },
  { at: 23, look: CART },
  { at: 26, look: HUB },
  { at: 33, look: HUB },
  { at: 37, look: v3(-72, 96, 138) },
  { at: 39, look: v3(-72, 96, 138) },
  { at: 42, look: HUB },
  { at: 47.5, look: HUB },
  { at: 49.5, look: v3(-38, 30, 96) },
  { at: 54, look: v3(-38, 30, 96) },
  { at: 57, look: v3(-78, 100, 128) },
  { at: 59, look: v3(-78, 100, 128) },
  { at: 62.5, look: v3(-8, 24, 104) },
  { at: 66.5, look: v3(-8, 24, 104) },
  { at: 69, look: CART },
  { at: 71, look: CART },
  { at: 73.5, look: HUB },
  { at: 78, look: HUB },
  { at: 81, look: v3(-70, 100, 158) },
  { at: 83, look: v3(-70, 100, 158) },
  { at: 86, look: v3(-52, 74, 118) },
  { at: 95, look: v3(-52, 74, 118) },
];

export const CUES: Cue[] = [
  { at: 21.5, action: { kind: "syringe", id: "S1" } },
  { at: 32, action: { kind: "port", id: "B" } },
  { at: 44, action: { kind: "port", id: "A" } },
  { at: 46.5, action: { kind: "push" } },
  { at: 64.5, action: { kind: "resolved" } },
  { at: 70, action: { kind: "syringe", id: "S2" } },
  { at: 78.5, action: { kind: "syringe", id: "S2" } },
  { at: 83.5, action: { kind: "pole" } },
];

export const CAPTIONS: Caption[] = [
  { from: 0.5, to: 7, text: "This is an ICU bed. Four drugs, four pumps, one tangle." },
  { from: 7, to: 14, text: "Before every push, a nurse must answer: which line is this — and will my drug react with what's in it?" },
  { from: 14, to: 20.5, text: "Today they trace tubes by hand and check a chart away from the bed. Lumen answers both, right where they look." },
  { from: 21, to: 31, text: "Pick up furosemide — a pinch stands in for the barcode scan. Every port turns green or red, with the reason on the port." },
  { from: 32, to: 43.5, text: "This port carries midazolam. Its whole line lights up, through the tangle, to its pump — and Lumen points to the nearest safe port." },
  { from: 44, to: 51, text: "Distal port, heparin: compatible. Push here. Logged — and the Lens goes quiet." },
  { from: 51.5, to: 64, text: "A pump alarms out of view. A sound and an edge arrow turn me to it, and the line glows amber to the exact kink." },
  { from: 64.5, to: 68.5, text: "Resolved." },
  { from: 70, to: 79, text: "Different drug, different answer: with morphine every port is green. The colours come from data, not fixed art." },
  { from: 81, to: 95, text: "Shift handoff: one pinch on the pole walks every line, bag to port — then logs it." },
];

export const TITLE = { from: 95.5, to: 104 };
export const STORY_LENGTH = 104;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Camera look target at story time t (smoothstep between shots). */
export function lookAtTime(t: number): V3 {
  if (t <= SHOTS[0].at) return SHOTS[0].look;
  for (let i = 0; i < SHOTS.length - 1; i++) {
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    if (t >= a.at && t <= b.at) {
      const k = smooth((t - a.at) / Math.max(1e-6, b.at - a.at));
      return v3(a.look.r + (b.look.r - a.look.r) * k, a.look.f + (b.look.f - a.look.f) * k, a.look.u + (b.look.u - a.look.u) * k);
    }
  }
  return SHOTS[SHOTS.length - 1].look;
}

export function captionAt(t: number): string | null {
  for (const c of CAPTIONS) if (t >= c.from && t < c.to) return c.text;
  return null;
}

/** Actions due in (from, to]. */
export function cuesBetween(from: number, to: number): StoryAction[] {
  return CUES.filter((c) => c.at > from && c.at <= to).map((c) => c.action);
}

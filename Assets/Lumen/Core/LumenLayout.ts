/**
 * LumenLayout — scene geometry in spec space (cm; r = right, f = forward, u = up; floor = 0).
 *
 * Relative layout follows LUMEN_SPEC.md §8.2. The bed group is shifted (+45 r, −47 f) from the
 * spec's example numbers so that, per the spec's own priority rule, the central-line ports sit
 * ~1.0 m from the eyes and below eye level, and the cart moves to the head end of the bed so the
 * hub and cart share one glance. See devpost/build-log.md, "Layout decisions".
 */
import { LineId, PortId, PumpId, SyringeId } from "./LumenData";
import { V3, v3 } from "./Vec";
import { Align } from "./ViewMath";

export const EYE_HEIGHT = 165;
export const START_EYE: V3 = v3(0, 0, EYE_HEIGHT);

// ---------- Furniture ----------
export const BED = {
  center: v3(45, 70, 0),
  length: 210, // along r
  width: 95, // along f
  mattressTop: 70,
  mattressThickness: 16,
  railHeight: 30,
  /** Rails cover the head two-thirds of each side (rails r-range). */
  railFrom: -50,
  railTo: 100,
  headboardTop: 95,
};
export const BED_NEAR_F = BED.center.f - BED.width / 2; // 22.5
export const BED_FAR_F = BED.center.f + BED.width / 2; // 117.5
export const BED_HEAD_R = BED.center.r - BED.length / 2; // -60
export const RAIL_TOP = BED.mattressTop + BED.railHeight; // 100

export const PATIENT = {
  head: { center: v3(-45, 70, 81), radius: 10.5 },
  neck: { from: v3(-36, 70, 79), to: v3(-24, 70, 79), radius: 5.5 },
  torso: { from: v3(-22, 70, 80), to: v3(38, 70, 80), radius: 17 },
  pelvis: { from: v3(38, 70, 79), to: v3(52, 70, 79), radius: 15 },
  legs: [
    { from: v3(52, 61, 77), to: v3(132, 60, 76), radius: 7.5 },
    { from: v3(52, 79, 77), to: v3(132, 80, 76), radius: 7.5 },
  ],
  arms: [
    // right (near) arm
    { from: v3(-16, 49, 80), to: v3(36, 47, 77), radius: 4.5 },
    // left (far) arm with the PIV on the forearm
    { from: v3(-16, 91, 80), to: v3(36, 95, 77), radius: 4.5 },
  ],
};

export const POLE = { base: v3(-78, 110, 0), height: 200, radius: 2.5 };

export interface PumpLayout {
  id: PumpId;
  center: V3;
  size: V3; // r × f × u
}

const PUMP_SIZE = v3(20, 15, 12);
export const PUMPS: { [K in PumpId]: PumpLayout } = {
  1: { id: 1, center: v3(-78, 102, 144), size: PUMP_SIZE },
  2: { id: 2, center: v3(-78, 102, 130), size: PUMP_SIZE },
  3: { id: 3, center: v3(-78, 102, 116), size: PUMP_SIZE },
  4: { id: 4, center: v3(-78, 102, 102), size: PUMP_SIZE },
};

export interface BagLayout {
  line: LineId;
  center: V3;
  size: V3;
}
const BAG_SIZE = v3(15, 4, 25);
export const BAGS: { [K in LineId]: BagLayout } = {
  1: { line: 1, center: v3(-102, 112, 187.5), size: BAG_SIZE },
  2: { line: 2, center: v3(-86, 112, 187.5), size: BAG_SIZE },
  3: { line: 3, center: v3(-70, 112, 187.5), size: BAG_SIZE },
  4: { line: 4, center: v3(-54, 112, 187.5), size: BAG_SIZE },
};

export const CART = { center: v3(-46, -2, 0), sizeR: 50, sizeF: 40, top: 95 };

export interface SyringeLayout {
  id: SyringeId;
  center: V3;
  length: number;
  radius: number;
  /** Hit box (r × f × u), forgiving per §8.6. Syringes lie along r. */
  hitSize: V3;
}
export const SYRINGE_LAYOUT: { [K in SyringeId]: SyringeLayout } = {
  S1: { id: "S1", center: v3(-46, -6, 96), length: 12, radius: 1, hitSize: v3(15, 5, 5) },
  S2: { id: "S2", center: v3(-46, 9, 96), length: 12, radius: 1, hitSize: v3(15, 5, 5) },
};

// ---------- Ports ----------
export const PORT_POS: { [K in PortId]: V3 } = {
  A: v3(-31, 56, 82),
  B: v3(-27, 56, 82),
  C: v3(-23, 56, 82),
  D: v3(15, 95, 78),
};
/** Central-line hub body (the three connectors fan out of it). */
export const CVC_HUB = { center: v3(-27, 60, 81), catheterFrom: v3(-28, 66, 80) };
export const PORT_HIT_RADIUS = 3; // 6 cm sphere
export const MARKER_RING_DIAMETER = 4;
export const IDLE_DOT_DIAMETER = 1;

// ---------- Text ----------
export const TEXT_CAP = { small: 1.8, large: 2.5 };

export interface LabelSlot {
  anchor: V3;
  align: Align;
}

/** One label slot per port. A runs left, C runs right, B sits higher and centred: no overlaps. */
export const PORT_LABEL_SLOT: { [K in PortId]: LabelSlot } = {
  A: { anchor: v3(-34, 56, 86), align: "right" },
  B: { anchor: v3(-27, 56, 99), align: "center" },
  C: { anchor: v3(-20, 56, 86), align: "left" },
  D: { anchor: v3(15, 95, 83), align: "center" },
};

/** Long labels wrap to two lines at this many characters so the hub's labels fit in the SPECS view. */
export const LABEL_WRAP_CHARS = 20;

export const CART_TEXT = {
  demoLabel: { anchor: v3(-46, 2, 122), align: "center" as Align },
  hint: { anchor: v3(-46, 2, 110), align: "center" as Align },
  chip: { anchor: v3(-46, 2, 99.5), align: "center" as Align },
  log: { anchor: v3(-46, 2, 110), align: "center" as Align },
};

// ---------- Buttons ----------
export const BUTTON_SIZE = { w: 9, h: 4 };
export const BUTTON_HIT = { w: 12, h: 6 };

/**
 * "Push here" sits just in front of the focused port (toward the user, slightly lower), so from the
 * start position it appears right under the port and never covers a port, a label or the redirect arrow.
 */
export const PUSH_BUTTON_POS: { [K in PortId]: V3 } = {
  A: v3(-31, 45, 80),
  B: v3(-27, 45, 80),
  C: v3(-23, 45, 80),
  D: v3(15, 84, 76),
};

// ---------- Lines ----------
export interface LineLayout {
  id: LineId;
  /** Control points from the bag, through the pump, to the port. */
  control: V3[];
  /** Index of the control point where the line leaves the pump. */
  pumpOutIndex: number;
  /** Index of the kink control point, if any. */
  kinkIndex: number;
}

export const KINK_POS: V3 = v3(-15, 22.5, 101);

export const LINE_LAYOUT: { [K in LineId]: LineLayout } = {
  1: {
    id: 1,
    control: [
      v3(-102, 112, 175), v3(-92, 110, 162), v3(-78, 108, 150),
      v3(-78, 96, 138), v3(-66, 84, 110), v3(-50, 68, 98), v3(-38, 60, 90), v3(-30, 57, 84), PORT_POS.B,
    ],
    pumpOutIndex: 3,
    kinkIndex: -1,
  },
  2: {
    id: 2,
    control: [
      v3(-86, 112, 175), v3(-82, 110, 155), v3(-78, 108, 136),
      v3(-78, 96, 124), v3(-74, 70, 106), v3(-62, 40, 104), v3(-40, 24, 102), KINK_POS,
      v3(-16, 28, 94), v3(-19, 44, 86), PORT_POS.C,
    ],
    pumpOutIndex: 3,
    kinkIndex: 7,
  },
  3: {
    id: 3,
    control: [
      v3(-70, 112, 175), v3(-74, 110, 145), v3(-78, 108, 122),
      v3(-78, 96, 110), v3(-84, 78, 104), v3(-66, 58, 100), v3(-46, 54, 91), v3(-35, 55, 85), PORT_POS.A,
    ],
    pumpOutIndex: 3,
    kinkIndex: -1,
  },
  4: {
    id: 4,
    control: [
      v3(-54, 112, 175), v3(-64, 110, 135), v3(-78, 108, 108),
      v3(-78, 96, 96), v3(-68, 108, 94), v3(-55, 124, 96), v3(-10, 127, 98), v3(18, 119, 102),
      v3(17, 108, 90), PORT_POS.D,
    ],
    pumpOutIndex: 3,
    kinkIndex: -1,
  },
};

export const TUBE_RADIUS = 0.25; // 0.5 cm diameter
export const GLOW_RADIUS = 0.6; // 1.2 cm wide glow
export const CURVE_SAMPLES_PER_SEGMENT = 12;

// ---------- Alarm ----------
export const KINK_RING_DIAMETER = 6;
export const RESOLVED_BUTTON_POS: V3 = v3(KINK_POS.r, KINK_POS.f, KINK_POS.u + 8);
export const KINK_TEXT_ANCHOR: V3 = v3(KINK_POS.r, KINK_POS.f, KINK_POS.u + 12);
/** Alarm text sits to the left of Pump 2 (right-aligned) so it never collides with a trace label. */
export const PUMP_ALARM_TEXT_ANCHOR: V3 = v3(-89.5, 94, 127);

/** Trace label for each pump, to the right of the pump front (left-aligned). */
export const PUMP_LABEL_ANCHOR: { [K in PumpId]: V3 } = {
  1: v3(-66.5, 94, 141),
  2: v3(-66.5, 94, 127),
  3: v3(-66.5, 94, 113),
  4: v3(-66.5, 94, 99),
};

/** Printed syringe barrel labels, at the user-side end of each syringe. */
export const SYRINGE_LABEL_ANCHOR: { [K in SyringeId]: V3 } = {
  S1: v3(-33, -6, 95.5),
  S2: v3(-33, 9, 95.5),
};

/**
 * Two natural look targets from the start position (SPECS sees only ~37° × 32°, so the hub and
 * the cart are one short head turn apart — readable without walking, DC8).
 */
export const HUB_TARGET: V3 = v3(-27, 56, 88);
export const CART_TARGET: V3 = v3(-46, 2, 107);
/** Start-of-demo look target: the hub, with the chip area at the left edge. */
export const WORK_TARGET: V3 = HUB_TARGET;

export const MIN_UI_DISTANCE_CM = 40;

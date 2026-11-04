/**
 * LumenState — the single source of truth (LUMEN_SPEC.md §8.4, §8.5, §8.9).
 *
 * Engine-agnostic: no Lens Studio or DOM APIs. Engines call the pinch methods on input and
 * `update(nowSec)` once per frame; visuals render `view()` and play sounds from emitted events.
 * Visuals never decide logic.
 */
import { ALARM, LINES, LINE_IDS, PORT_IDS, PortId, SyringeId, LineId, TIMING, lineForPort, PumpId } from "./LumenData";
import { CheckResult, Verdict, checkAll, nearestCompatible } from "./CompatibilityEngine";
import { V3 } from "./Vec";
import * as S from "./Strings";

export type Mode = "IDLE" | "TRACE" | "HOLDING" | "PORT_FOCUS" | "CONFIRMED" | "HANDOFF";

export type LumenEvent =
  | { type: "syringePicked"; syringe: SyringeId }
  | { type: "syringePutDown"; syringe: SyringeId }
  | { type: "markersShown"; syringe: SyringeId }
  | { type: "portFocusedRed"; port: PortId }
  | { type: "portFocusedGreen"; port: PortId }
  | { type: "portUnfocused"; port: PortId }
  | { type: "traceStarted"; port: PortId; line: LineId }
  | { type: "traceEnded"; port: PortId; reason: "toggle" | "timeout" | "replaced" | "pickup" }
  | { type: "pushConfirmed"; port: PortId; syringe: SyringeId; log: string }
  | { type: "returnedToIdle" }
  | { type: "hintHidden" }
  | { type: "logExpired" }
  | { type: "alarmStarted"; pump: PumpId; source: "timer" | "debug" }
  | { type: "alarmBeep"; pump: PumpId }
  | { type: "alarmResolved"; pump: PumpId }
  | { type: "handoffStarted" }
  | { type: "handoffStep"; line: LineId; index: number; total: number }
  | { type: "handoffEnded"; reason: "done" | "toggle" | "interrupted"; checked: number }
  | { type: "ignored"; action: string; reason: string };

export type MarkerKind = "idle" | Verdict;

export interface PortView {
  port: PortId;
  marker: MarkerKind;
  /** 0..1 — fades in after pick-up and out after a confirmed push. */
  opacity: number;
  focused: boolean;
  /** Text in this port's label slot, or null. */
  label: string | null;
  /** Colour role of the label. */
  labelRole: "neutral" | "compatible" | "incompatible" | "redirect" | null;
  /** Confirmed-push green pulse on this port. */
  pulse: boolean;
}

export interface AlarmView {
  pump: PumpId;
  line: LineId;
  text: string;
  kinkText: string;
  resolvedText: string;
}

export interface LumenView {
  mode: Mode;
  held: SyringeId | null;
  chipText: string | null;
  hintText: string | null;
  /** Safety notice shown on the cart while holding (e.g. no compatible port anywhere). */
  noticeText: string | null;
  /** Shift-handoff progress (1-based step), or null. */
  handoff: { step: number; total: number } | null;
  ports: { [K in PortId]: PortView };
  /** Line glowing cyan (trace / focus), and the label shown on its pump. */
  glowLine: LineId | null;
  pumpLabel: string | null;
  pushButtonPort: PortId | null;
  pushText: string | null;
  redirect: { from: PortId; to: PortId; label: string } | null;
  logText: string | null;
  alarm: AlarmView | null;
}

export interface Clock {
  /** Local wall-clock hours (0–23) and minutes for the push log. */
  wallClock(): { h: number; m: number };
}

export const SYSTEM_CLOCK: Clock = {
  wallClock: function () {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes() };
  },
};

interface Timer {
  at: number;
  kind: "trace" | "confirmIdle" | "log" | "hint" | "alarm" | "beep" | "handoff";
}

export class LumenStateMachine {
  private now = 0;
  private mode: Mode = "IDLE";
  private held: SyringeId | null = null;
  private focused: PortId | null = null;
  private verdicts: { [K in PortId]: CheckResult } | null = null;
  private markersShownAt = 0;
  private confirmedPort: PortId | null = null;
  private confirmedAt = 0;
  private confirmedVerdicts: { [K in PortId]: CheckResult } | null = null;
  private log: string | null = null;
  private hint = true;
  private firstPushDone = false;
  private alarmTimerUsed = false;
  private alarmActive = false;
  private handoffIndex = 0;
  private timers: Timer[] = [];
  private listeners: ((e: LumenEvent) => void)[] = [];
  private readonly positions: { [K in PortId]: V3 };
  private readonly clock: Clock;

  constructor(portPositions: { [K in PortId]: V3 }, clock?: Clock, startTime?: number) {
    this.positions = portPositions;
    this.clock = clock || SYSTEM_CLOCK;
    this.now = startTime || 0;
    this.schedule("hint", TIMING.firstHint);
  }

  // ---------------- subscriptions ----------------

  onEvent(cb: (e: LumenEvent) => void): () => void {
    this.listeners.push(cb);
    const self = this;
    return function () {
      const i = self.listeners.indexOf(cb);
      if (i >= 0) self.listeners.splice(i, 1);
    };
  }

  private emit(e: LumenEvent): void {
    for (let i = 0; i < this.listeners.length; i++) this.listeners[i](e);
  }

  // ---------------- time ----------------

  getTime(): number {
    return this.now;
  }

  /** Advance to absolute time `nowSec`, firing every due timer in order. */
  update(nowSec: number): void {
    if (nowSec < this.now) return;
    for (;;) {
      let next: Timer | null = null;
      for (let i = 0; i < this.timers.length; i++) {
        const t = this.timers[i];
        if (t.at <= nowSec && (next === null || t.at < next.at)) next = t;
      }
      if (next === null) break;
      this.timers.splice(this.timers.indexOf(next), 1);
      this.now = next.at;
      this.fire(next.kind);
    }
    this.now = nowSec;
  }

  advance(dtSec: number): void {
    this.update(this.now + dtSec);
  }

  private schedule(kind: Timer["kind"], delay: number): void {
    this.cancel(kind);
    this.timers.push({ at: this.now + delay, kind: kind });
  }

  private cancel(kind: Timer["kind"]): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].kind === kind) this.timers.splice(i, 1);
    }
  }

  hasTimer(kind: Timer["kind"]): boolean {
    for (let i = 0; i < this.timers.length; i++) if (this.timers[i].kind === kind) return true;
    return false;
  }

  private fire(kind: Timer["kind"]): void {
    switch (kind) {
      case "trace":
        if (this.mode === "TRACE" && this.focused) {
          const p = this.focused;
          this.focused = null;
          this.mode = "IDLE";
          this.emit({ type: "traceEnded", port: p, reason: "timeout" });
        }
        return;
      case "confirmIdle":
        if (this.mode === "CONFIRMED") {
          this.mode = "IDLE";
          this.confirmedPort = null;
          this.confirmedVerdicts = null;
          this.emit({ type: "returnedToIdle" });
        }
        return;
      case "log":
        this.log = null;
        this.emit({ type: "logExpired" });
        return;
      case "hint":
        this.hideHint();
        return;
      case "alarm":
        this.startAlarm("timer");
        return;
      case "handoff":
        if (this.mode === "HANDOFF") this.handoffNext();
        return;
      case "beep":
        if (this.alarmActive) {
          this.emit({ type: "alarmBeep", pump: ALARM.pump });
          this.schedule("beep", TIMING.alarmBeepInterval);
        }
        return;
    }
  }

  // ---------------- input (pinch = mouse click in the preview) ----------------

  /** Pinch a syringe on the cart: pick it up, swap, or put it down if it is already held. */
  pinchSyringe(id: SyringeId): void {
    if (this.held === id) {
      this.putDown();
      return;
    }
    this.hideHint();
    this.stopHandoff("interrupted");
    if (this.mode === "TRACE" && this.focused) {
      const p = this.focused;
      this.cancel("trace");
      this.emit({ type: "traceEnded", port: p, reason: "pickup" });
    }
    this.cancel("trace");
    this.cancel("confirmIdle");
    this.confirmedPort = null;
    this.confirmedVerdicts = null;
    this.held = id;
    this.focused = null;
    this.mode = "HOLDING";
    this.verdicts = checkAll(id);
    this.markersShownAt = this.now;
    // Sound order: the tick of the pick-up comes before the markers' two-note.
    this.emit({ type: "syringePicked", syringe: id });
    this.emit({ type: "markersShown", syringe: id });
  }

  /** Pinch the "Holding: …" chip — same as putting the syringe down. */
  pinchChip(): void {
    if (this.held) this.putDown();
    else this.emit({ type: "ignored", action: "chip", reason: "no syringe held" });
  }

  private putDown(): void {
    const s = this.held;
    this.held = null;
    this.focused = null;
    this.verdicts = null;
    this.mode = "IDLE";
    if (s) this.emit({ type: "syringePutDown", syringe: s });
  }

  pinchPort(port: PortId): void {
    if (this.mode === "CONFIRMED") {
      this.emit({ type: "ignored", action: "port", reason: "confirm fade in progress" });
      return;
    }
    if (!this.held) {
      // IDLE / TRACE / HANDOFF
      this.stopHandoff("interrupted");
      if (this.mode === "TRACE" && this.focused === port) {
        this.cancel("trace");
        this.focused = null;
        this.mode = "IDLE";
        this.emit({ type: "traceEnded", port: port, reason: "toggle" });
        return;
      }
      if (this.mode === "TRACE" && this.focused) {
        this.emit({ type: "traceEnded", port: this.focused, reason: "replaced" });
      }
      this.mode = "TRACE";
      this.focused = port;
      this.schedule("trace", TIMING.traceAutoEnd);
      this.emit({ type: "traceStarted", port: port, line: lineForPort(port).id });
      return;
    }
    // HOLDING / PORT_FOCUS
    if (this.mode === "PORT_FOCUS" && this.focused === port) {
      this.focused = null;
      this.mode = "HOLDING";
      this.emit({ type: "portUnfocused", port: port });
      return;
    }
    this.focused = port;
    this.mode = "PORT_FOCUS";
    const v = this.verdicts ? this.verdicts[port] : null;
    if (v && v.safe) this.emit({ type: "portFocusedGreen", port: port });
    else this.emit({ type: "portFocusedRed", port: port });
  }

  /** Pinch "Push here" — only exists on a focused green port. */
  pinchPush(): void {
    if (this.mode !== "PORT_FOCUS" || !this.focused || !this.held || !this.verdicts || !this.verdicts[this.focused].safe) {
      this.emit({ type: "ignored", action: "push", reason: "no push button" });
      return;
    }
    const port = this.focused;
    const syringe = this.held;
    const t = this.clock.wallClock();
    const log = S.logText(syringe, port, S.formatClock(t.h, t.m));
    this.mode = "CONFIRMED";
    this.confirmedPort = port;
    this.confirmedAt = this.now;
    this.confirmedVerdicts = this.verdicts;
    this.held = null; // syringe goes back on the cart
    this.focused = null;
    this.verdicts = null;
    this.log = log;
    this.schedule("confirmIdle", TIMING.confirmToIdle);
    this.schedule("log", TIMING.logLineStays);
    this.emit({ type: "pushConfirmed", port: port, syringe: syringe, log: log });
    if (!this.firstPushDone) {
      this.firstPushDone = true;
      if (!this.alarmTimerUsed) {
        this.alarmTimerUsed = true;
        this.schedule("alarm", TIMING.alarmAfterFirstPush);
      }
    }
  }

  pinchResolved(): void {
    if (!this.alarmActive) {
      this.emit({ type: "ignored", action: "resolved", reason: "no alarm" });
      return;
    }
    this.alarmActive = false;
    this.cancel("beep");
    this.emit({ type: "alarmResolved", pump: ALARM.pump });
  }

  /**
   * Pinch the IV pole (above the pumps): shift-handoff line check. Each line lights in turn from bag
   * through pump to port with its labels, then the Lens goes quiet and logs "Lines checked · 4 of 4".
   * Pinch the pole again to stop. Not while holding a syringe (one task at a time).
   */
  pinchPole(): void {
    if (this.held || this.mode === "CONFIRMED") {
      this.emit({ type: "ignored", action: "pole", reason: this.held ? "syringe held" : "confirm fade in progress" });
      return;
    }
    if (this.mode === "HANDOFF") {
      this.stopHandoff("toggle");
      return;
    }
    if (this.mode === "TRACE" && this.focused) {
      this.cancel("trace");
      this.emit({ type: "traceEnded", port: this.focused, reason: "replaced" });
    }
    this.hideHint();
    this.mode = "HANDOFF";
    this.handoffIndex = 0;
    this.emit({ type: "handoffStarted" });
    this.showHandoffStep();
  }

  private showHandoffStep(): void {
    const line = LINE_IDS[this.handoffIndex];
    this.focused = LINES[line].port;
    this.schedule("handoff", TIMING.handoffStep);
    this.emit({ type: "handoffStep", line: line, index: this.handoffIndex, total: LINE_IDS.length });
  }

  private handoffNext(): void {
    this.handoffIndex++;
    if (this.handoffIndex < LINE_IDS.length) {
      this.showHandoffStep();
      return;
    }
    const t = this.clock.wallClock();
    this.log = S.handoffLogText(LINE_IDS.length, LINE_IDS.length, S.formatClock(t.h, t.m));
    this.schedule("log", TIMING.logLineStays);
    this.mode = "IDLE";
    this.focused = null;
    this.emit({ type: "handoffEnded", reason: "done", checked: LINE_IDS.length });
  }

  private stopHandoff(reason: "toggle" | "interrupted"): void {
    if (this.mode !== "HANDOFF") return;
    this.cancel("handoff");
    this.mode = "IDLE";
    this.focused = null;
    this.emit({ type: "handoffEnded", reason: reason, checked: this.handoffIndex });
  }

  /** Pinch on empty space: nothing happens (LUMEN_SPEC.md §8.5). */
  pinchEmpty(): void {
    // Intentionally no state change.
  }

  /** Hidden debug / test hook (keyboard "A" in the web preview). Never visible on screen. */
  debugTriggerAlarm(): void {
    this.startAlarm("debug");
  }

  private startAlarm(source: "timer" | "debug"): void {
    if (this.alarmActive) return;
    this.cancel("alarm");
    this.alarmActive = true;
    this.emit({ type: "alarmStarted", pump: ALARM.pump, source: source });
    this.emit({ type: "alarmBeep", pump: ALARM.pump });
    this.schedule("beep", TIMING.alarmBeepInterval);
  }

  private hideHint(): void {
    if (this.hint) {
      this.hint = false;
      this.cancel("hint");
      this.emit({ type: "hintHidden" });
    }
  }

  // ---------------- read model ----------------

  getMode(): Mode {
    return this.mode;
  }

  getHeld(): SyringeId | null {
    return this.held;
  }

  getFocused(): PortId | null {
    return this.focused;
  }

  isAlarmActive(): boolean {
    return this.alarmActive;
  }

  view(): LumenView {
    const ports = {} as { [K in PortId]: PortView };
    const mode = this.mode;
    let markerOpacity = 1;
    if (mode === "HOLDING" || mode === "PORT_FOCUS") {
      markerOpacity = Math.min(1, (this.now - this.markersShownAt) / TIMING.markerFadeIn);
    } else if (mode === "CONFIRMED") {
      markerOpacity = Math.max(0, 1 - (this.now - this.confirmedAt) / TIMING.confirmToIdle);
    }
    const verdicts = mode === "CONFIRMED" ? this.confirmedVerdicts : this.verdicts;
    let redirect: LumenView["redirect"] = null;
    if (mode === "PORT_FOCUS" && this.focused && this.held && verdicts && !verdicts[this.focused].safe) {
      const to = nearestCompatible(this.focused, this.held, this.positions);
      if (to) redirect = { from: this.focused, to: to, label: S.useText(to) };
    }
    for (let i = 0; i < PORT_IDS.length; i++) {
      const p = PORT_IDS[i];
      const v = verdicts ? verdicts[p] : null;
      const marker: MarkerKind = v ? v.verdict : "idle";
      let label: string | null = null;
      let role: PortView["labelRole"] = null;
      const focused = this.focused === p && (mode === "PORT_FOCUS" || mode === "TRACE" || mode === "HANDOFF");
      if ((mode === "TRACE" || mode === "HANDOFF") && focused) {
        label = S.portLabel(p);
        role = "neutral";
      } else if (v && (mode === "HOLDING" || mode === "PORT_FOCUS")) {
        if (redirect && redirect.to === p) {
          label = redirect.label;
          role = "redirect";
        } else if (!v.safe) {
          if (v.verdict === "unknown") label = S.NOT_IN_TABLE_TEXT;
          else label = focused ? S.redFocusText(p) : S.redShortText(p);
          role = "incompatible";
        } else if (focused) {
          label = S.COMPATIBLE_TEXT;
          role = "compatible";
        }
      }
      ports[p] = {
        port: p,
        marker: marker,
        opacity: marker === "idle" ? 1 : markerOpacity,
        focused: focused,
        label: label,
        labelRole: role,
        pulse: mode === "CONFIRMED" && this.confirmedPort === p,
      };
    }
    const glowLine = (mode === "TRACE" || mode === "PORT_FOCUS" || mode === "HANDOFF") && this.focused ? lineForPort(this.focused).id : null;
    const noSafePort = mode === "PORT_FOCUS" && !!this.focused && !!verdicts && !verdicts[this.focused].safe && redirect === null;
    const pushPort = mode === "PORT_FOCUS" && this.focused && verdicts && verdicts[this.focused].safe ? this.focused : null;
    return {
      mode: mode,
      held: this.held,
      chipText: this.held ? S.holdingText(this.held) : null,
      hintText: this.hint ? S.HINT_TEXT : null,
      noticeText: noSafePort ? S.NO_SAFE_PORT_TEXT : null,
      handoff: mode === "HANDOFF" ? { step: this.handoffIndex + 1, total: LINE_IDS.length } : null,
      ports: ports,
      glowLine: glowLine,
      pumpLabel: glowLine ? S.pumpLabel(glowLine) : null,
      pushButtonPort: pushPort,
      pushText: pushPort ? S.PUSH_TEXT : null,
      redirect: redirect,
      logText: this.log,
      alarm: this.alarmActive
        ? { pump: ALARM.pump, line: ALARM.line, text: ALARM.text, kinkText: ALARM.kinkText, resolvedText: S.RESOLVED_TEXT }
        : null,
    };
  }
}

/** Invariants that must hold after any sequence of inputs (used by the fuzz tests). */
export function invariantViolations(v: LumenView): string[] {
  const out: string[] = [];
  const focusedPorts = PORT_IDS.filter(function (p) {
    return v.ports[p].focused;
  });
  if (focusedPorts.length > 1) out.push("more than one port focused");
  if (v.mode === "IDLE") {
    if (v.held) out.push("IDLE but holding");
    if (v.glowLine !== null) out.push("IDLE but a line glows");
    if (v.pushButtonPort) out.push("IDLE but push button");
    for (let i = 0; i < PORT_IDS.length; i++) {
      const p = v.ports[PORT_IDS[i]];
      if (p.marker !== "idle") out.push("IDLE but marker on " + p.port);
      if (p.label) out.push("IDLE but label on " + p.port);
    }
  }
  if (v.pushButtonPort) {
    const p = v.ports[v.pushButtonPort];
    if (p.marker !== "compatible") out.push("push button on a non-green port");
    if (v.mode !== "PORT_FOCUS") out.push("push button outside PORT_FOCUS");
    if (v.redirect) out.push("push button and redirect together");
  }
  if (v.redirect) {
    if (v.ports[v.redirect.from].marker === "compatible") out.push("redirect from a green port");
    if (v.ports[v.redirect.to].marker !== "compatible") out.push("redirect to a non-green port");
  }
  if ((v.mode === "HOLDING" || v.mode === "PORT_FOCUS") && !v.held) out.push(v.mode + " without syringe");
  if ((v.mode === "HOLDING" || v.mode === "PORT_FOCUS") && !v.chipText) out.push("holding without chip");
  if (v.mode === "TRACE" && v.held) out.push("TRACE while holding");
  if (v.mode === "HANDOFF") {
    if (v.held) out.push("HANDOFF while holding");
    if (!v.handoff || v.glowLine !== LINE_IDS[v.handoff.step - 1]) out.push("handoff glows the wrong line");
    if (v.pushButtonPort || v.redirect) out.push("handoff shows push/redirect");
  } else if (v.handoff) out.push("handoff progress outside HANDOFF");
  if (v.noticeText && v.mode !== "PORT_FOCUS") out.push("notice outside PORT_FOCUS");
  if (v.glowLine !== null) {
    const fp = focusedPorts[0];
    if (!fp || LINES[v.glowLine].port !== fp) out.push("glowing line does not match the focused port");
  }
  for (let i = 0; i < PORT_IDS.length; i++) {
    const p = v.ports[PORT_IDS[i]];
    if (p.opacity < 0 || p.opacity > 1) out.push("opacity out of range");
    if (p.labelRole === "compatible" && p.marker !== "compatible") out.push("✓ label on a non-green port");
    if (p.labelRole === "incompatible" && p.marker === "compatible") out.push("✕ label on a green port");
  }
  return out;
}

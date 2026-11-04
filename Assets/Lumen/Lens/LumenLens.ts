/**
 * LumenLens — the one component to add to a scene object in the SPECS Base Template.
 *
 * It builds the virtual ICU bedside and every piece of Lumen's Lens content at runtime from the shared
 * Core (data, layout, state machine, meshes), wires pinch input through the Spectacles Interaction Kit,
 * and renders LumenState's view model every frame. Visuals never decide logic (LUMEN_SPEC.md §9.2).
 *
 * Setup: see LENS_STUDIO_SETUP.md.
 */
import * as L from "../Core/LumenLayout";
import { LINE_IDS, LineId, PORT_IDS, PortId, SyringeId } from "../Core/LumenData";
import { LumenStateMachine } from "../Core/LumenState";
import { distance } from "../Core/Vec";
import { Pose } from "../Core/ViewMath";
import { SpecFrame, faceCamera, makePinchTarget, safe } from "./LensAdapters";
import { LensContext, local } from "./LensContext";
import { SceneBuilder } from "./SceneBuilder";
import { PortMarker } from "./PortMarker";
import { LineTracer } from "./LineTracer";
import { SyringeTray } from "./SyringeTray";
import { PushButton } from "./PushButton";
import { RedirectArrow } from "./RedirectArrow";
import { AlarmController } from "./AlarmController";
import { AudioCues } from "./AudioCues";
import { HEX } from "./Palette";
import * as S from "../Core/Strings";
import { runLensSelfTest } from "./LumenSelfTest";

@component
export class LumenLens extends BaseScriptComponent {
  @input
  @hint("The scene's main Camera object (SPECS Base Template: 'Camera Object').")
  camera: SceneObject;

  @input
  @hint("An Unlit material (Lumen recolours clones of it).")
  unlitMaterial: Material;

  @input
  @hint("A lit (PBR / Simple) material for the virtual bedside.")
  litMaterial: Material;

  @input
  @allowUndefined
  font: Font;

  @input
  @hint("World-space text calibration: centimetres per text point. Tune once if text looks too big/small.")
  textCmPerPoint: number = 0.05;

  @input
  eyeHeightCm: number = 165;

  @input @allowUndefined soundTick: AudioTrackAsset;
  @input @allowUndefined soundMarkers: AudioTrackAsset;
  @input @allowUndefined soundRed: AudioTrackAsset;
  @input @allowUndefined soundGreen: AudioTrackAsset;
  @input @allowUndefined soundConfirm: AudioTrackAsset;
  @input @allowUndefined soundAlarm: AudioTrackAsset;
  @input @allowUndefined soundResolved: AudioTrackAsset;

  @input
  @hint("Runs DC1–DC8 inside the preview on start and prints PASS/FAIL to the Logger. Never shown on screen.")
  runSelfTestOnStart: boolean = false;

  // ---- runtime ----
  sm!: LumenStateMachine;
  ctx!: LensContext;
  ports = {} as { [K in PortId]: PortMarker };
  lines = {} as { [K in LineId]: LineTracer };
  tray!: SyringeTray;
  push!: PushButton;
  redirect!: RedirectArrow;
  alarm!: AlarmController;
  audio!: AudioCues;
  /** When true, the self-test drives time instead of the frame clock. */
  manualClock = false;
  lensTime = 0;
  private started = false;

  onAwake(): void {
    // Build on a short delay so device tracking has settled before the start pose anchors the bedside.
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => this.start());
    delayed.reset(0.3);
    this.createEvent("UpdateEvent").bind(() => this.update());
  }

  private start(): void {
    const camT = this.camera.getTransform();
    const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));
    const frame = new SpecFrame(camT.getWorldPosition(), fwd, this.eyeHeightCm);
    const specRoot = global.scene.createSceneObject("Lumen");
    specRoot.setParent(this.getSceneObject());
    specRoot.getTransform().setWorldPosition(frame.originPoint());
    specRoot.getTransform().setWorldRotation(frame.rotation());
    this.ctx = {
      frame: frame,
      specRoot: specRoot,
      litMaterial: this.litMaterial,
      unlitMaterial: this.unlitMaterial,
      font: this.font,
      cmPerPoint: this.textCmPerPoint,
      billboards: [],
    };
    new SceneBuilder(this.ctx).build();
    for (let i = 0; i < LINE_IDS.length; i++) this.lines[LINE_IDS[i]] = new LineTracer(this.ctx, LINE_IDS[i]);
    const self = this;
    for (let i = 0; i < PORT_IDS.length; i++) {
      this.ports[PORT_IDS[i]] = new PortMarker(this.ctx, PORT_IDS[i], function (p, hit) { self.onPortPinch(p, hit); });
    }
    this.tray = new SyringeTray(this.ctx, function (s: SyringeId) { self.sm.pinchSyringe(s); }, function () { self.sm.pinchChip(); });
    this.push = new PushButton(this.ctx, "PushHereButton", S.PUSH_TEXT, HEX.green, L.PUSH_BUTTON_POS.A, function () { self.sm.pinchPush(); });
    this.redirect = new RedirectArrow(this.ctx);
    // Shift-handoff line check: pinch the pole above the pumps.
    const pole = global.scene.createSceneObject("IV_Pole_Hit");
    pole.setParent(this.ctx.specRoot);
    pole.getTransform().setLocalPosition(local(L.POLE_HIT.center));
    makePinchTarget(pole, { box: new vec3(L.POLE_HIT.size.r, L.POLE_HIT.size.u, L.POLE_HIT.size.f) }, function () { self.sm.pinchPole(); });
    this.alarm = new AlarmController(this.ctx, this.camera, function () { self.sm.pinchResolved(); });
    // Spatial audio needs a listener on the camera.
    safe(() => {
      if (!this.camera.getComponent("Component.AudioListenerComponent")) this.camera.createComponent("Component.AudioListenerComponent");
    });
    this.audio = new AudioCues(this.ctx, {
      tick: this.soundTick, markers: this.soundMarkers, red: this.soundRed, green: this.soundGreen,
      confirm: this.soundConfirm, alarm: this.soundAlarm, resolved: this.soundResolved,
    });
    this.lensTime = getTime();
    this.resetSession();
    this.started = true;
    // Hidden test hooks for LEAF / the self-test (never visible on screen).
    (global as any).lumen = {
      lens: this,
      triggerAlarm: function () { self.sm.debugTriggerAlarm(); },
      view: function () { return self.sm.view(); },
      runSelfTest: function () { return runLensSelfTest(self); },
    };
    print("[Lumen] ready · Demo data — not for clinical use");
    if (this.runSelfTestOnStart) {
      runLensSelfTest(this);
    }
  }

  resetSession(): void {
    this.sm = new LumenStateMachine(L.PORT_POS, undefined, this.lensTime);
    const self = this;
    this.sm.onEvent(function (e) { self.audio.onEvent(e, self.lensTime); });
    this.renderNow();
  }

  /** Overlapping 6 cm port targets: resolve to the port centre nearest the hit point when SIK reports one. */
  private onPortPinch(port: PortId, hitWorld: vec3 | null): void {
    let chosen = port;
    if (hitWorld) {
      const hit = this.ctx.frame.toSpec(hitWorld);
      let best = Infinity;
      for (let i = 0; i < PORT_IDS.length; i++) {
        const d = distance(hit, L.PORT_POS[PORT_IDS[i]]);
        if (d < best && d <= L.PORT_HIT_RADIUS + 0.5) {
          best = d;
          chosen = PORT_IDS[i];
        }
      }
    }
    this.sm.pinchPort(chosen);
  }

  cameraPose(): Pose {
    const t = this.camera.getTransform();
    const r = t.getWorldRotation();
    const f = this.ctx.frame;
    return {
      eye: f.toSpec(t.getWorldPosition()),
      forward: f.toSpecDir(r.multiplyVec3(new vec3(0, 0, -1))),
      up: f.toSpecDir(r.multiplyVec3(new vec3(0, 1, 0))),
      right: f.toSpecDir(r.multiplyVec3(new vec3(1, 0, 0))),
    };
  }

  private update(): void {
    if (!this.started) return;
    if (!this.manualClock) {
      this.lensTime = getTime();
      this.sm.update(this.lensTime);
    }
    this.renderNow();
  }

  renderNow(): void {
    const view = this.sm.view();
    const t = this.lensTime;
    for (let i = 0; i < PORT_IDS.length; i++) this.ports[PORT_IDS[i]].render(view.ports[PORT_IDS[i]], t);
    for (let i = 0; i < LINE_IDS.length; i++) this.lines[LINE_IDS[i]].render(view, t);
    this.tray.render(view);
    this.push.show(view.pushButtonPort ? L.PUSH_BUTTON_POS[view.pushButtonPort] : null);
    this.redirect.render(view);
    this.alarm.render(view, t, this.cameraPose());
    const eye = this.camera.getTransform().getWorldPosition();
    const b = this.ctx.billboards;
    for (let i = 0; i < b.length; i++) {
      if (b[i].isEnabledInHierarchy) faceCamera(b[i], eye);
    }
  }
}

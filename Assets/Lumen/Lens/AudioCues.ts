/** AudioCues — the spatial sounds from LUMEN_SPEC.md §8.7, each played from its object's position. */
import * as L from "../Core/LumenLayout";
import { LumenEvent } from "../Core/LumenState";
import { V3 } from "../Core/Vec";
import { CueId } from "../Core/SoundSynth";
import { LensContext, local, placeAt } from "./LensContext";
import { makeAudio } from "./LensAdapters";

export interface CueTracks {
  tick?: AudioTrackAsset;
  markers?: AudioTrackAsset;
  red?: AudioTrackAsset;
  green?: AudioTrackAsset;
  confirm?: AudioTrackAsset;
  alarm?: AudioTrackAsset;
  resolved?: AudioTrackAsset;
}

export class AudioCues {
  private readonly emitters: { [K in CueId]?: { obj: SceneObject; audio: AudioComponent | null } } = {};
  private lastPlayed: { [K in CueId]?: number } = {};

  constructor(ctx: LensContext, tracks: CueTracks) {
    const ids: CueId[] = ["tick", "markers", "red", "green", "confirm", "alarm", "resolved"];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const obj = placeAt(ctx, "Sound_" + id, L.CART_TEXT.chip.anchor, false);
      this.emitters[id] = { obj: obj, audio: makeAudio(obj, (tracks as any)[id]) };
    }
  }

  private play(id: CueId, at: V3, now: number): void {
    this.lastPlayed[id] = now;
    const e = this.emitters[id];
    if (!e) return;
    e.obj.getTransform().setLocalPosition(local(at));
    if (e.audio) e.audio.play(1);
  }

  stop(id: CueId): void {
    const e = this.emitters[id];
    if (e && e.audio && e.audio.isPlaying()) e.audio.stop(false);
  }

  lastPlayedAt(id: CueId): number | null {
    const t = this.lastPlayed[id];
    return t === undefined ? null : t;
  }

  onEvent(e: LumenEvent, now: number): void {
    switch (e.type) {
      case "syringePicked": this.play("tick", L.SYRINGE_LAYOUT[e.syringe].center, now); break;
      case "markersShown": this.play("markers", L.CART_TEXT.chip.anchor, now); break;
      case "portFocusedRed": this.play("red", L.PORT_POS[e.port], now); break;
      case "portFocusedGreen": this.play("green", L.PORT_POS[e.port], now); break;
      case "pushConfirmed": this.play("confirm", L.PORT_POS[e.port], now); break;
      case "alarmBeep": this.play("alarm", L.PUMPS[e.pump].center, now); break;
      case "alarmResolved": this.stop("alarm"); this.play("resolved", L.KINK_POS, now); break;
      case "handoffStep": this.play("tick", L.PUMPS[e.line].center, now); break;
      case "handoffEnded": if (e.reason === "done") this.play("markers", L.CART_TEXT.log.anchor, now); break;
      default: break;
    }
  }
}

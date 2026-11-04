# Demo film

[`devpost/demo/lumen-demo.mp4`](demo/lumen-demo.mp4): 2:28, 1920×1080, 30 fps. AI voice-over (Microsoft neural voice
"Andrew"), word-synced captions, an original score synthesized in code, and the Lens's own sound cues.

**What is real:** every shot of the Lens working is a **screen recording of the Lens Studio 5.24.1 preview** of this repo's
project. The recorder captures only the Lens Studio window. The pinches are a LEAF scenario (`Assets/Lumen/Leaf/Demo_Story.ts`)
pressing the Lens's real SIK interactables, exactly as a mouse pinch would. The film shows the whole app first, then zooms
into the SPECS 27 display area. The "LEAF run" shot is a real run of the 10 LEAF scenarios at 5× speed, with LEAF's own
PASSED banners. The 3D shots in the opening use the Lens's own bedside models (Core `MeshGen` + `LumenLayout`, via the
web twin) with cinematic lighting.

## Structure

| Time | Scene | Voice-over |
|---|---|---|
| 0:00–0:11 | **Hook** (3D): the camera glides to the hub; furosemide is picked up and every port lights ✓/✕. Then the logo | "This is furosemide. In one second, every IV line on this patient tells me if it's safe for it. This is Lumen." |
| 0:11–0:38 | **Problem** (3D + kinetic type): four tubes draw themselves on with their drugs, the two questions, a slow trace "by hand", the chart sliding away, shift tally | "Meet Maya… Many times a shift. Every shift." |
| 0:38–0:46 | **Reveal**: the **whole Lens Studio window** flies in (tagged REAL APP), then an eased zoom into the SPECS view | "So we built Lumen. A Lens for Snap Specs, running right here, in Lens Studio." |
| 0:46–1:38 | **Demo** (real footage): quiet → pick up → check → trace to the pump → redirect → push → log → "One more thing": pump alarm, edge arrow, amber line to the kink → Resolved → shift handoff. The side panels show the workflow step and the Lens state | 11 lines, each timed to its pinch |
| 1:38–1:55 | **Why glasses**: three pillars, two design principles (real footage thumbnails) | "This only works on glasses…" |
| 1:55–2:15 | **Under the hood**: "Built by Claude Code, inside Lens Studio": animated hub diagram (Claude Code · Snap CLAD · Lens Studio MCP · Lens Studio · LEAF), then the **real LEAF run**, then the 10/10 board | "Claude Code built it, end to end: the scene, the logic, the tests. Through Snap's CLAD and the Lens Studio MCP… Ten of ten pass in the preview." |
| 2:15–2:28 | **Close**: what's next, logo, tagline, credits (Claude Code + Snap CLAD; directed by Yarra Vivek), repo link | "Next: barcode scanning, real line tracking, live pump data. Lumen. The right line. The safe port. Where you look." |

## Rebuild it

Lens Studio must be open on `Lumen.esproj` and not minimized. You also need ffmpeg, Python with `edge-tts`, and Node.

```bash
python tools/video/make_voice.py
```

```bash
node tools/record-lens-studio.mjs
```

```bash
node tools/record-leaf-run.mjs
```

```bash
node tools/video/render-film.mjs
```

```bash
node tools/video/mix-film.mjs
```

Set `LUMEN_VIDEO` (working folder), `TMPDIR_LS` (`$LUMEN_VIDEO/story` for the story take, `$LUMEN_VIDEO/leaf` for the LEAF run)
and `FFMPEG` if ffmpeg is not on PATH. Extract the footage frames before rendering:
- `frames/story`: 30 fps, starting 2.2 s before the take's `t0`;
- `frames/leaf`: 6 fps.

The voice lines live in `tools/video/vo.json`; the timeline and every animation are in `tools/video/film/film.ts`.
Each frame is a pure function of time, so renders are deterministic and resumable.

## Upload

YouTube → Visibility **Public**, "No, it's not made for kids". Title: *Lumen — AR IV line safety for ICU nurses (Learn AR
with SPECS)*. Put the repo link in the description. Check that the link works in a private window, then paste it into
the README and Devpost.

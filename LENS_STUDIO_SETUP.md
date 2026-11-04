# Lens Studio setup (≈ 10 minutes)

Everything Lumen shows is built **at runtime** by one component, `LumenLens`, from the code in
`Assets/Lumen/`. You only add that component to a scene and give it two materials and seven sounds.

> Lens Studio itself (and the `.esproj` / scene files it writes) can only be created on your machine.
> Steps 1–2 do that once; after you commit, anyone can clone and open the project.

## 1. Create the SPECS project inside this repo

1. Install **Lens Studio 5.23.2** (use 5.24.x only if you can sign in with it).
2. **SPECS → Base Template**, then **File → Save As…** and pick an empty folder, e.g. `lumen-ls/`.
3. Copy everything from `lumen-ls/` into the root of this repo (next to `Assets/Lumen/`).
   The template's own `Assets/` and `Packages/` (Spectacles Interaction Kit, UIKit) merge with ours.
4. Open the `.esproj` from the repo root. Lens Studio imports `Assets/Lumen/**` (scripts and
   `Assets/Lumen/Audio/*.wav`) automatically.

## 2. Add Lumen to the scene

1. **Scene Hierarchy → + → Empty Object**, name it `Lumen`.
2. **Inspector → Add Component → Script → `LumenLens`**.
3. Fill the inputs:

| Input | What to pick |
|---|---|
| Camera | the template's **Camera Object** |
| Unlit Material | Asset Browser **+ → Material → Unlit** (any colour; Lumen recolours clones) |
| Lit Material | Asset Browser **+ → Material → PBR** (or Simple PBR) |
| Font | optional — leave empty for the default font |
| Text Cm Per Point | `0.05` (see step 4 if text looks too big or small) |
| Eye Height Cm | `165` |
| Sound Tick … Sound Resolved | drag `Assets/Lumen/Audio/lumen_tick.wav`, `lumen_markers`, `lumen_red`, `lumen_green`, `lumen_confirm`, `lumen_alarm`, `lumen_resolved` |
| Run Self Test On Start | off (turn on to run DC1–DC8, see step 5) |

## 3. Preview

Press **Preview** (Spectacles, interactive). Controls: **WASD** move, **Q/E** down/up, **mouse** look,
**click = pinch**. Look down-left at the central line and the cart; turn left to see the pumps.

## 4. One-time text calibration

World-space text size in Lens Studio depends on the font. The hub labels should have capitals about
**1.8 cm** tall (about the height of the 4 cm marker ring's inner hole). If they are clearly bigger or
smaller, change **Text Cm Per Point** proportionally (e.g. text twice too big → `0.1`).

## 5. Run DC1–DC8 inside the preview (self-test / LEAF hook)

Tick **Run Self Test On Start** and reset the preview. The **Logger** prints:

```
| # | Criterion | LEAF test name | Result |
| DC1 | Quiet idle | test_idle_is_quiet | PASS |
...
[Lumen self-test] 8/8 pass
```

The same scenarios (`Assets/Lumen/Core/Scenarios.ts`) also run in CI against the pure state machine
and the web preview. For LEAF, a test can call the hidden hooks `global.lumen.runSelfTest()`,
`global.lumen.triggerAlarm()` and `global.lumen.view()`. Nothing about these hooks is ever drawn.

Copy the Logger table into `devpost/leaf-results.md` (column "Lens Studio preview").

## 6. Building it "with CLAD" (hackathon rule)

The rules ask that the Lens is built by your coding agent through **CLAD + Lens Studio MCP**.
In Claude Code with CLAD connected, in this folder:

> Read devpost/design-brief.md and devpost/LUMEN_SPEC.md. This repo already contains a reference
> implementation in Assets/Lumen (shared Core + Lens components). Wire LumenLens into the scene through
> the Lens Studio MCP, assign its inputs, fix anything Lens Studio's compiler rejects, then write and run
> LEAF tests for DC1–DC8 (they can call global.lumen.runSelfTest()) and tell me which pass.

Record what CLAD changed in `devpost/build-log.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module SpectaclesInteractionKit.lspkg/...` | The SIK package path differs in your template version: fix the import at the top of `Assets/Lumen/Lens/LensAdapters.ts` to match `Packages/`. |
| Nothing appears | Check the Logger for `[Lumen] ready`. Check the Camera input points at the template camera. |
| Everything is offset / tilted | Lumen places the scene relative to the camera's start pose; reset the preview while looking straight ahead. |
| No sound | Lumen adds an Audio Listener to the camera if it has none; check the 7 Sound inputs are assigned. |
| Labels start beside, not at, their port | Your Lens Studio version ignored the zero layout rect: set the Text's Layout Rect to 0,0,0,0 in `makeText` (`LensAdapters.ts`). |
| Clicks do nothing | Make sure the template's SIK `InteractionManager` / hand or mouse interactor is enabled. |
| Text renders as boxes for ✓ ✕ → | Pick a font that has these glyphs in the **Font** input. Marker ✓/✕ icons are geometry and are unaffected. |

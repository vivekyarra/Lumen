# Lens Studio: open, preview, test

This repo **is** the Lens Studio project. `Lumen.esproj` sits at the root, and the scene (`Assets/Scene.scene`) is
already wired. Everything Lumen shows is built at runtime by one component, `LumenLens`, from the code in
`Assets/Lumen/`.

## 1. Open

1. Install **Lens Studio 5.24.1** and sign in.
2. **File → Open Project… → `Lumen.esproj`** (repo root).

   Lens Studio may say *"SPECS is in Preview Release"*. That only means publishing to glasses waits for
   SPECS firmware; the preview works.
3. The TypeScript Status panel should show *compilation succeeded*.

The scene contains, from the SPECS Base Template:
- Camera Object;
- Lighting (directional 0.85, ambient 0.35);
- SpectaclesInteractionKit (SIK 2.0).

Added for Lumen:
- **`Lumen`**: `LumenLens`, with inputs set as below;
- **`LeafIndex`**: registers the LEAF scenarios.

| `LumenLens` input | Value in the scene |
|---|---|
| Camera | Camera Object |
| Unlit Material | `Assets/Lumen/Materials/Lumen_Unlit.mat` (Unlit preset; Lumen recolours clones) |
| Lit Material | `Assets/Lumen/Materials/Lumen_Lit.mat` (Simple PBR, roughness 0.75, white base texture) |
| Text Cm Per Point | `0.0228` (1 / 43.886: Lens Studio's em-square cm per `Text.size` point) |
| Eye Height Cm | `165` |
| Sound Tick … Sound Resolved | `Assets/Lumen/Audio/lumen_*.wav` (7 cues) |
| Run Self Test On Start | off |

## 2. Preview

Press **Preview** (SPECS 27, interactive). Controls: **WASD** move, **Q/E** down/up, **mouse** look, **click = pinch**.

Lumen places the bedside relative to the camera's start heading:
- reset the preview while facing forward;
- look down-left for the central line and the cart;
- turn left for the pumps and the IV pole.

## 3. Run the LEAF tests

Open the **LEAF** panel (Window → LEAF, or through the Lens Studio MCP `open_leaf_panel`) and run any `test_*` scenario.
`demo_story` is the demo-film walkthrough, not a test.

| Scenario | Checks |
|---|---|
| `test_idle_is_quiet` … `test_handoff_line_check` | DC1–DC7 and DC9, by pinching the Lens's SIK interactables |
| `test_ik_reach_controls` | LEAF's IK avatar reaches the hub port and "Push here" |
| `test_self_test_dc1_dc10` | all ten shared scenarios (`Assets/Lumen/Core/Scenarios.ts`) inside the preview |

The Logger prints the self-test table, ending in `[Lumen self-test] 10/10 pass`. Results: `devpost/leaf-results.md`.

## 4. With the coding agent (CLAD + Lens Studio MCP)

`.claude/settings.json` enables Snap's **CLAD** plugin (`ls-clad@ls-extensions`) for this project. When Lens Studio is
open, it writes `.mcp.json` with its local MCP endpoint (git-ignored). To use them:
1. Start Claude Code in the repo root.
2. Approve the `lens-studio` MCP server.
3. Ask, for example:

> Use the ls-clad LEAF workflow to run every test_ scenario in the Lens Studio preview and tell me which pass.

`devpost/clad-verification.md` is the report from such a run.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing appears | Check the Logger for `[Lumen] ready`. Reset the preview while facing forward; the bedside is below and to the left. |
| Everything is grey or magenta | The lit material lost its base texture: set `Lumen_Lit` → Base Texture to `Lumen_White.png`. |
| `Cannot find module 'InteractionKit.lspkg/…'` | A package built for InteractionKit 4.0 (Lens Studio 5.25) got installed. This project uses SIK 2.0 + LEAF 2.0.2; remove the newer package. |
| No sound | Lumen adds an Audio Listener to the camera if it has none; check the 7 Sound inputs. |
| Text renders as boxes for ✓ ✕ → | Pick a font with these glyphs in the **Font** input. Marker ✓/✕ icons are geometry and are unaffected. |

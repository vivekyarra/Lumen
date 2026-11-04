# Build log

Short notes on how Lumen was built: prompts, decisions, and what changed. Newest last.

## Nov 4 — repo + pipeline (Claude Code, cloud session)

**Prompt:** "Build LUMEN_SPEC.md end to end … never push directly to main, always to a branch, make CI
green, then merge; at least 8 branches and no more than 30 commits on main."

Every change went through its own branch and pull request, CI green before a squash merge:

| PR | Branch | What |
|---|---|---|
| #1 | `claude/ci-tooling` | TypeScript toolchain, node:test runner, CI |
| #2 | `claude/core-data` | `LumenData` (only data file), exact strings, `CompatibilityEngine` (fail-safe) |
| #3 | `claude/core-layout` | bedside layout, IV line curves (exactly one crossing), view math (FOV, edge arrow, label overlap) |
| #4 | `claude/core-state` | state machine + DC1–DC8 scenarios + fuzzing |
| #5 | `claude/meshgen-audio` | procedural meshes, synthesized spatial sound cues (WAVs byte-checked in CI) |
| #6 | `claude/web-preview` | Three.js twin of the Lens Studio preview |
| #7 | `claude/e2e-tests` | Playwright: DC1–DC8 on the rendered scene, real clicks, stress |
| #8 | `claude/lens-components` | Lens Studio components (`LumenLens` + one class per role), self-test, setup guide |
| #9 | `claude/docs-devpost` | README, LEAF results, screenshots, Devpost text, kink-area layout fix |
| #10 | `claude/peaceful-ritchie-lrq0fj` | independent Lens Studio API review fixes, license, `npm run verify` |
| #11 | `claude/handoff-check` | shift-handoff line check (pinch the IV pole), "No safe port — ask pharmacy" fail-safe, DC9 + DC10 |
| #12 | `claude/story-mode` | story mode (hands-free demo with captions), frame-perfect demo video + teaser GIF with mixed sound, GitHub Pages workflow, rubric map |

## Why the two additions (and nothing more)

Each idea was checked against the spec's rule 19 ("Does this help the core moment? Less on screen.").
- **Handoff line check** — tracing every line bag-to-patient is a real handover ritual; Lumen does it with
  one pinch, no new panel, and goes quiet. It reuses the trace glow and labels, so it adds a capability
  without adding UI.
- **No-safe-port fail-safe** — the one case the demo data never shows but a real product must get right:
  never draw an arrow to nowhere.
- Rejected: dose calculators, menus, a lines dashboard, voice — all crowd the view or break pinch-only.

## Independent review of the Lens Studio code (it can't run in CI)

A separate review pass checked every Lens Studio / SIK call against Snap's docs. No blockers; fixed:
`Text.depthTest` defaults to false (printed scene text showed through objects) → set explicitly;
world-text layout rect pinned to the anchor; fading markers now always get a blending pass;
`fitVisual` set before the collider shape; an Audio Listener is added to the camera if missing;
the scene is built 0.3 s after start so device tracking settles; the edge chevron's angle is computed
in centimetres, not skewed NDC.

## Layout decisions (where the build deviates from the spec's example numbers, and why)

The spec's own priority rules ("keep the CVC port 0.8–1.0 m from the eyes", "see the hub and the cart
together", "choose what the preview can clearly show") conflict with its example coordinates:

- With the example numbers the hub is **1.38 m** from the eyes → the bed group is shifted (+45 r, −47 f);
  the ports are now **~1.04 m** away, below eye level.
- With the example numbers the cart is **74°** from the hub — far outside a 37° view. No placement of a
  50 × 40 cm cart beside a standing nurse fits both in 37°, so the cart moved to the **head end** of the
  bed, one short head turn (< 75°) from the hub. Every cart text and both syringes fit one SPECS view of
  the cart; every hub label fits one SPECS view of the hub (tested).
- Long labels wrap to two lines (at "—", "→" or ":") so the hub's labels fit 37°; strings stay exact.
- "Push here" sits just in front of its port (6 cm to the right would cover the neighbouring 4 cm-apart
  port and its label). "Resolved" sits beside the kink ring; the reason text above-behind it.
- Overlapping 6 cm port targets (ports are 4 cm apart) resolve to the port centre nearest the ray.

## Things the screenshots / CI caught

- Labels hidden behind the mannequin → overlay UI draws on top (as on an additive display).
- Two-line labels clipped → WebGL2 textures are immutable; a fresh texture per text change.
- "✓ Compatible" collided with "Push here" → button moved in front of the port.
- CI-only failure: syringe labels overlapped with CI's wider fallback font → bundled Inter for
  deterministic metrics, labels split left/right, layout test now adds a 25 % width margin.
- CI-only failure: live clock lagged on a slow GPU → lens time follows the wall clock; only camera
  motion is clamped.
- Kink ring, reason and Resolved overlapped when seen from above → reason moved away from the viewer;
  new geometry test from three standing positions.
- Chip pinch target sat on the scaled text object → separate unscaled target.

## Nov 4 — in Lens Studio 5.24.1 (Claude Code + Lens Studio MCP, local session)

| PR | What |
|---|---|
| #14 | Lens code checked against Snap's CLAD references. Five fixes: Text size is em-square (size / 43.886 cm), so the calibration went from 0.05 to 0.0228; overflow so zero-width rects don't wrap per glyph; collider `fitVisual` set after `shape`; LowLatency audio; hit-point fallback. Added the LEAF suite. |
| #15 | The repo becomes the Lens Studio project; LEAF 10/10 in the preview; the demo film. |

What happened in Lens Studio, through the MCP (`RecompileTypeScriptTool`, `scene-graphql`, `asset-graphql`,
`InstallLensStudioPackage`, `run_leaf_scenario`, `MovePreviewCamera`, `CapturePanelScreenshotTool`):
- **First compile in real Lens Studio:** all of `Assets/Lumen/Core` and `Assets/Lumen/Lens` compiled with **zero errors**.
  The only errors were the LEAF imports before LEAF was installed.
- **LEAF version:** LEAF 4.0 imports `InteractionKit.lspkg`, the SPECS 27-era kit for Lens Studio 5.25. The 5.24 Base Template
  ships SIK 2.0 (`SpectaclesInteractionKit.lspkg`), so LEAF **2.0.2** is the matching version.
- **Scene wiring via GraphQL:** a `Lumen` object with `LumenLens`, plus Unlit and Simple PBR materials, the camera and 7 sounds;
  a `LeafIndex` object.
- **Found in the preview, fixed:**
  - the PBR preset has no `baseColor`, so everything was grey. Switched to Simple PBR.
  - The default base texture is a centimetre grid, which made the tubes look dashed (their UVs run in cm). A cleared texture
    renders magenta, so a 4×4 white texture replaced it.
  - Template lights overexposed the whites: ambient lowered to 0.35, directional to 0.85.
  - White text on a white bedside was hard to read: Lens text now has a near-black outline. Black is transparent on the
    additive display, so on glasses the outline disappears. The stand-in cart became steel grey and the bed less white.
  - The on-cart demo-data label is gone (the README keeps a disclaimer).
- **LEAF:** all 10 scenarios pass in the preview, and the in-preview self-test prints `10/10 pass`. LEAF's IK avatar
  found a real layout fact: the cart is 94° off-axis, a body turn rather than a head turn (see `leaf-results.md`).
- **Lens Studio tooling notes:**
  - The MCP runtime-inspect tool auto-installs a helper package built for InteractionKit 4.0, which broke compilation.
    It was removed.
  - Lens Studio rewrites `tsconfig.json` and `.gitattributes` (LFS rules). CI now uses `tsconfig.core.json`, and
    `.gitattributes` overrides LFS, so clones and CI need nothing extra.
- **CLAD:** the `ls-clad` plugin is enabled for the project. A separate Claude Code run used CLAD's LEAF workflow and
  verify-preview against the open project; its report is `devpost/clad-verification.md`.
- **Demo film:** recorded in the real preview, with only the Lens Studio window captured. The pinches are a LEAF scenario
  through the real SIK interactables, and the camera is driven by `MovePreviewCamera`. The cut is described in `VIDEO.md`.

## Still to do (needs you)

1. Run `plan-lens` yourself and commit `devpost/design-brief.md` with `status: approved`.
2. Upload `devpost/demo/lumen-demo.mp4` to YouTube (Public), then put the link in the README and on Devpost.

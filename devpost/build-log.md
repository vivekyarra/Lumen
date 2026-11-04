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

## Still to do in Lens Studio (needs the app)

1. Create the SPECS Base Template project in this folder and wire `LumenLens` (LENS_STUDIO_SETUP.md
   steps 1–2, or through CLAD + MCP, step 6). Record what CLAD changed here.
2. Calibrate text size once (step 4). Run the self-test (step 5) and fill the Lens Studio column of
   `leaf-results.md`.
3. Run `plan-lens` yourself and commit `devpost/design-brief.md` with `status: approved`.

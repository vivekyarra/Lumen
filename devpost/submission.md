# Devpost submission text (draft — edit into your own voice)

**Name:** Lumen

**Tagline:** The right line, the safe port, where you look.

**What it does:**
Lumen is a Lens for SPECS for ICU nurses. When a nurse picks up a syringe, every IV port on the patient
turns green or red, with the reason right on the port. Pinch any port and its whole line lights up
through the tangle to its pump and bag. Pinch a red port and Lumen points to the nearest safe one.
Push, and the Lens goes quiet. If a pump alarms out of view, a sound and an arrow lead the nurse to it,
and the line glows to the kink.

**Who it's for:**
ICU and critical-care nurses who give IV drugs many times per shift, often with gloved hands, to
patients with many tangled lines. Also new and float nurses who don't know the patient's lines yet.

**Why glasses:**
It uses what you see (the port you look at), draws on the real equipment (the line lights up where it
is), and keeps your hands free (gloves on, syringe in hand).

**How I built it:**
I planned the Lens with the Devpost Learn `plan-lens` skill, which wrote my design brief. My coding agent (Claude Code
with Snap's CLAD plugin) built it as a real Lens Studio 5.24.1 SPECS project through the Lens Studio MCP. It created
the project, installed LEAF, wired the scene, set the materials, lights and sounds, compiled, and ran the tests. The
Lens is generated at runtime from one shared TypeScript core (data, state machine, layout, meshes, sounds) by a single
component. Snap's LEAF tests pinch the Lens's real SIK interactables: all 10 scenarios pass in the Lens Studio preview.
The same done criteria also run on the state machine and on a browser twin in CI. Barcode scanning, line recognition and
pump data are stand-ins in the preview.

**What I learned:** (rewrite as your own three)
- The hard part is not the code; it is deciding when the Lens should be quiet.
- Put information on the thing it's about: a label on the port beats a panel in the air.
- Fake the sensing, build the response for real.

**Built with:** Lens Studio, SPECS, CLAD, Lens Studio MCP, LEAF, Spectacles Interaction Kit, TypeScript,
Claude Code, Three.js, Playwright.

**Links:** https://github.com/vivekyarra/Lumen · web twin https://vivekyarra.github.io/Lumen/ · YouTube video (public, add after upload)


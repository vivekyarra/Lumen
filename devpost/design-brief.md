---
status: approved
---

# Design brief: Lumen

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

Exact text strings, data, states, sizes, sounds and timing live in the code (`Assets/Lumen/Core/`: `LumenData.ts`, `Strings.ts`, `LumenLayout.ts`, `LumenState.ts`). This brief is the design; the code is the reference.

## The one spatial moment
An ICU nurse at the bedside picks up a syringe of furosemide. The four IV ports on the patient turn green ✓ or red ✕ right where they sit. Pinching a port lights its own tangled line all the way to its pump. A red port points to the safe Distal port, where "Push here" confirms the drug, and then the Lens goes quiet.

Second beat (kept on purpose, because it's the only part that shows the edge arrow): a few seconds after the push, Pump 2 alarms out of view. An edge arrow points to it, and its line glows amber down to the kink.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: a phone needs a free hand and shows a picture of the tangle. Lumen lights up the real tangle, keeps gloved hands on the syringe and keeps the nurse's eyes on the patient, with no trip to a computer for the compatibility chart.

## Product or overlay
- Type: overlay. It responds to real lines, pumps and a real syringe.
- What the real version would sense: the syringe's barcode, the physical tubes, live pump data, and a licensed compatibility database.
- In the preview: a virtual ICU bedside at real size. Pinching a 3D syringe on the cart counts as the barcode scan. Line paths, pump data and the compatibility table are sample data in one data file. The alarm fires 4 s after the first confirmed push.

## Where things live
- Where the user is looking during the main task: down at the central-line hub on the patient's neck. The cart and the pumps are deliberately out of view from here.
- User start: standing at the patient's right side, facing the bed, eye height about 165 cm.
- Central-line hub (Ports A Distal, B Medial, C Proximal, 4 cm apart): about 0.8 to 1.0 m from the eyes, below eye level.
- Port D (peripheral IV): on the patient's far (left) forearm.
- Bedside cart with 2 syringes: at the head of the bed, to the user's left, about one body turn from the hub. Top at 95 cm (default).
- IV pole with 4 bags (180 to 195 cm up) and 4 pumps (95 to 150 cm up): at the head end, far side of the bed.
- Port markers and labels: on the port, with the label 5 cm above it and facing the user. Capital letters about 1.8 cm tall, 6 words at most.
- "Push here" button: 9 × 4 cm, 6 cm to the right of the focused port.
- "Resolved" button: 9 × 4 cm, 6 cm above the kink ring.
- Bed, patient and tangle sizes and positions: as in `Assets/Lumen/Core/LumenLayout.ts`. The patient is an abstract mannequin with no face features.

## Hands and input
- Pick up / put down a syringe: pinch the syringe on the cart.
- Trace a line: pinch a port.
- Confirm: pinch "Push here" (green ports only).
- Clear the alarm: pinch "Resolved".
- Pinch only. Targets are big and highlight when aimed at: ports have a 6 cm hit sphere, syringes a 15 × 5 cm hit box.
- Voice: none.

## When things show
- Port dots: always, faint (1 cm, 30% opacity).
- Green / red markers: show when a syringe is picked up, hide when it's put down or after a confirmed push.
- Line glow: shows when its port is pinched, hides after 8 s without a syringe, or on the next pinch.
- Words on the red ports follow her head, recomputed every frame (progressive disclosure):
  - From across the room: only the ✓ / ✕ rings. No words.
  - At a working distance: the port nearest the centre of her view adds its reason, for example "Midazolam". Its neighbours 4 cm away stay quiet.
  - Leaning in, closer than 80 cm: every red port says why.
  - Pinch: the full answer, "Midazolam — do not push here".
  New words pop in over 0.18 s. The rings never hide while a syringe is in hand.
- Redirect arrow: shows when a red port is pinched, pointing to the nearest green port, labelled "Use Distal ✓".
- "Push here": shows only on a pinched green port.
- Log line: shows after a confirmed push, for 10 s.
- First-time hint "Pick up a syringe to check ports.": shows once at start, for 6 s.
- If something needs attention out of view: a two-tone alarm from Pump 2, plus an amber edge arrow at the side of the view pointing to it.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Quiet at start: only faint dots on the four ports. No markers, no glows, no buttons.
2. Pick up furosemide: the cart says "Holding: Furosemide 40 mg". Ports A and D turn green ✓, B and C turn red ✕ with "Midazolam" and "Dobutamine". Switching to morphine turns all four green.
3. Pinch any port: only its own line lights up, all the way to the right pump, with the pump's label.
4. Pinch a red port: "do not push here", no Push button, and an arrow pointing to the safe Distal port. Pinch Distal: "Push here". Pinch that: a log line appears, and the Lens goes quiet within 2 seconds.
5. Alarm: a few seconds after the push, Pump 2 turns amber. An edge arrow points to it if it's out of view, and the line glows amber to the kink. "Resolved" clears it all.
6. Detail follows attention: holding furosemide, the red ports show no words from across the room. Looking at B shows "Midazolam" on B only. Looking at C moves the word to C. Leaning in shows both. A pinch shows the full answer wherever she looks.

## Out of scope
- Voice commands, two-hand or custom gestures, hand poses.
- Real camera vision, SnapML, barcode reading.
- Saving anything between sessions; two users / Connected Lenses.
- Any real patient, any face, any recording of people.
- Dose calculation, drug ordering, EHR charting.
- A floating menu, settings screen or dashboard.
- More than 2 syringes or more than 4 lines.

## Risks and open questions
- Scope: two moments (syringe check + pump alarm) instead of one. The learner kept the alarm because it's the only beat that shows the edge arrow. Build the syringe check first; add the alarm only once criteria 1 to 4 pass.
- Clinical data: drug, rate and compatibility data is sample data for the preview; a licensed compatibility database is the production source.
- Cart placement: the cart is a body turn away from the hub, so the "Holding" chip and the log line on the cart are out of view while the user looks at the ports. The learner chose this placement.
- To confirm on real glasses: whether pinching tiny ports 4 cm apart works with real gloved hand tracking; whether markers on the real tangle read clearly at the bedside; how much alarm and chime is too much over a 12-hour shift.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build each preview input exactly as described above, and keep it clear in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "confirm on glasses" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

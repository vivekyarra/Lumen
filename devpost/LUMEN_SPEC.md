# LUMEN — Complete Project Spec

**An AR Lens for SPECS that helps ICU nurses find the right IV line and the safe port before they give a drug.**

Hackathon: **Learn AR with SPECS** (Devpost Learn)
Spec version: 1.0 · Written: Nov 4, 2026
Status: Ready to build

> Read this file from top to bottom one time. After that, use it as a checklist. Every decision is already made here. If something is not written here, use the rule in **Section 19: When in doubt**.

---

## 0. Lumen in 5 lines (simple English)

1. Lumen is an AR Lens for nurses in an ICU.
2. A patient has many IV lines, and the lines tangle.
3. Before the nurse gives a drug, the Lens shows each port as green or red. Red means the drug in the syringe is not safe with the drug in that line.
4. When the nurse pinches a port, the Lens lights the full line from the port to its bag and pump.
5. The nurse then gives the drug in a green port, and the Lens goes quiet.

---

## 1. Project at a glance

| Item | Decision |
|---|---|
| Name | **Lumen** |
| Tagline | "Which line is this, and is it safe? Answered where you look." |
| Platform | Snap SPECS, built and demoed in the **Lens Studio preview** (no glasses needed) |
| Lens Studio version | **5.23.2** (use 5.24.x only if you can sign in to the developer platform with it) |
| Builder | Your coding agent (Claude Code recommended) + **CLAD** plugin + **Lens Studio MCP** |
| Planning | Devpost Learn skill pack, `plan-lens` skill → `devpost/design-brief.md` |
| Testing | **LEAF** tests, one or more per done criterion |
| User | ICU / critical-care nurse at the bedside |
| Core moment | Holding a syringe → ports turn green/red → pinch a port → its line lights to bag and pump → "Push here" → Lens goes quiet |
| Second moment | A pump alarms out of view → chime + arrow → the alarming line glows amber to the kink |
| Interaction | **Pinch only** (mouse click in preview). No voice, no custom gestures |
| Data | Hard-coded demo data. Labeled "Demo data — not for clinical use" |
| Deliverables | Public GitHub repo (Lens Studio project + `devpost/` folder), public YouTube video under 3 min, Devpost description |

---

## 2. Hackathon rules and how Lumen meets each one

| Rule (from the Devpost page) | How Lumen meets it | Proof |
|---|---|---|
| New project, started during the submission period | Create a new SPECS Base Template project now. No old code. | Git history starts after Oct 15, 2026 |
| Planned with the skill pack | Run `plan-lens`. It writes `devpost/design-brief.md`. | `devpost/design-brief.md` in repo, `status: approved` |
| Built with CLAD | The coding agent builds through the CLAD plugin and Lens Studio MCP | README "How it was built" section + CLAD/LEAF output in `devpost/` |
| Runs in the Lens Studio preview | All done criteria are checkable in the preview | Demo video is a screen recording of the preview |
| Demo video, public on YouTube, under 3 min | Script in Section 13 is 2:40 | YouTube link in README and Devpost |
| Public repo with project files + `devpost/` folder | Section 14 | Repo is public |
| Short description: what, who, what you learned | Section 15 has the full text | Devpost form |

**Key dates (check the Devpost page for exact times in your timezone):**

- **Thu Nov 5, 12 PM ET** — SPECS Live Review. Post your work-in-progress in the Devpost Discord channel `#devpost-learn-feedback`, tagged **"Learn AR with SPECS"** and **"Will It Ship"**, to get reviewed live.
- **Deadline:** about **Mon Nov 9, 2026** (another entrant's repo lists 3 PM America/Denver). **Confirm on the Devpost page.** Plan to submit 24 hours early.

---

## 3. The problem

An ICU patient often has several IV infusions running at the same time. Each drug comes from a **bag**, goes through an **infusion pump**, and flows down a **tube (line)** into a **port** on the patient: one channel (lumen) of a central line in the neck, or a peripheral IV in the arm. The tubes hang, cross, and tangle. Nurses call this "spaghetti."

Many times per shift, a nurse holds a syringe and must answer two questions before giving the drug:

1. **Which line is which?** They trace the tube with their fingers from the port, over the bed rail, up to a pump, and read a tape label.
2. **Is my drug compatible with what is already flowing in this port?** Some drugs react when they mix in the line (Y-site incompatibility). They can form a solid or lose effect. Nurses check a compatibility chart or database, often on a computer away from the bed.

This takes time, it pulls the nurse's eyes and hands away from the patient, and mistakes are possible when the nurse is busy, tired, or new to the patient. Wrong-line and incompatible-drug errors are a known category of IV medication error.

> Before you put any statistic in the video or pitch, check it with a real source (for example ISMP, the Institute for Safe Medication Practices). This spec does not quote numbers on purpose.

---

## 4. Who it is for

**Primary user: Maya, ICU nurse, 4 years' experience.**
- Cares for 1–2 critically ill patients per 12-hour shift.
- Wears gloves most of the time. Often holds a syringe in one hand.
- Already traces lines by hand and reads tape labels. Already knows compatibility is a risk.
- Wants: speed, certainty, and to keep her eyes on the patient.
- Does not want: menus, typing, a floating screen, alerts that never stop.

**Secondary users:**
- New-graduate and float nurses who do not know this patient's lines.
- Nurse educators who teach line safety.

**Buyers (for the investment story, Section 18):** hospitals (patient-safety and nursing budgets), and infusion-pump makers as partners.

---

## 5. Why this needs glasses (not a phone or laptop)

Lumen uses **all three** strengths the hackathon video teaches:

| Strength | In Lumen |
|---|---|
| **It shares your view** | The nurse looks at a port. Lumen answers about *that* port. |
| **It draws in the world** | The line lights up along the real tube, through the tangle, to the real pump and bag. Green/red markers sit *on* the ports. |
| **It leaves your body free** | Gloved hands stay on the syringe. Eyes stay on the patient. No computer trip. |

It also follows the **four habits** from the skill pack's design rules:

| Habit | In Lumen |
|---|---|
| Put information on the thing it's about | Markers on ports, labels on pumps and bags. **No floating panel.** |
| Show it when needed, then get out of the way | Quiet until a syringe is picked up or a port is pinched. Fades after the push. |
| A few big targets, pinch is the new tap | Only pinch. Big "Push here" button. Large invisible hit areas on ports. |
| Keep it where they're already looking | Everything is at the bedside. If a pump alarms out of view: chime + edge arrow. |

**Why worse on a phone:** a phone needs a free hand, needs to be held up, and shows a picture of the tangle instead of lighting the real one.

---

## 6. The spatial moment (the story the video is built around)

Maya walks up to the bed. She sees the patient, the pole, four pumps, four bags, and the tangle of tubes. **The Lens shows almost nothing.** Only faint small dots on the four ports.

She picks up the furosemide syringe from the bedside cart. A soft tick. A small chip next to the syringe says **"Holding: Furosemide 40 mg."** At once, each port gets a marker: two green rings with a check, two red rings with an X. Next to each red port is one short word: **"✕ Midazolam"**, **"✕ Dobutamine."**

She pinches the red port on the central line. The line lights up cyan, all the way over the bed rail and up to Pump 1, where a label says **"Midazolam · Pump 1."** A cyan arrow points to the nearest green port: **"Use: Distal (Heparin) — compatible."**

She pinches the green distal port. Its line lights to Pump 3 (Heparin). A big button appears next to the port: **"Push here."** She pinches it. A green pulse, a soft chime, a small log line: **"Furosemide 40 mg → CVC Distal · 10:42."** Then everything fades. The Lens is quiet again.

Four seconds later, a two-tone alarm sounds from the left. Pump 2 is out of her view. An amber arrow at the edge of her view points left. She turns. Pump 2 glows amber: **"Downstream occlusion."** Its line glows amber down to the bed rail, where a pulsing ring marks the kink: **"Check here: kinked line."** She pinches **"Resolved."** The amber fades.

---

## 7. Scope

### 7.1 In scope (must build)

1. Virtual ICU bedside at real size (bed, patient mannequin, IV pole, 4 bags, 4 pumps, 4 lines, 4 ports, bedside cart with 2 syringes).
2. Quiet idle state.
3. Pick up / put down a syringe (stand-in for barcode scan).
4. Compatibility markers on all ports (green ✓ / red ✕ + one word).
5. Line trace: pinch any port → its line lights from port to pump to bag, with labels.
6. Redirect: pinching a red port shows an arrow to the nearest green port.
7. "Push here" on green ports only → confirm → log line → fade to quiet.
8. Pump alarm beat: chime, edge arrow if out of view, amber line to the kink, "Resolved" button.
9. A "Demo data — not for clinical use" label on the cart.
10. Spatial sound cues.
11. LEAF tests for every done criterion.

### 7.2 Stand-ins (because the preview cannot sense the real world)

| Real product would… | In the preview Lumen… |
|---|---|
| Scan the syringe barcode with the camera | Pinch a 3D syringe on the cart ("pick up") |
| See and follow real tubes with computer vision | Uses hard-coded line paths in the scene |
| Get drug names and rates from connected pumps / EHR | Uses hard-coded data in one data file |
| Use a licensed compatibility database | Uses a small hard-coded table (demo data) |
| Detect a real pump alarm over the network | Fires the alarm 4 s after the first confirmed push (plus a debug key) |

### 7.3 Out of scope (do NOT build)

- Voice commands. (May not work in the preview.)
- Two-hand gestures, custom gestures, hand poses.
- Real camera vision, SnapML, barcode reading.
- Saving anything between sessions.
- Two users / Connected Lenses.
- Any real patient, any face, any recording of people.
- Dose calculation, drug ordering, EHR charting.
- A floating menu, settings screen, or dashboard.
- More than 2 syringes, more than 4 lines.

---

## 8. Experience spec (exact details)

### 8.1 Units and directions

- Lens Studio uses **centimeters**. All sizes below are in cm.
- Positions are given from the **user's start point on the floor**: `right` (+ = to the user's right), `forward` (+ = away from user), `up` (+ = up from the floor). The coding agent converts these to Lens Studio coordinates.
- Assume eye height about **165 cm**.
- If the preview's floor or start height differs, keep the **relative** layout and keep the central-line port about **0.8–1.0 m** from the eyes and below eye level.

### 8.2 Scene layout

The user starts standing at the **patient's right side**, facing the bed. The patient's **head is to the user's left**.

| Object | Size | Position (right, forward, up) | Notes |
|---|---|---|---|
| Hospital bed | 210 long × 95 wide; mattress top at 70 | Center (0, 117, 0); long side runs left–right | Simple shapes. Side rails 30 high on both sides. Light grey. |
| Patient mannequin | Adult size, lying on back | On mattress, head at right = −85 | **Abstract, low detail, no face features.** Light blue gown. Not a real person. |
| Central line (CVC) hub | 3 small connectors fanned out | Right side of patient's neck, about (−70, 85, 82) | 3 ports: **A Distal**, **B Medial**, **C Proximal**. 4 cm apart. |
| Peripheral IV (PIV) | 1 connector | Patient's left forearm (far side), about (−10, 150, 78) | **Port D**. |
| IV pole | 200 tall, 5 cm pole, wheeled base | Head end, far side: (−125, 170, 0) | |
| Bags 1–4 | 15 × 25 each | On pole hooks, up 180–195 | Labeled on the bag face. |
| Pumps 1–4 | 20 wide × 12 high × 15 deep each | Stacked on pole, up 95–150, screens facing the user | Small screen shows rate. |
| Bedside cart (tray) | 50 × 40, top at 95 | (70, 35, 0) — at the user's right, between user and bed | Holds 2 syringes and the demo-data label. |
| Syringes | 12 long, 2 cm diameter | On the cart, 15 cm apart | Each has a printed label on the barrel. |

**Line paths (tubes):** each tube is a smooth curve from pump bottom → down and across the head end of the bed → over the near or far bed rail → to its port. Tube diameter 0.5 cm, but **hit area** (for pinch) is bigger, see 8.6.
- Lines 1, 2, 3 go to the CVC hub. **Line 2 and Line 3 cross each other once** over the head of the bed (the "tangle").
- Line 2 has a **visible kink** (sharp bend) where it goes over the near bed rail at about (−60, 70, 100). This is used by the alarm beat.
- Line 4 goes along the far side of the bed to the left forearm (Port D).
- Tubes droop a little (not straight lines).

**Field-of-view rule:** SPECS sees about 37° × 32°. From the start position the user can see the **CVC hub and the cart together** when looking down-left. The pumps are **outside the view** when the user looks at the hub. This is on purpose (it makes the edge arrow useful).

### 8.3 Demo data (one data file, no other source)

> All data below is **invented demo data for a hackathon prototype**. It is not checked for clinical use. Show the label **"Demo data — not for clinical use"** on the cart at all times.

**Lines**

| Line | Bag | Pump | Rate (on pump screen) | Port |
|---|---|---|---|---|
| 1 | Midazolam 100 mg / 100 mL | Pump 1 | 3 mL/h | **B — CVC Medial** |
| 2 | Dobutamine 250 mg / 250 mL | Pump 2 | 5 mcg/kg/min | **C — CVC Proximal** |
| 3 | Heparin 25,000 units / 250 mL | Pump 3 | 12 mL/h | **A — CVC Distal** |
| 4 | Sodium chloride 0.9% 1000 mL | Pump 4 | 75 mL/h | **D — PIV left forearm** |

**Syringes on the cart**

| Syringe | Label |
|---|---|
| S1 | Furosemide 40 mg |
| S2 | Morphine 2 mg |

**Compatibility table (demo)**

| Syringe ↓ / Line drug → | Midazolam (B) | Dobutamine (C) | Heparin (A) | NaCl 0.9% (D) |
|---|---|---|---|---|
| Furosemide 40 mg | ✕ Incompatible | ✕ Incompatible | ✓ Compatible | ✓ Compatible |
| Morphine 2 mg | ✓ Compatible | ✓ Compatible | ✓ Compatible | ✓ Compatible |

Why two syringes: S1 shows the red/green logic. S2 shows that the Lens stays calm when everything is safe (all green). This proves the colors come from data, not from fixed art.

**Nearest compatible port rule:** for a red port, point to the green port with the shortest straight-line distance from the red port. Ties: prefer a port on the same catheter.
- From B (red, Furosemide) → **A (Distal)**.
- From C (red, Furosemide) → **A (Distal)**.

**Alarm data**

| Pump | Alarm text | Kink location |
|---|---|---|
| Pump 2 (Dobutamine, Line 2) | "Downstream occlusion" | Line 2 at near bed rail, about (−60, 70, 100) |

### 8.4 States

```
IDLE ──pick up syringe──▶ HOLDING
 ▲  │                       │  ▲
 │  └──pinch port──▶ TRACE  │  └── put down syringe (back to IDLE)
 │       (any state)        │
 │                    pinch port
 │                          ▼
 │                   HOLDING + PORT_FOCUS (green or red)
 │                          │ (green only) pinch "Push here"
 │                          ▼
 └────fade 1.5 s──────  CONFIRMED

ALARM is a separate layer. It can start in any state and does not cancel the others.
```

| State | What the user sees |
|---|---|
| **IDLE** | Scene only. Each port has a faint dot (1 cm, 30% opacity). Cart shows the demo-data label. First time only: a hint on the cart for 6 s: "Pick up a syringe to check ports." |
| **TRACE** (no syringe) | Pinched port's line glows cyan from port to pump to bag. Label at the pump: drug · rate · pump number. Label at the port: port name. Pinch the same port again, or another port, or wait 8 s → trace ends. |
| **HOLDING** | Chip near the cart: "Holding: Furosemide 40 mg". All 4 ports show markers (green ✓ or red ✕). Red ports show the conflicting drug name. |
| **PORT_FOCUS (red)** | Line glows cyan to its pump/bag. Red port label: "✕ Midazolam — do not push here". Cyan arrow from this port to the nearest green port with label "Use: Distal (Heparin) — compatible". **No Push button.** |
| **PORT_FOCUS (green)** | Line glows cyan to pump/bag. Big **"Push here"** button next to the port. |
| **CONFIRMED** | Green pulse on the port. Chime. Log line near the cart: "Furosemide 40 mg → CVC Distal · HH:MM". Syringe goes back on the cart. After 1.5 s all markers fade → IDLE. The log line stays 10 s, then fades. |
| **ALARM** | Two-tone sound from Pump 2. Pump 2 glows amber with "Downstream occlusion". If Pump 2 is out of view, an amber arrow sits at the edge of the view pointing to it. Line 2 glows amber from pump to the kink. Pulsing amber ring at the kink: "Check here: kinked line". Button at the kink: **"Resolved"**. Pinch → amber fades, sound stops. |

### 8.5 Rules for each interaction

| Action (preview: mouse click = pinch) | Result |
|---|---|
| Pinch a syringe on the cart | Picks it up. If another is held, swap to this one. |
| Pinch the held syringe chip or the same syringe again | Puts it down → IDLE. |
| Pinch a port in IDLE | TRACE for that port. |
| Pinch a port in HOLDING | PORT_FOCUS for that port. Only one port focused at a time. |
| Pinch "Push here" | CONFIRMED. |
| Pinch "Resolved" | Ends ALARM. |
| Pinch empty space | Nothing. |

**Alarm trigger:** 4 s after the **first** CONFIRMED in the session. Only once per session. Also a debug trigger (keyboard key **`A`** or a hidden test hook) for LEAF tests. The debug trigger must **not** be visible in the video.

### 8.6 Visual design

**Display is additive (black = invisible).** Never use dark or black content. Use bright colors on transparent.

| Element | Look | Size |
|---|---|---|
| Tubes (default) | Light grey, slightly translucent | 0.5 cm diameter |
| Trace glow | **Cyan** `#3FE0FF`, with a soft dot flowing toward the patient (direction of flow), 1 loop per 1.5 s | Glow 1.2 cm wide |
| Compatible marker | **Green** `#3DFF7A` ring + **✓** icon | Ring 4 cm diameter |
| Incompatible marker | **Red** `#FF4D4D` ring + **✕** icon | Ring 4 cm diameter |
| Alarm | **Amber** `#FFB020` | Pump outline + line glow + 6 cm pulsing ring at kink |
| Idle dot | White, 30% opacity | 1 cm |
| Arrow to green port | Cyan, curved, from red port to green port | 1 cm thick |
| Edge arrow (out of view) | Amber chevron at the view edge | 4 cm at 1 m |

**Never use color alone.** Green always has ✓, red always has ✕, amber always has text. (Color-blind users.)

**Text**

| Text | Where | Height |
|---|---|---|
| Port labels, red reason, "Use: …" | Next to the port, 5 cm above it, facing the user | Capital letters about 1.8 cm |
| Pump labels | On the front of the pump | About 2.5 cm |
| Bag labels | On the bag | About 2.5 cm |
| Holding chip, log line, hint, demo-data label | On / above the cart | About 1.8 cm |

- Labels always face the user (billboard) and stay upright.
- Font: the default UIKit font. White or the state color.
- Max 6 words per label.

**Buttons**

| Button | Size | Where |
|---|---|---|
| Push here | 9 × 4 cm, green outline, white text | 6 cm to the right of the focused port, slightly toward the user |
| Resolved | 9 × 4 cm, amber outline | 6 cm above the kink ring |

**Hit areas (forgiving targets):** ports 6 cm sphere, syringes 15 × 5 cm box, pumps not pinchable.

### 8.7 Sound

All spatial (comes from the object's position). Short and soft. CLAD can generate them.

| Event | Sound | From |
|---|---|---|
| Pick up syringe | Soft tick | Cart |
| Markers appear | Soft rising two-note | Cart |
| Focus red port | Low double "dum-dum" | That port |
| Focus green port | Light single note | That port |
| Confirm push | Warm chime | That port |
| Pump alarm | Two-tone repeating beep, every 1.2 s, until resolved | Pump 2 |
| Resolved | Short falling tone | Kink |

### 8.8 Exact text strings (use these words)

```
Pick up a syringe to check ports.
Holding: Furosemide 40 mg
Holding: Morphine 2 mg
Demo data — not for clinical use
✕ Midazolam — do not push here
✕ Dobutamine — do not push here
✓ Compatible
Use: Distal (Heparin) — compatible
Push here
Furosemide 40 mg → CVC Distal · HH:MM
Morphine 2 mg → <Port name> · HH:MM
Downstream occlusion
Check here: kinked line
Resolved
Port A · CVC Distal
Port B · CVC Medial
Port C · CVC Proximal
Port D · PIV L forearm
Midazolam · 3 mL/h · Pump 1
Dobutamine · 5 mcg/kg/min · Pump 2
Heparin · 12 mL/h · Pump 3
NaCl 0.9% · 75 mL/h · Pump 4
```

### 8.9 Timing

| Thing | Time |
|---|---|
| Markers appear after pick-up | ≤ 0.3 s, fade in 0.3 s |
| Trace glow appears | ≤ 0.3 s |
| TRACE auto-ends (no syringe) | 8 s |
| First-time hint | 6 s |
| CONFIRMED → IDLE fade | 1.5 s |
| Log line stays | 10 s |
| Alarm after first confirm | 4 s |

---

## 9. Technical design

### 9.1 Tools and versions

- Lens Studio **5.23.2** (SPECS → Base Template).
- Node.js (LTS) and Git.
- Coding agent that supports skills: **Claude Code** recommended.
- **Lens Studio MCP** (`lens-studio` server) connected.
- **CLAD** plugin (`ls-clad`) installed. CLAD agents you will see: `specs-experience-builder`, `verify-preview`, `specs-leaf-...`.
- **Spectacles Interaction Kit (SIK)** for pinch/interactables, **UIKit** for buttons and text. (Both come with the SPECS Base Template / CLAD setup.)
- Language: **TypeScript** components.

### 9.2 Components (suggested names — CLAD may choose its own; that is fine)

| Component | Job |
|---|---|
| `LumenData.ts` | All demo data from 8.3: lines, ports, syringes, compatibility table, alarm. **Only place** with data. |
| `LumenState.ts` | State machine from 8.4. Single source of truth. Sends events. |
| `CompatibilityEngine.ts` | `check(syringe, port) → compatible | incompatible + conflictingDrug`; `nearestCompatible(port, syringe)`. Pure logic, no visuals. |
| `PortMarker.ts` | One per port. Shows idle dot / green / red / focused. Owns the port hit area. |
| `LineTracer.ts` | One per line. Holds the curve points. Shows cyan or amber glow and flow dot. |
| `SyringeTray.ts` | Cart, syringes, pick up / put down, holding chip, log line, hint, demo-data label. |
| `PushButton.ts` | The "Push here" button (UIKit). |
| `RedirectArrow.ts` | Arrow from a red port to the nearest green port. |
| `AlarmController.ts` | Alarm timer, debug trigger, amber visuals, edge arrow, "Resolved". |
| `EdgeArrow.ts` | Shows a chevron at the view edge when a target is out of view. |
| `AudioCues.ts` | Plays the spatial sounds in 8.7. |
| `SceneBuilder` (if needed) | Builds bed, mannequin, pole, bags, pumps, tubes from primitives or generated models. |

**Rule:** visuals never decide logic. Visuals listen to `LumenState`. This keeps LEAF tests simple.

### 9.3 Models

- Use simple shapes or CLAD-generated models. Clean, light, clinical colors.
- Mannequin: abstract, smooth, no face details.
- Tubes: build as a tube mesh along curve points, or a chain of short cylinders. The glow is a second, wider, emissive tube along the same curve.

### 9.4 Project folder (what the repo looks like)

```
lumen/                         ← the Lens Studio project folder = the repo root
├── Lumen.esproj               (name may differ; created by Lens Studio)
├── .mcp.json                  (created by setup)
├── Assets/                    (Lens Studio assets, scripts, models, sounds)
├── Packages/                  (SIK, UIKit, etc.)
├── devpost/
│   ├── design-brief.md        ← written by plan-lens (required)
│   ├── LUMEN_SPEC.md          ← this file
│   ├── leaf-results.md        ← LEAF pass/fail list (you create)
│   ├── build-log.md           ← short notes: prompts you gave CLAD, what changed
│   └── screenshots/           ← 6–10 preview screenshots
├── README.md
└── .gitignore
```

`.gitignore`: ignore Lens Studio cache/temp folders (for example `Cache/`) and OS files (`.DS_Store`). **Test:** clone the repo into a new folder and open it in Lens Studio. It must open.

---

## 10. Build process — step by step

### Step 1 — Setup (30–60 min)
1. Install Lens Studio 5.23.2, Node.js, Git, Claude Code.
2. Follow the **Quick Start** on the Devpost Resources tab: https://learn-specs.devpost.com/resources
3. In Lens Studio: **SPECS → Base Template → File > Save As** → folder `lumen`.
4. Open a terminal **in that folder** (the one with `.esproj` and `.mcp.json`). Start Claude Code there, with Lens Studio open.
5. Install CLAD: https://developers.specs.com/docs/clad/setup/setup-ai/claude-code-setup
6. Check: `/mcp` shows `lens-studio` connected. `/plugin` lists CLAD.
7. Install the skill pack in the same folder:
   ```
   npx skills add challengepost/learn-specs --all -y
   ```
8. `git init`, first commit ("SPECS base template"), create the **public** GitHub repo, push.
9. Copy this file to `devpost/LUMEN_SPEC.md` and commit.

### Step 2 — Plan with `plan-lens` (20–30 min)

Say: **`Run the plan-lens skill.`**

The skill interviews you one question at a time. **Answer in your own words**, using the notes below. The skill is designed so that *you* make the decisions; that is part of the judging. If it pushes back once, listen, then keep the decision from this spec unless its reason is better.

| The skill asks about… | Your answer (in your words) |
|---|---|
| 1. The idea | A Lens for ICU nurses. Before giving a drug, show which IV port is safe for the drug in my hand, and light up any line from the port to its pump and bag. |
| 2. The spatial moment | I hold a furosemide syringe at the bedside. Ports turn green or red right on the patient's central line. I pinch a red one, its tube lights up to the Midazolam pump, and an arrow points me to the green distal port. I push there and the Lens goes quiet. Uses all three: shares my view, draws on the real tubes, keeps gloved hands free. Worse on a phone because I need a hand free and I'd see a picture, not the real tangle. |
| 3. Product or overlay | Overlay on real equipment. Recognition is faked: pinching a syringe on the cart stands in for scanning its barcode. Line paths and drug data are hard-coded. Everything after that is built for real. |
| 4. Where things live | Virtual ICU bed at real size in front of me; I stand at the patient's right side. Markers sit on the ports, labels on pumps and bags. Cart at my right hand. Main work area 0.8–1.0 m away, below eye level. Nothing floats in front of my face. |
| 5. Hands | Pinch only: pinch a syringe, pinch a port, pinch a big "Push here" button, pinch "Resolved". No voice, no custom gestures. |
| 6. When it shows | Almost nothing until I pick up a syringe or pinch a port. Markers on pick-up. Trace on pinch. Everything fades 1.5 s after the push. Pump alarm out of view: spatial two-tone sound plus an amber edge arrow; amber line leads to the kink. |
| 7. Done | Use the 8 done criteria in Section 11. |
| People and consent | No real people. Virtual mannequin with no face. No recording or identifying anyone. |

Then: read the brief it shows you. Check it against this spec (layout, data, text, done criteria). Ask for changes if anything is missing. Say "looks good" → `status: approved`. Commit: "Approved design brief."

### Step 3 — Build with CLAD (30–90 min, agent time)

1. `/clear` (fresh chat in the same folder).
2. Paste exactly:
   > Read devpost/design-brief.md and build it for SPECS. Follow the brief closely. Get the basic flow working first, then add detail. Write and run LEAF tests for each done criterion, and tell me which pass.
3. Then paste:
   > Also read devpost/LUMEN_SPEC.md. Use its Section 8 for exact layout, sizes, colors, data, text strings and timing, and Section 11 for the LEAF tests. Keep all demo data in one data file. If the brief and the spec disagree, follow the brief and tell me the difference.
4. Let it run. Do not interrupt for small things.
5. Commit after each working stage: "Scene built", "Markers working", "Trace working", "Push flow working", "Alarm working", "LEAF tests".

### Step 4 — Try it in the preview and iterate

Run the **Manual test script** (Section 12). For each problem, give CLAD one short **design note**. Good examples:

- "The red label at Port B overlaps Port C's label. Move each port label 5 cm up and spread them apart so none overlap from the start position."
- "The trace glow is hard to see against the grey bed. Make the glow 1.5 cm wide and brighter cyan."
- "The Push here button is hard to hit. Make the hit area 12 × 6 cm."
- "When I look at the CVC hub, I can't see Pump 2, but no edge arrow appears during the alarm. Fix the out-of-view check."
- "Markers appear before the pick-up sound. Play the sound first."

After each round: re-run LEAF tests. Commit.

### Step 5 — Video, README, submission
Sections 13, 14, 15. Then the final checklist (Section 20).

### Step 6 — Live review (optional but useful)
Before **Thu Nov 5, 12 PM ET**, post a screenshot or short clip in `#devpost-learn-feedback` on the Devpost Discord, tagged "Learn AR with SPECS" and "Will It Ship". Act on the feedback.

---

## 11. Done criteria and LEAF tests

Every criterion must **pass in the preview** and have **at least one LEAF test**. Record results in `devpost/leaf-results.md` like this:

```
| # | Criterion | LEAF test name | Result | Date |
|---|-----------|----------------|--------|------|
| 1 | Quiet idle | test_idle_is_quiet | PASS | Nov 6 |
```

| # | Done criterion (checkable in preview) | LEAF test should check |
|---|---|---|
| **DC1** | **Quiet idle.** At start, only faint dots on the 4 ports and the demo-data label are visible. No markers, no glows, no buttons. | After load: 4 idle dots visible; 0 green/red markers; 0 glows; Push and Resolved buttons hidden. |
| **DC2** | **Pick up shows markers.** Pinching the Furosemide syringe shows "Holding: Furosemide 40 mg", green ✓ on A and D, red ✕ on B and C with "Midazolam" and "Dobutamine". | Pinch S1 → chip text correct; A,D = compatible; B,C = incompatible; reason texts correct. |
| **DC3** | **Data, not art.** Switching to Morphine makes all 4 ports green. Putting the syringe down returns to quiet idle. | Pinch S2 → 4 compatible; pinch S2 again → state IDLE, markers hidden. |
| **DC4** | **Trace.** Pinching any port lights its own line (and only that line) to the correct pump and bag, with the correct pump label. Works with or without a syringe. | For each port A–D: pinch → only the matching line glows; pump label text matches 8.8. |
| **DC5** | **Redirect.** With Furosemide held, pinching red Port B shows "✕ Midazolam — do not push here", no Push button, and an arrow to Port A with "Use: Distal (Heparin) — compatible". | Pinch S1, pinch B → reason text; Push hidden; arrow target = A; arrow label text. |
| **DC6** | **Push and quiet.** With Furosemide held, pinching green Port A shows "Push here". Pinching it shows the log line and returns to quiet idle within 2 s. | Pinch S1, A, Push → log text "Furosemide 40 mg → CVC Distal · …"; after ≤ 2 s state IDLE, markers hidden. |
| **DC7** | **Alarm.** 4 s after the first push, Pump 2 alarms: amber pump, "Downstream occlusion", amber Line 2 to the kink, "Check here: kinked line", and an edge arrow if Pump 2 is out of view. "Resolved" clears it. | Trigger alarm (debug hook) → amber visuals on, alarm sound playing; with camera facing the hub, edge arrow visible; pinch Resolved → all amber hidden, sound stopped. |
| **DC8** | **Placement and comfort.** From the start position, the CVC hub, its labels and the cart are readable without walking; no labels overlap; nothing is closer than 40 cm to the eyes; no black/dark content. | Labels' screen-space boxes don't overlap at start pose; all UI ≥ 40 cm from camera. (Plus your manual check.) |

**Project is not done until DC1–DC8 all PASS** (or a failing test is honestly explained in `leaf-results.md` with a manual check that shows it works in the preview).

---

## 12. Manual preview test script (do this before recording)

Preview controls: **WASD** move, **Q/E** down/up, **mouse** look, **click** = pinch.

1. Reset the preview. Look around. → Only faint dots + demo-data label. ✅ DC1
2. Click Furosemide. → Tick, chip, 2 green, 2 red, reasons. ✅ DC2
3. Click Port B. → Cyan line to Pump 1 "Midazolam". Red text. Arrow to A. No Push button. ✅ DC4, DC5
4. Click Port C. → Line 2 to Pump 2, red "Dobutamine", arrow to A. Only one port focused.
5. Click Port A. → Line 3 to Pump 3 "Heparin". Push button. ✅ DC4
6. Click Push here. → Chime, log line, fade within 1.5 s. ✅ DC6
7. Wait 4 s while looking at the hub. → Alarm sound from the left, amber edge arrow. ✅ DC7
8. Turn left. → Pump 2 amber, "Downstream occlusion", amber line to kink, kink ring. Click Resolved. → All clear. ✅ DC7
9. Click Morphine. → All 4 green. Click Morphine again. → Quiet. ✅ DC3
10. With no syringe, click Port D. → Line 4 to Pump 4 "NaCl 0.9%". Wait 8 s → trace ends. ✅ DC4
11. Walk a little left and right. Labels stay readable, face you, don't overlap. ✅ DC8
12. Look for any dark or black content. → None. ✅ DC8

If any step fails → give CLAD a design note (Step 4) → retest.

---

## 13. Demo video (2:40, under the 3:00 limit)

Record the Lens Studio preview at 1080p. Hide debug UI. Speak calmly. Add your voice-over or on-screen text.

| Time | Picture | Words (voice-over) |
|---|---|---|
| 0:00–0:15 | Slow look across the virtual ICU bed, pole, pumps, tangled tubes | "This is an ICU bed. Four drugs, four pumps, one tangle. Before every push, a nurse has to answer two questions: which line is this, and will my drug react with what's in it?" |
| 0:15–0:30 | Close on the tubes crossing | "Today they trace tubes by hand and check a chart away from the bed. Lumen answers both, right where they look." |
| 0:30–0:50 | Pick up Furosemide → markers appear | "I pick up furosemide. In the real product, the glasses scan the barcode; here, a pinch stands in. Each port turns green or red, with the reason on the port." |
| 0:50–1:15 | Pinch red Port B → line lights to Pump 1 → arrow to A | "This port carries midazolam. Pinch it and the whole line lights up, through the tangle, to its pump and bag. Lumen points me to the nearest safe port." |
| 1:15–1:35 | Pinch A → Push here → log → fade | "Distal port, heparin: compatible. Push here. Logged. And the Lens goes quiet. It only shows up when I need it." |
| 1:35–2:00 | Alarm: sound, edge arrow, turn, amber line to kink, Resolved | "A pump alarms out of my view. A sound and an arrow turn me to it, and the line glows to the exact kink. Fixed." |
| 2:00–2:10 | Morphine → all green | "Different drug, different answer. The colors come from data, not from fixed art." |
| 2:10–2:30 | Quick cuts: plan-lens interview, design brief, CLAD building, LEAF results | "I planned Lumen with the Devpost Learn skill pack, and Snap's CLAD agents built it in Lens Studio. LEAF tests check every done criterion: eight of eight pass." |
| 2:30–2:40 | Title card: "Lumen — the right line, the safe port, where you look." + "Demo data — not for clinical use." | "Lumen. For the nurses who keep the lines straight." |

**Upload:** YouTube, visibility **Public**. Title: "Lumen — AR IV line tracer for ICU nurses (Learn AR with SPECS)". Put the repo link in the description.

---

## 14. README.md (required content)

Write the README with these sections:

1. **Title + one line:** "Lumen: an AR Lens for SPECS that shows ICU nurses which IV port is safe for the drug in their hand, and lights any line from port to pump."
2. **Demo video** link (YouTube) + 1 hero screenshot.
3. **The problem** (3–4 sentences, from Section 3).
4. **Who it's for** (Maya, Section 4).
5. **What it does** (the spatial moment, short).
6. **Why glasses** (the 3 strengths table, Section 5).
7. **How it was built:** plan-lens → `devpost/design-brief.md` → CLAD + Lens Studio MCP → LEAF tests. Lens Studio version.
8. **Stand-ins** (table from 7.2) — honest about what is faked.
9. **LEAF results** (link to `devpost/leaf-results.md`, "8/8 pass").
10. **How to open:** clone, open the `.esproj` in Lens Studio 5.23.2, press preview.
11. **What I learned** (3–5 bullets, your own).
12. **What's next** (Section 18 roadmap, short).
13. **Disclaimer:** "Hackathon prototype. Demo data only. Not a medical device. Not for clinical use."

---

## 15. Devpost submission text (draft — edit into your own voice)

**Name:** Lumen

**Tagline:** The right line, the safe port, where you look.

**What it does:**
Lumen is a Lens for SPECS for ICU nurses. When a nurse picks up a syringe, every IV port on the patient turns green or red, with the reason right on the port. Pinch any port and its whole line lights up through the tangle to its pump and bag. Pinch a red port and Lumen points to the nearest safe one. Push, and the Lens goes quiet. If a pump alarms out of view, a sound and an arrow lead the nurse to it, and the line glows to the kink.

**Who it's for:**
ICU and critical-care nurses who give IV drugs many times per shift, often with gloved hands, to patients with many tangled lines. Also new and float nurses who don't know the patient's lines yet.

**Why glasses:**
It uses what you see (the port you look at), draws on the real equipment (the line lights up where it is), and keeps your hands free (gloves on, syringe in hand).

**How I built it:**
I planned the Lens with the Devpost Learn `plan-lens` skill, which wrote my design brief. Snap's CLAD agents built it in Lens Studio through the Lens Studio MCP. I wrote LEAF tests for all 8 done criteria; all pass. Barcode scanning, line recognition and pump data are stand-ins in the preview.

**What I learned:** (write 3 real things, for example)
- The hard part is not the code; it is deciding when the Lens should be quiet.
- Put information on the thing it's about: a label on the port beats a panel in the air.
- Fake the sensing, build the response for real.

**Built with:** Lens Studio, SPECS, CLAD, Lens Studio MCP, LEAF, Spectacles Interaction Kit, UIKit, TypeScript, Claude Code.

**Links:** GitHub repo (public), YouTube video (public).

---

## 16. How Lumen scores on each judging criterion

| Criterion | What the judges look for | What Lumen shows | Proof in video / repo |
|---|---|---|---|
| **Design** | A complete, coherent product, not a tech proof | Full loop: quiet → pick up → check → trace → redirect → push → quiet, plus alarm. Real user, real workflow. | 0:30–2:00 of video; README |
| **Technical implementation** | Well built; good use of CLAD, Lens Studio, MCP | Data-driven logic (one data file), state machine, spatial audio, 8/8 LEAF tests, clean commits | `leaf-results.md`, `build-log.md`, commit history |
| **Innovation / idea** | Creative, different from existing concepts | No other entry (of ~100 SPECS projects checked) does clinical line safety. Uses all 3 glasses strengths. | Problem + "why glasses" in video |
| **Presentation** | Works end-to-end; clear problem, who, why it matters; easy to follow | 15-second hook, one clear story, honest stand-ins, under 3 min | Video script Section 13 |

---

## 17. Risks and what to do

| Risk | What to do |
|---|---|
| Lens Studio 5.24 sign-in fails | Use 5.23.2. |
| MCP or CLAD not connected | `/mcp`, `/plugin`; follow https://developers.specs.com/docs/clad/troubleshooting/troubleshoot-lens-studio-mcp |
| Tubes look like a mess | Ask CLAD for smooth curves with slight droop; keep only one crossing. |
| Labels overlap at the CVC hub | Spread ports 4 cm apart; stack labels with 3 cm gaps; offset left/right. |
| Glow not visible | Brighter cyan, wider glow, flow dot. |
| A LEAF test can't press something | Make sure every pinchable thing is a SIK Interactable; add a test hook. |
| Edge arrow logic is hard | Keep it simple: if Pump 2's direction is more than ~16° from view center, show the arrow. |
| Judges think it's medical advice | Show "Demo data — not for clinical use" on the cart, in the README and the video's last card. |
| Running out of time | Cut order: (1) Morphine syringe, (2) flow dot animation, (3) alarm beat. **Never cut** DC1, DC2, DC4, DC5, DC6. |

---

## 18. Beyond the hackathon (the investment story)

**One-line pitch:** Lumen is the "where is it physically" layer for IV safety: hospitals and pump makers already know *what* is infusing; Lumen shows nurses *which tube, which port* at the bedside, hands-free.

**Who pays**
- Hospitals: patient-safety, nursing-quality and ICU budgets.
- Infusion-pump makers (for example BD, Baxter, ICU Medical, B. Braun): pumps already have drug libraries and network connections; Lumen adds the spatial layer. Likely partners or acquirers.

**Moat**
- Line-topology tracking (which tube goes where) with computer vision.
- Compatibility engine integrated with a licensed database (for example Trissel's or King Guide).
- Pump and EHR integrations.

**First market:** NICU and PICU (few ports, many drugs, highest stakes), then adult ICU.

**Roadmap after the hackathon**
1. Real barcode scan of the syringe with the glasses camera.
2. Pump data over hospital interoperability standards instead of hard-coded data.
3. Vision-based line tracing on real tubes.
4. Licensed compatibility database.
5. Pilot study with one ICU and nurse educators (training use first, clinical use later).
6. Regulatory path: in clinical use this is likely **regulated medical-device software** (for example FDA "software as a medical device"). Start in training/simulation, which is lower risk, while working toward clearance.

**Before you pitch:** verify every statistic with a real source and do a trademark search for "Lumen" in the medical-device class (the name is used by other companies).

---

## 19. When in doubt (rules for any decision not in this file)

1. Choose what the **preview can clearly show**.
2. Choose **less on screen**, not more.
3. Put information **on the thing it's about**.
4. Use **pinch** and **big targets**.
5. Keep **one data file** as the only source of data.
6. If CLAD suggests something new, ask: "Does this help the core moment in the video?" If no, skip it.

---

## 20. FINAL COMPLETION CHECKLIST (the project is complete only when every box is checked)

### Setup and rules
- [ ] New SPECS Base Template project, created after Oct 15, 2026
- [ ] Lens Studio MCP connected, CLAD installed
- [ ] Skill pack installed; `plan-lens` run by me, answering in my own words
- [ ] `devpost/design-brief.md` exists with `status: approved`
- [ ] Built by the coding agent through CLAD + Lens Studio MCP

### The Lens
- [ ] Scene matches Section 8.2 (bed, mannequin, pole, 4 bags, 4 pumps, 4 lines, 4 ports, cart, 2 syringes)
- [ ] All data in one file, matches Section 8.3
- [ ] All text matches Section 8.8
- [ ] "Demo data — not for clinical use" visible on the cart
- [ ] No dark/black content; colors always paired with ✓ / ✕ / text
- [ ] Spatial sounds from Section 8.7 play
- [ ] Debug alarm trigger is not visible on screen

### Testing
- [ ] DC1 Quiet idle — PASS
- [ ] DC2 Pick up shows markers — PASS
- [ ] DC3 Data, not art — PASS
- [ ] DC4 Trace — PASS
- [ ] DC5 Redirect — PASS
- [ ] DC6 Push and quiet — PASS
- [ ] DC7 Alarm — PASS
- [ ] DC8 Placement and comfort — PASS
- [ ] `devpost/leaf-results.md` lists all 8 with results and date
- [ ] Manual test script (Section 12) done, all 12 steps OK

### Repo
- [ ] Public GitHub repo
- [ ] Lens Studio project files committed
- [ ] `devpost/` folder with `design-brief.md`, `LUMEN_SPEC.md`, `leaf-results.md`, `build-log.md`, `screenshots/`
- [ ] README has all 13 sections from Section 14
- [ ] Fresh clone opens in Lens Studio and previews correctly

### Video
- [ ] Shows the Lens working end-to-end in the preview
- [ ] Under 3:00
- [ ] Hook in the first 15 seconds; problem, who, why it matters are clear
- [ ] Mentions plan-lens, CLAD, LEAF
- [ ] Ends with the disclaimer card
- [ ] Uploaded to YouTube as **Public**; link works in a private/incognito window

### Submission
- [ ] Devpost form filled: description (what, who, what I learned), video link, repo link, built-with tags
- [ ] Submitted **at least 24 hours before** the deadline
- [ ] (Optional) Posted in Discord `#devpost-learn-feedback` for live review and acted on feedback

**When every box above is checked, Lumen is complete.**

---

## 21. Glossary

| Word | Meaning |
|---|---|
| IV | Intravenous: a drug given into a vein through a tube |
| Line | The tube from a pump to the patient |
| Port | The connector on the patient where a line joins and where a nurse can push a drug |
| CVC | Central venous catheter: a central line, here in the neck, with 3 channels (lumens) |
| Lumen (medical) | One channel inside a catheter (Distal, Medial, Proximal) |
| PIV | Peripheral IV: a small catheter in the arm |
| Y-site compatibility | Whether two drugs can safely meet in the same line |
| Occlusion | The line is blocked (for example, kinked) |
| Push | Giving a drug from a syringe into a port |
| Stand-in | A simple fake for something the preview cannot sense |
| SIK | Spectacles Interaction Kit: pinch, buttons, grab |
| CLAD | Snap's coding agents that build Lenses in Lens Studio |
| LEAF | Snap's automated tests for Lenses |
| MCP | The connection that lets the coding agent control Lens Studio |

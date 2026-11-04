# LEAF results — DC1–DC8

Each done criterion (LUMEN_SPEC.md §11) is one scenario in
[`Assets/Lumen/Core/Scenarios.ts`](../Assets/Lumen/Core/Scenarios.ts), written once and run by three runners:

| Runner | Where | How |
|---|---|---|
| **State** | Node, GitHub Actions | `npm run test:unit` — the pure state machine (no rendering) |
| **Web preview** | Chromium, GitHub Actions | `npx playwright test` — the rendered Three.js twin with a `SceneProbe` (what is actually drawn, label overlaps in the SPECS 37° × 32° view, distances, colours, sound) |
| **Lens Studio preview** | Lens Studio 5.23.2 | `LumenLens` → *Run Self Test On Start*, or `global.lumen.runSelfTest()` from a LEAF test; prints this table to the Logger |

| # | Criterion | LEAF test name | State | Web preview | Lens Studio preview | Date |
|---|-----------|----------------|-------|-------------|---------------------|------|
| 1 | Quiet idle | test_idle_is_quiet | PASS | PASS | _run setup step 5_ | Nov 4 |
| 2 | Pick up shows markers | test_pickup_shows_markers | PASS | PASS | _run setup step 5_ | Nov 4 |
| 3 | Data, not art | test_morphine_all_green_and_put_down | PASS | PASS | _run setup step 5_ | Nov 4 |
| 4 | Trace | test_trace_each_port | PASS | PASS | _run setup step 5_ | Nov 4 |
| 5 | Redirect | test_red_port_redirects | PASS | PASS | _run setup step 5_ | Nov 4 |
| 6 | Push and quiet | test_push_logs_and_goes_quiet | PASS | PASS | _run setup step 5_ | Nov 4 |
| 7 | Alarm | test_alarm_and_resolve | PASS | PASS | _run setup step 5_ | Nov 4 |
| 8 | Placement and comfort | test_placement_and_comfort | PASS¹ | PASS | _run setup step 5_ | Nov 4 |
| 9 | *Extension:* shift-handoff line check | test_handoff_line_check | PASS | PASS | _run setup step 5_ | Nov 4 |
| 10 | *Extension:* fail-safe, no safe port | test_no_safe_port_fail_safe | PASS | PASS | _run setup step 5_ | Nov 4 |

¹ The state runner has no scene, so DC8's geometry is checked by `tests/unit/layout.test.ts`
(no label overlaps per state at the hub and the cart in the 37° × 32° view, all UI ≥ 40 cm, ports
0.8–1.05 m from the eyes, pumps out of view from the hub, kink ring / reason / Resolved never overlap,
no dark palette colours).

**Honesty note:** this repo was built in a cloud container without Lens Studio, so the Lens Studio column
cannot be filled here. The Lens components are typechecked in CI against a hand-written API shim
(`types/lens-studio-shim.d.ts`), which catches our own mistakes but cannot prove the real Lens Studio API
matches. Run setup step 5 and replace the column with the Logger output.

## Beyond DC1–DC8 (stress tests, all green in CI)

| Test | What it hammers |
|---|---|
| fuzz: 200 sessions × 400 random inputs | state invariants after every input (one focus at most, push only on green, glow matches focus, …) |
| fuzz: furosemide never pushed into B or C | the safety property, over 100 × 300 random inputs |
| missing table entry | fail-safe: never green, shows "✕ Not in table — check chart" |
| frame hitch: 30 s jump | timers fire in order (fade → alarm → log expiry) |
| 600 random clicks / poses / waits (browser) | invariants and no page errors |
| 160 targeted clicks on real targets | scene ↔ state consistency (rings, labels, glows, buttons, arrow) |
| precise picking | 4 cm-apart CVC ports with overlapping 6 cm targets resolve to the port nearest the ray |
| drag vs pinch, empty clicks | looking around never pinches; empty space does nothing |
| 50 resets | no leaked scene objects |
| live clock | the alarm fires on the real clock, not only in test mode |

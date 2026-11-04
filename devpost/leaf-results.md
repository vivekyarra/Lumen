# LEAF results — DC1–DC8 (+ DC9, DC10)

**Lens Studio 5.24.1 preview (SPECS 27), Nov 4 2026: 10 / 10 LEAF scenarios pass, and the in-preview
self-test prints `10/10 pass`.** Run through the Lens Studio MCP server (`run_leaf_scenario`, target
`preview`) against the real scene: SIK 2.0 (`SpectaclesInteractionKit.lspkg`, SIK version 0.18.0) and LEAF 2.0.2.

Every done criterion (LUMEN_SPEC.md §11) is checked in two independent ways inside Lens Studio:

1. **A LEAF scenario per criterion** ([`Assets/Lumen/Leaf/`](../Assets/Lumen/Leaf/)). It pinches the Lens's real
   SIK Interactables by name (`Syringe_S1_Hit`, `Port_B_Hit`, `PushHereButton`, `Kink_ResolvedButton`,
   `IV_Pole_Hit`) with LEAF's `DefaultLeafInteractor` and asserts on what is actually enabled in the scene:
   the rings, glows, labels, buttons, amber alarm and edge arrow. Expected strings come from `Core/Strings.ts`.
2. **The shared scenarios** ([`Assets/Lumen/Core/Scenarios.ts`](../Assets/Lumen/Core/Scenarios.ts)). These are
   written once and run by three runners. In Lens Studio they run through the hidden hook
   `global.lumen.runSelfTest()`, from the LEAF scenario `test_self_test_dc1_dc10`.

## Lens Studio preview — LEAF scenarios

| # | Criterion | LEAF scenario | Result | Date |
|---|-----------|---------------|--------|------|
| 1 | Quiet idle | test_idle_is_quiet | PASS | Nov 4 |
| 2 | Pick up shows markers | test_pickup_shows_markers | PASS | Nov 4 |
| 3 | Data, not art | test_switch_syringe_changes_markers | PASS | Nov 4 |
| 4 | Trace (all 4 ports, with and without a syringe) | test_trace_lights_correct_line | PASS | Nov 4 |
| 5 | Redirect | test_red_port_redirects | PASS | Nov 4 |
| 6 | Push and quiet | test_push_logs_and_returns_idle | PASS | Nov 4 |
| 7 | Alarm (fires 4 s after the push, resolves) | test_alarm_shows_and_resolves | PASS | Nov 4 |
| 8 | Placement and comfort | test_self_test_dc1_dc10 (DC8 row) | PASS | Nov 4 |
| 9 | *Extension:* shift-handoff line check | test_handoff_line_check | PASS | Nov 4 |
| 10 | *Extension:* fail-safe, no safe port | test_self_test_dc1_dc10 (DC10 row) | PASS | Nov 4 |
| — | Reachability: IK avatar pinches the green port, then "Push here" | test_ik_reach_controls | PASS | Nov 4 |
| — | All shared scenarios in the preview | test_self_test_dc1_dc10 | PASS (10/10) | Nov 4 |

Logger output of `test_self_test_dc1_dc10` in the Lens Studio preview:

```
| # | Criterion | LEAF test name | Result |
| DC1 | Quiet idle | test_idle_is_quiet | PASS |
| DC2 | Pick up shows markers | test_pickup_shows_markers | PASS |
| DC3 | Data, not art | test_morphine_all_green_and_put_down | PASS |
| DC4 | Trace | test_trace_each_port | PASS |
| DC5 | Redirect | test_red_port_redirects | PASS |
| DC6 | Push and quiet | test_push_logs_and_goes_quiet | PASS |
| DC7 | Alarm | test_alarm_and_resolve | PASS |
| DC8 | Placement and comfort | test_placement_and_comfort | PASS |
| DC9 | Shift-handoff line check | test_handoff_line_check | PASS |
| DC10 | Fail-safe: no safe port | test_no_safe_port_fail_safe | PASS |
[Lumen self-test] 10/10 pass
```

**What LEAF caught.** The first version of the IK scenario also had the IK avatar pick up the syringe.
LEAF failed it: `[IK right] trigger "Syringe_S1_Hit": out_of_fov: still outside FOV (94.1° off-axis) after
head aim`. The cart is at the head of the bed, one body turn to the left (see the layout notes in
`build-log.md`). LEAF's IK avatar only aims its head, so the scenario now picks up the syringe with the
scripted interactor and uses IK for the hub controls in front of the nurse. The finding is real: the cart
needs a turn of the body, not just the head.

DC8's geometry (no label overlaps at the start pose in the 37° × 32° view, nothing closer than 40 cm) is checked
on the spec layout by the shared scenario. The text size is the one thing still checked by eye in the preview
(LENS_STUDIO_SETUP.md step 4).

## All three runners

| # | Criterion | State (Node, CI) | Web preview (Chromium, CI) | Lens Studio 5.24.1 preview |
|---|-----------|-------|-------------|---------------------|
| 1 | Quiet idle | PASS | PASS | PASS |
| 2 | Pick up shows markers | PASS | PASS | PASS |
| 3 | Data, not art | PASS | PASS | PASS |
| 4 | Trace | PASS | PASS | PASS |
| 5 | Redirect | PASS | PASS | PASS |
| 6 | Push and quiet | PASS | PASS | PASS |
| 7 | Alarm | PASS | PASS | PASS |
| 8 | Placement and comfort | PASS¹ | PASS | PASS |
| 9 | *Extension:* shift-handoff line check | PASS | PASS | PASS |
| 10 | *Extension:* fail-safe, no safe port | PASS | PASS | PASS |

¹ The state runner has no scene, so DC8's geometry is checked by `tests/unit/layout.test.ts`:
- no label overlaps in any state, at the hub and at the cart, in the 37° × 32° view;
- all UI at least 40 cm from the eyes;
- ports 0.8–1.05 m from the eyes;
- pumps out of view from the hub;
- the kink ring, the reason and Resolved never overlap;
- no dark palette colours.

CI cannot run Lens Studio. The LEAF files are typechecked there against a shim of Snap's LEAF reference
(`types/leaf-shim.d.ts`). The Lens Studio column above comes from runs in Lens Studio itself.

## Beyond DC1–DC8 (stress tests, all green in CI)

| Test | What it hammers |
|---|---|
| fuzz: 200 sessions × 400 random inputs | state invariants after every input (at most one focus, push only on green, glow matches focus, …) |
| fuzz: furosemide never pushed into B or C | the safety property, over 100 × 300 random inputs |
| missing table entry | fail-safe: never green, shows "✕ Not in table — check chart" |
| frame hitch: 30 s jump | timers fire in order (fade → alarm → log expiry) |
| 600 random clicks / poses / waits (browser) | invariants and no page errors |
| 160 targeted clicks on real targets | scene ↔ state consistency (rings, labels, glows, buttons, arrow) |
| precise picking | 4 cm-apart CVC ports with overlapping 6 cm targets resolve to the port nearest the ray |
| drag vs pinch, empty clicks | looking around never pinches; empty space does nothing |
| 50 resets | no leaked scene objects |
| live clock | the alarm fires on the real clock, not only in test mode |

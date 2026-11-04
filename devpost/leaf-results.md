# LEAF results

**10 / 10 LEAF scenarios pass in the Lens Studio 5.24.1 preview (SPECS 27).** Each scenario pinches the Lens's
real Spectacles Interaction Kit targets (`Syringe_S1_Hit`, `Port_B_Hit`, `PushHereButton`, `Kink_ResolvedButton`,
`IV_Pole_Hit`) and checks what the scene actually shows. Expected text comes from `Assets/Lumen/Core/Strings.ts`.
The suite runs from the LEAF panel or through the Lens Studio MCP (`run_leaf_scenario`). A second, independent run
through Snap's CLAD LEAF workflow also passed 10 / 10.

| # | Done criterion (design brief) | LEAF scenario | Result |
|---|---|---|---|
| 1 | Quiet at start | `test_idle_is_quiet` | ✅ PASS |
| 2 | Pick up furosemide → ports green / red with the reason | `test_pickup_shows_markers` | ✅ PASS |
| 2 | Switching to morphine turns all four green | `test_switch_syringe_changes_markers` | ✅ PASS |
| 3 | Pinch any port → only its line lights to the right pump | `test_trace_lights_correct_line` | ✅ PASS |
| 4 | Red port → "do not push here" + arrow to the safe port | `test_red_port_redirects` | ✅ PASS |
| 4 | Green port → Push here → log line → quiet within 2 s | `test_push_logs_and_returns_idle` | ✅ PASS |
| 5 | Pump 2 alarm → edge arrow, amber line to the kink → Resolved | `test_alarm_shows_and_resolves` | ✅ PASS |
| + | Shift handoff: one pinch on the pole walks every line | `test_handoff_line_check` | ✅ PASS |
| + | Reach: LEAF's IK avatar pinches the port and Push here | `test_ik_reach_controls` | ✅ PASS |
| + | Every shared scenario, run inside the preview | `test_self_test_dc1_dc10` | ✅ PASS (10 / 10) |

Logger output of `test_self_test_dc1_dc10` in the Lens Studio preview:

```
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

## The same criteria, three runners

The scenarios in `Assets/Lumen/Core/Scenarios.ts` are written once and run in three places:

| Runner | Where | Result |
|---|---|---|
| Lens Studio preview | LEAF, in Lens Studio 5.24.1 | ✅ 10 / 10 |
| State machine | Node, GitHub Actions, every PR | ✅ 10 / 10 |
| Web twin | Playwright in Chromium, GitHub Actions, every PR | ✅ 10 / 10 |

CI also runs:
- fuzzing: 200 sessions × 400 random inputs, with every state invariant checked after each input;
- 600 random clicks, poses and waits in the web twin;
- 160 targeted clicks, checking the scene against the state;
- precise picking between ports 4 cm apart;
- 50 resets with no leaked objects;
- a full story-mode playthrough.

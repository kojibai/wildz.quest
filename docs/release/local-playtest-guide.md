# WILDZ local playtest guide

Use real player observation to decide whether an interaction is clear, useful, and satisfying. Automated checks cannot establish those qualities.

## Run a comparable session

1. Use the same device, browser, viewport, graphics setting, and production build for both runs. Record those details separately; the game does not collect them.
2. In the journey/mission panel, turn on **Record a local playtest**. Recording is optional. The game saves only this preference; measurements stay in memory until reset, disabled, or the game is reloaded. Download a session before leaving if you want to keep it.
3. Allow the scene to warm up, then use **Start fresh**. Walk the same route, harvest the same resource type, place a structure, open and close a profile, and save a card. Do not switch tabs during a timed action. Check the saved public link separately in a signed-out browser.
4. Use **That felt great** or **I felt stuck** to mark a moment. These are self-reports, not automatically inferred emotions.
5. Download the session. Repeat after a change under the same conditions. Compare both action outcomes and frame gaps, not just averages.

The exported frame statistics measure visible-tab animation-frame intervals, not GPU render time or guaranteed game FPS. A frame interval over 50 ms signals a noticeable pause worth investigating; it does not identify the cause. Main-thread long-task counts are unavailable in browsers that lack the Long Tasks API. The recent 95th percentile uses at most the last 600 intervals; worst intervals and counts cover the full current recording. At most 120 recent action events and 120 slow intervals are retained. Version 2 exports each retained slow interval with relative timing and the action spans overlapping it, plus per-action duration percentiles from retained completions. Overlap is correlation, not proof of a cause. Unmarked work remains unattributed. Repeated starts for an already pending action keep the first start; test one action in each category at a time. Action durations include any deliberate animation or network wait between their start and completion.

No player identifiers, names, locations, free-text notes, browser fingerprint, or network information are recorded. There is no automatic upload. Sharing a downloaded file is a separate choice.

## Observe a new player without coaching

Ask the player to find something interesting, meet a companion, gather useful materials, and make a place they would want to return to. Let them choose the route. Ask them to speak their thoughts aloud if comfortable. Avoid explaining the controls while observing; offer help when requested and note where it was needed.

Keep brief notes outside the game:

| Moment | What the player tried | What happened | What they expected | Help needed? |
| --- | --- | --- | --- | --- |
| First meaningful action | | | | |
| Choosing a next destination | | | | |
| Understanding companion help | | | | |
| Harvesting and building | | | | |
| Finding a reason to return home | | | | |
| Saving and sharing a card | | | | |

Afterward ask what they remember, what they would do next, and what they would tell a friend. Record their words with consent. A stuck marker may mean unclear direction rather than poor performance; a smooth frame trace does not prove the game is fun. Track return interest by asking players in later sessions, not by silently tracking them.

Prioritize reproducible save/link failures and visible freezes first, then repeated confusion, then opportunities that players independently describe as memorable. Repeat the same test after each meaningful change.

## Implementation reference ledger

Loaded and applied:

- `/Users/bjklock/.codex/skills/threejs-debug-profiler/SKILL.md`
- `/Users/bjklock/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md`
- `/Users/bjklock/.codex/skills/threejs-debug-profiler/references/checklists/performance-profile.md`

This tooling enables measurements; adding it is not evidence of a performance improvement. Renderer draw calls, triangles, texture counts, and GPU profiling require a separate controlled profiling pass.


## Repeatable performance pass

Use a production preview of a known commit. Record the commit, device, browser version, viewport, DPR, graphics settings, and starting inventory/build size outside the exported recording. Keep those fixed for before/after comparison. Do not compare a fresh profile with a heavily built world.

1. Warm up for 30 seconds; start fresh and walk the same path for two minutes.
2. Harvest ten times, wait for each result, then place/finish five valid pieces with the same materials.
3. Open and close Profile ten times; repeat Market. Inspect the action timings and download the session. Missing timings mean the path lacks a start/completion marker, not that it took zero time.
4. Save the Identity Seal and a card, and verify the card/profile URL independently in a signed-out browser. Local completion is separate from public publication.
5. Compare slow-interval overlap with browser Performance traces of the same action. Check scripting, rendering, layout, garbage collection, worker messages, and network waits before assigning a cause. Capture renderer calls, triangles, geometries, and textures separately.
6. Repeat on a narrow viewport and an actual touch device; viewport emulation alone does not prove mobile performance.

Keep first-open and repeated-open results separate. A warm-path improvement can hide a cold-start regression. The built-in recorder provides animation-frame timing and action spans, not renderer/GPU measurements. The panel refreshes every three seconds; its own rendering remains part of the measured scenario.

## Observation decisions

Use anonymous session labels in your separate notes. Obtain consent before recording a person or their words. For each session, record whether the player independently found a goal, understood a companion's contribution, built something useful, and could explain why they would return. Mark observed hesitation with the action and what happened; do not interpret a long frame as confusion or a self-reported great moment as retention.

After each round, choose the most repeated blocking issue and state the next testable change. Re-run that scenario with another new player and separately ask returning participants what they remembered. An empty observation sheet is unfinished research, never a successful playtest.

Additional references loaded for this pass:

- `/Users/bjklock/.codex/skills/threejs-qa-release/SKILL.md`
- `/Users/bjklock/.codex/skills/threejs-qa-release/references/qa-release-checklists.md`
- `/Users/bjklock/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md`


### Marker coverage

Profile and Market span the shell open request through a task scheduled after the committed panel's animation-frame callback. This is a rendering opportunity, not proof that pixels reached the display, and does not wait for background profile publication. Identity Seal and inventory card-save spans end when their export promise settles; success means the local export flow completed, not that a public URL is live. A failed/closed-before-presentation panel span is retained as a failure. Harvest and placement spans currently measure their marked service operation. Unmarked movement or unrelated work remains visible in overall frame gaps without a fabricated action label.

The cross-component marker bridge dispatches only fixed action/outcome strings in this browser window. Its collector is attached only while recording is enabled; unsubscribing stops collection. It sends no network requests and includes no card, identity, or error contents.

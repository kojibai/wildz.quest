# WILDZ local playtest guide

Use real player observation to decide whether an interaction is clear, useful, and satisfying. Automated checks cannot establish those qualities.

## Run a comparable session

1. Use the same device, browser, viewport, graphics setting, and production build for both runs. Record those details separately; the game does not collect them.
2. In the journey/mission panel, turn on **Record a local playtest**. Recording is optional. The game saves only this preference; measurements stay in memory until reset, disabled, or the game is reloaded. Download a session before leaving if you want to keep it.
3. Allow the scene to warm up, then use **Start fresh**. Walk the same route, harvest the same resource type, place a structure, open and close a profile, and save a card. Do not switch tabs during a timed action. Check the saved public link separately in a signed-out browser.
4. Use **That felt great** or **I felt stuck** to mark a moment. These are self-reports, not automatically inferred emotions.
5. Download the session. Repeat after a change under the same conditions. Compare both action outcomes and frame gaps, not just averages.

The exported frame statistics measure visible-tab animation-frame intervals, not GPU render time or guaranteed game FPS. A frame interval over 50 ms signals a noticeable pause worth investigating; it does not identify the cause. Main-thread long-task counts are unavailable in browsers that lack the Long Tasks API. The recent 95th percentile uses at most the last 600 intervals; worst intervals and counts cover the full current recording. At most 120 recent action events are retained. Action durations include any deliberate animation or network wait between their start and completion.

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

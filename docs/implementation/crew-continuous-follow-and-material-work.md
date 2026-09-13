# Continuous roaming and accompanying movement

This checkpoint supersedes the three-stop automatic return described in crew-roster-integration.md. SDK, MCP and AI skills remain pinned to 126.0.0; prescribed older-suffixed SDK exports retain their existing identities.

Roam is persistent intent until explicit recall. Actual visits append to the local Kai-ordered journal. Each new itinerary carries at most three stops, a scalar cumulative observation count, and the previous history head. Selecting another companion preserves the journey. Planning yields outside the journal service loop, checks the current proof and space again before committing, and cannot record an arrival. Rest and unavailable geometry pause movement. Blocked routes retry with a five-second backoff. These are local loaded-world observations, not global discoveries, material rewards, or offline simulation.

Accompanying movement measures player displacement between changed player snapshots, retains the estimate between frames, and adds bounded catch-up speed. The accompanying path uses at most three swept collision substeps; independent roaming retains its original movement budget. Legless grounded bodies undulate from actual distance traveled. Bodies and labels retain one parent transform. A dispatched creature is excluded from home residents, and selecting it does not attach its independent ground journey to the player's flight frame.

The independent scheduler has two movement services per 100 ms and one path plan per tick. Eligibility refresh examines at most sixteen entries per refresh, normally every 500 ms; current eligibility is rechecked before every movement. Inactive entries retain their history without continually consuming active movement slots. Presentation finishes its existing admitted segment before starting another when the roster shrinks. This is a bounded workload, not a claim that every device has identical frame times or that arbitrarily large crews travel at the same speed.

## Material work

Delivery and building coordinators call the existing source commands: construction.site.contribute reserves actual owner-held lots at a site; construction.site.work consumes those exact lots and creates the admitted structure. They share dispatch fencing, recall handling, and lookup-only recovery. Exact command identity survives background publication and reload; crew harvest commands are not silently replanned against a different source head.

The SDK mandate kind follows the existing source-law mapping. Region identity is included in the stored command binding. The application's build geometry budget counts completed structure objects: one site-completion command consumes one geometry unit. No worker-owned cargo or in-transit custody has been invented.

These material coordinators are not enabled in the crew panel. They require verified owner/worker sources, current subject heads, an issued mandate, and a separate verified haul/build capability. The existing creature capability vocabulary does not establish those last capabilities merely because a caller supplies a hashed build-consent record. Missing verification rejects execution before world writes.

## References and verification

Applied threejs-gameplay-systems references/gameplay-workflows.md and references/physics-engine-selection.md; retained existing custom swept collision with no physics package addition. Applied the installed v126 autonomous-mandate skill, manifest, SDK/MCP maps, examples and test contract. Existing main checkout retained; no sibling Receiz/Sports changes.

Final combined verification: 2,522 tests passed; the production build and v126 integration checker passed. No new lint warning remains in the changed movement code. The build retains unrelated existing warnings.

A fresh mobile-sized production Chrome context verified actual three-stop visits followed by a new itinerary, physical independent progress after selecting another companion, reload with the same proof and Roam intent, and explicit Recall followed by physical return and Follow. No page errors or proof supersession occurred. These browser fixtures used only disposable generated cards. A generated canonical legless creature's body yaw varied from -0.1795 to +0.1800 while moving and returned to zero when stopped. The actual screenshots have foreground tree occlusion, so they are not an unobstructed visual-quality benchmark.

The initial regression reproduced approximately 21 metres of sustained companion lag. Normal 100 ms keyboard input after correction ended about 1.05 metres behind while moving, with sub-pixel visible label alignment and 16.67 ms p95 sampled frames. Faster input exposed lost movement distance at short detour waypoints, corrected by carrying remaining frame distance through at most three swept writes. These are local desktop Chrome measurements at a mobile viewport, not guarantees for physical mobile hardware or every terrain route.

Player transport excludes dispatched and pending roaming creatures; their own physical history and location remain intact. Foreign-space journeys pause until their actual geometry is loaded instead of appearing beside the player or recording a fabricated return.

The final transport browser regression selected an actively roaming creature, moved the player 30 metres in the same space, then changed to another space with a further relocation. The creature retained its exact independent position, proof and Roam assignment; the foreign-space trip paused. No automatic return or completion was recorded.

Following-only obstruction recovery can reposition an accompanying creature to the current validated player landing or its clear adjacent formation when moving and more than three metres separated by a blocked/detour route. This is an explicit presentation regroup, not a claim of continuous swept travel from the old pose. It performs at most two canonical checks, grants no travel-distance credit, and is disabled for independent journeys, work and non-ground locomotion.

Fast-input verification exposed a separate shallow-water mismatch: the player can wade where the conservative independent walker stops. The accompanying sampler now uses the same canonical shallow/deep elevation boundaries for Follow only; independent trips retain their existing dry-ground policy. This reuses the sampled floor elevation and adds no extra terrain projection.

Final rebuilt browser run used 100 real keyboard steps at 30 ms cadence: 54 land samples (maximum longitudinal separation 2.577 m, horizontal 2.794 m) and 46 shallow-water samples (maximum longitudinal 0.473 m, horizontal 1.179 m). The player stopped before deep water; no deep-water crossing was tested or permitted. The companion finished 1.08 m alongside with negligible trailing separation. Sampled p95 frame duration was 16.67 ms, with 126 draw calls/frame and 62,792 triangles/frame; there were no page errors. This verifies the observed regression route, not universal zero latency or identical mobile-hardware performance.

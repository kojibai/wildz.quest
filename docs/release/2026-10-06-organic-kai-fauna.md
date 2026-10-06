# Organic Kai fauna and clear food interactions

Birds, goats, and hares now choose individual curved paths and variable pauses from their full identity and absolute Kai time. They no longer replay the former short circular routes. Breathing follows the existing Kai inhale/exhale proportions with species cadence; scanning, grazing, chewing, blinking, ears, tails, and articulated steps blend continuously. Coat and size remain stable when the same individual becomes livestock. This is a bounded procedural simulation, not a claim of biological autonomy or mathematical non-repetition.

Static ground and obstacle checks validate a small habitat once. Curves stay inside that habitat, and a cached height grid grounds the feet without terrain queries at animation frequency. Existing quality tiers, resident limits, three shared animal mesh batches, and the 20 Hz presentation cap remain. The renderer reads the existing monotonic Kai clock, including time skipped while hidden. It does not store animation history, publish player state each frame, or request a service.

Fruit has forgiving pointer-only targets around its existing attached instances. Their padding stays local to the fruit and away from the trunk corridor; gathered fruit leaves no invisible target. There is no added render batch or permanent HUD control. The trunk/resource ring and existing companion timber button retain their harvest action. Available food gathers in one tap; a visible source outside reach opens its selected Food & farm row with guidance. Eating remains an explicit action in the Satchel, so collecting food never consumes it accidentally.

Tapping wildlife inspects the exact individual rather than immediately hunting it. Its selected row is highlighted and brought into view, including when Capture relocates it into the farm section. Hunt and Capture are separate choices. Controls explain distance, companion recovery, equipment, shelter capacity, and food-pack capacity. Hunting uses shared authoritative readiness checks, prefers the active ready companion, and falls back to a usable equipped axe. Live action-time reach checks prevent a moving animal from failing silently after its displayed distance changes.

Companion readiness projects elapsed camp/bed/sleep fatigue recovery without updating a saved card just to display a control. A successful hunt settles that same recovery before work wear; a rejected or stale action retains the exact original checkpoint. The established body energy, depletion, finite food, tool wear, cooldown, and Kai husbandry rules remain in force.

## Qualification

- Full suite: 3,159 tests, 3,158 passed, zero failed, one enrolled-device fixture skipped.
- Targeted lint, Receiz architecture lock, Receiz integration check, secret scan, and patch whitespace checks passed.
- The final production build passed. Existing SDK circular-dependency bundling warnings and two pre-existing lint warnings remain in `BuildGuidanceBrowserFixture` and `WildsStewardEnvironment`; changed files pass targeted lint without warnings.
- Tests cover former-route non-replay, individual identities, large absolute Kai timestamps, continuous motion/anatomy, food touch padding, translated roots, empty targets, selected-source guidance, hunting readiness/axe fallback, and rest recovery without a separate durable tick. Existing finite food, livestock, and harvesting tests pass.
- Independent review found no remaining critical, important, or minor issue. Numerical probes covered 60 identities at three time horizons and cache eviction; a terrain probe found a maximum grounding error of 2.7 mm across 6,200 positions.
- A local CPU-only sampler/anatomy benchmark used 12 residents over 1,200 presentation frames (14,400 samples), averaging 0.050 ms per frame. It excludes matrix uploads, GPU rendering, and physical-phone performance.
- Desktop browser checks selected a tapped goat and showed its reach requirement, hunted a reachable bird into one stored food portion, consumed that food and increased fuel from 89.8% to 99.8%, and immediately increased timber from 1 to 2 through the existing companion action. A near-fruit tap outside reach opened the correct selected crop and left timber unchanged.
- The compiled production preview loaded at 390×664 with the retained player position, food, and timber. Kai Klok → Open Satchel switched panels correctly. Gathering the last nearby berry portion immediately changed the food pack from 2 to 3 and the crop from 1/3 to 0/3. The disabled Gather action explained regrowth; the mobile food panel fit the viewport without horizontal clipping. The final page had the expected title/URL, meaningful game content, no framework error overlay, and no captured console errors.

No package, lockfile, remote texture, external service, or paid dependency was added. Existing owner checkpoints still govern nourishment/livestock; this increment does not add shared global admission for those sources. The production preview is on port 3108 because port 3107 belongs to another checkout. Deployment and physical-phone performance require the deployed version to be checked separately.

## Reference ledger

- Gameplay workflows: read and applied (`threejs-gameplay-systems/references/gameplay-workflows.md`).
- Physics selection: read and applied (`threejs-gameplay-systems/references/physics-engine-selection.md`); retained the existing custom bounded terrain collision rather than adding an engine.
- Gameplay checks: pure source transitions tested; real browser input paths verified; production build and final mobile preview checked before commit.

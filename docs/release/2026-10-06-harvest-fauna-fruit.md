# Harvest responsiveness, landscape fauna, and attached fruit

This follow-up fixes the newly added nourishment renderer's black surfaces. Its geometries did not carry per-vertex colors, so enabling `vertexColors` multiplied their instanced colors by an unset attribute. Instanced colors now combine with locally authored coat, fruit-skin, and leaf textures. No new dependencies, remote assets, generation API, or paid service are involved.

Fruit positions use the same tree placement, canopy parts, rotation, harvested foliage, and ground projection as the existing tree. Apples have a lobed shape, stem dimple, stems, leaves, and natural scale. The arrival clearing does not leave floating fruit. A harvested stump leaves its still-available fruit on the ground; gathering removes exact visible portions. The finite source and account-checkpoint rules are unchanged.

Birds, goats, and hares have distinct anatomy, articulated steps, grazing, and hopping. A bounded terrain-safe route is sampled once per resident animal and reused for deterministic movement. Farm animals also move within their existing shelter position. Plants do not rebuild in the animal animation loop. Existing device quality tiers bound resident counts and mesh detail. Wildlife taps inspect Food & farm; explicit Hunt and Capture remain there. Invisible resource touch proxies yield to intersected visible nourishment, and the stone proxy sits at the rock rather than high above it.

Exhaustion does not delay harvesting. Material counts publish after durable local admission, independently of network synchronization. The extra post-admission arrival/dwell timer has been removed, so the creature starts returning immediately after admission.

The creation continuity guard had introduced a second full outbox snapshot read for each mutation. The SDK queue read and guarded write now share one IndexedDB readwrite transaction, avoiding the duplicate read while retaining source continuity, worker leases, finite material conflicts, and the durable completion fence. Tests assert one queue read and one completed transaction, and check conflicting or altered creation sources still fail.

Account projection also repeatedly rebuilt unchanged creation geometry after unrelated harvests. A bounded 64-entry / 8 MiB exact-source cache avoids that work. Keys cover the full strict plain source, including ancestry and worker conditions; a claimed head alone never authorizes reuse. Returned plans are defensive copies. Event, ownership, and spent-material validation remain separate. Tests reject nested same-head tampering, isolate mutated returned buffers, and exercise eviction.

## Qualification

- Full suite: 3,145 tests; 3,144 passed, zero failed, one enrolled-device fixture skipped.
- Final production build, type check, Receiz architecture lock, Receiz v128 check, secret scan, and patch whitespace check passed. The production build retains existing SDK bundling warnings and two existing lint warnings.
- Focused wildlife tests cover visible motion within a breath, articulated poses, canopy attachment, cleared/depleted trees, finite gathered portions, and bounded local texture/mesh data.
- Source compilation benchmark on a synthetic 128-node paid fixture: median 34.88 ms uncached versus 3.27 ms cached across 30 samples after five warmups. This isolates compilation CPU work, excludes source cloning, and is not a physical-phone or end-to-end latency claim.
- Desktop development checks admitted consecutive timber harvests and showed the updated count on the first UI observation. First post-reload admission was 339 ms; the next was 195 ms. Earlier measurements were 884 ms cold and 155–161 ms warm, so no warm end-to-end speed improvement is asserted from these noisy runs.
- Desktop production preview: one timber harvest appeared on the first observation and remained after reload. Tapping a visible goat opened Food & farm instead of harvesting a hidden rock. Gathering fruit reduced its source from 3/3 to 2/3 and added one stored portion; eating consumed that portion, raised fuel from 84% to 90%, and added digestion fullness. Animal distances changed while the panel stayed open.
- Independent review found no remaining critical or important issue. Its nearest-resident livestock finding was corrected with a memoized distance sort before the device cap, outside the animation loop.

The final preview uses port 3108 because port 3107 is occupied by a separate Receiz checkout. This does not change the game's deployment configuration.

Physical-phone performance and the live deployed commit need separate verification. These procedural visual improvements do not qualify photorealistic animals or a zero-latency renderer. Shared global nourishment/livestock admission remains a separate follow-up from the existing owner checkpoints.

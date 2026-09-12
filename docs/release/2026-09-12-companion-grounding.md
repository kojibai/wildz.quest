# Companion grounding and locomotion

Removed the trail container's extra vertical offset. Grounded actors no longer bob their entire body in idle; head breathing remains. Ground height uses the admitted site floor and existing terrain projection, cached while position and site remain unchanged. The active companion follows in world coordinates with bounded movement and turns toward travel. Existing bounded roaming now changes nearby destinations rather than endlessly orbiting while bobbing.

Canonical locomotion selects two legs, four legs or no invented legs. Sealed limb morphology scales leg height. Distance traveled drives alternating steps, and support companions turn and animate during travel. Functional flying anatomy uses airborne animation while moving. Genome/history/ownership data are unchanged.

Validation: production build passed; targeted ESLint clean. Browser at 390×844 exercised idle, movement and stopping, with no page errors. A 120-frame instrumented sample measured 152.55 calls/frame, 90,374.43 triangles/frame and 16.67 ms p95 frame interval. This is a post-change desktop-Chrome observation, not an iPhone or before/after guarantee. Screenshots: `/tmp/wildz-companion-idle.png`, `/tmp/wildz-companion-walk.png`, `/tmp/wildz-companion-stop.png`.

Limits: procedural stride animation is not full foot IK or physical navigation; obstacles, cliff routing and coordinated crews still require implementation. Legacy cards without canonical anatomy retain the existing catalog fallback. All genome face, surface and behavior details are not yet rendered in full. This is not a 10/10 realism claim. See `docs/implementation/creature-crews.md` for the explicitly unimplemented crew requirements and SDK findings.

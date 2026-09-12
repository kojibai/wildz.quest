# World immersion verification — 12 September 2026

## Implemented behavior

- Version 2 structural placement joins walls to deck edges, keeps adjacent floors level, centers a roof over a wall-supported module, and aligns door frames to their support. The snap toggle permits free placement within the existing grid and support rules.
- Version 1 placement and component proofs retain their original replay law. New placement evidence explicitly binds the snap version.
- Finished/functional beds with verified material and work evidence offer rest within 2.5 metres in the same space. Rest restores up to 55 energy and relieves 55 fatigue, compared with 35 at camp; companion healing is 35% instead of 25% when applicable. Existing material storage and workshop operations remain available.
- Walls and roofs between the camera and character can disappear visually during play. Editing restores them. Collision solids remain unchanged.
- A deterministic Kai calendar weather field drives foliage and affects commanded flight direction, endurance and lift. Built roofs and upwind walls reduce flight weather exposure. This is simulated world weather, not observed Earth weather.
- Organic geometry and vertex color reuse the previous primitive triangle budgets. World-space terrain texture coordinates eliminate sliding grain and tile-triggered texture regeneration. Ground/sky color handling and existing lighting were corrected. Root-arch geometry and canopy shadows use fewer draws.

## Verification

The production build passed, including type validation. Targeted ESLint passed. The build still reports existing warnings in the SDK web-worker dependency, BuildGuidanceBrowserFixture image markup, and WildsStewardEnvironment hook dependencies.

The complete Node suite passed 2,341 tests in 211 suites, including four-wall placement, roof alignment, level adjacent floors, legacy proof verification, physical doorway passage/wall blocking, bed proximity/unfinished-bed rejection, deterministic weather, flight effects, shelter and geometry budgets.

Chrome on macOS, using the same saved synthetic profiles and movement sequence:

| Viewport | Draw calls before → after | Geometries before → after | Textures | Sampled p95 frame interval |
| --- | --- | --- | --- | --- |
| 390 × 844 | 98 → 95 | 104 → 97 | 12 | about 16.67 ms |
| 1280 × 800 | 153 → 148 | 115 → 106 | 12 | about 16.67 ms |

No page/shader errors or horizontal overflow in those runs. Camera fixture using a completed room: five meshes visible/one occluding wall hidden in play; all six visible in edit. The real builder snap toggle switched to free placement.

These are short desktop Chrome samples at mobile and desktop viewport sizes, not real-iPhone or worst-case performance guarantees. They do not prove zero latency. No authenticated wallet transfer or live SDK mutation was part of this pass.

## Asset ledger and visual limits

No external generated asset or new download was introduced. Trunks, foliage and stones are deterministic local geometry; bark/leaf maps remain shared 128px procedural textures; existing limestone and construction materials are reused. No asset API credentials were used. This improves the existing stylized look; it is not a photorealistic or completed AAA visual claim.

## Still outside the implemented behavior

Persistent storm damage, repairs and material resistance; ground exposure consequences; rain/snow presentation tied to the new field; stationary hover drift; a timed sleep animation; and distinct new gameplay benefits for every decorative furnishing remain unfinished. The world is not a complete simulation of reality. Further visual upgrades and longer real-device playtesting need measured budgets and validation.

# Wildz v5.0.0 release evidence

Captured on 2026-08-13 from the optimized production build served at `http://127.0.0.1:3001`.

## Automated qualification

- `pnpm release:check`: pass.
- Node test suite: 1,232/1,232 tests across 122 suites.
- TypeScript: pass.
- ESLint: pass on the final candidate.
- Secret scan: pass across 833 text files.
- Receiz repository check: pass against v118.
- Receiz conformance: 15/15, with zero network or database calls.
- Production build: pass, with 16/16 static pages generated.
- Bundle report: `/` first load 597 kB, including 103 kB shared JavaScript.

The release gate retained the known SDK verifier `web-worker` dynamic-dependency warning. Webpack also skipped writing part of its disposable persistent cache when the local workspace volume reached capacity; emitted production assets and the release result were unaffected. The cache was removed and the final lint, typecheck, focused release tests, and source checks were rerun cleanly.

## Production playtest

The desktop world, mission sheet, trainer challenge, separate NPC Adventure Arena, movement, and a live combat action were exercised. Keyboard movement changed the player position and energy. The seeded trainer challenge opened the NPC Arena, and Strike reduced rival vitality from 100 to 94.

At 1440×900 the world canvas rendered at 1800×1125 with DPR 1.25. A captured canvas was opaque and visually varied, with entropy 5.7702 and nonzero channel deviation. Renderer diagnostics were within budget: 129 calls, 70,812 triangles, 129 geometries, and 3 textures.

At 390×844 the NPC Arena and chapter sheet had no horizontal overflow, clipping, or control overlap. The Arena controls remained compact and the 3D playfield retained most of the viewport. Mobile diagnostics were also within budget: 103 calls, 68,608 triangles, 136 geometries, and 3 textures. Browser console errors and warnings were zero. The service worker returned 200 from `/sw.js?release=v5.0.0-r1`.

The mission sheet displayed one live chapter, **The Nocturne Vigil**, from Kai state and showed no inactive-chapter fallback. Entering and leaving the separate NPC Arena preserved the world session.

## Captures

- `v5-desktop-active.png`: desktop world after real movement.
- `v5-desktop-canvas.png`: isolated nonblank world-canvas evidence.
- `v5-desktop-chapter.png`: desktop live Kai chapter.
- `v5-desktop-arena.png`: desktop NPC Adventure Arena.
- `v5-mobile-arena.png`: 390×844 compact NPC Adventure Arena.
- `v5-mobile-chapter.png`: 390×844 live Kai chapter.

## Checklist ledger

| Release reference | Applied | Evidence |
|---|---:|---|
| QA release checklist | Yes | Full automated gate, production build, browser smoke, release metadata |
| Visual verification | Yes | Desktop/mobile captures, nonblank canvas analysis, overflow and console checks |
| Playtest QA | Yes | World movement, trainer entry, Arena transition, combat action, exit/re-entry |
| Release checklist | Yes | Version, changelog, release notes, service-worker release key, commit/tag/publish procedure |

Audio, external assets, and the physics engine were not changed by v5. Deterministic fixed-step and gameplay lifecycle coverage remained green in the full suite. No new runtime dependency, network round-trip, polling loop, or external asset was added.

## Release boundaries

This evidence qualifies the source release. Strict-live Receiz probes, production credentials, remote mutations, representative physical-device certification, and prolonged soak testing remain deployment evidence rather than local source-release gates. All unavailable remote authority paths continue to fail closed.

# Wildz reference redesign — design QA

Date: 2026-07-15
Reference: supplied portrait creature-exploration UI
Verified viewport: 390 × 844, production build, clean origin

## Acceptance

- Fullscreen world remains the primary surface.
- Original control contract is preserved: scan, cold/warm/hot feedback, camp, walk/run, context action, train, mission, map, profile, market, rewards, Active Deck, Card Vault, audio, live players, and share.
- Gameplay controls retain the original 3 / centered D-pad / 3 orientation.
- Bottom sheet follows the reference hierarchy: companion/trade carousel above a six-icon sculpted navigation rail.
- Sealcub uses a real illustrated portrait in the sheet and a rendered companion actor in the world.
- Mission is a compact lower-right gameplay meter; the minimap and top overlay capsules use reduced footprints.
- Audio/map and live/share controls sit in horizontal rows below their corresponding top capsules without overlap.
- Active Deck and Card Vault open and close successfully as bottom sheets.
- Console errors/warnings: none.
- Mobile safe area and PWA standalone behavior remain intact.

## Visual scorecard

1. Composition and gameplay priority: pass
2. Reference hierarchy fidelity: pass
3. Creature art and identity: pass
4. Control clarity and reachability: pass
5. Typography and numeric readability: pass
6. Surface/material consistency: pass
7. Overlay density and occlusion: pass
8. Responsive mobile fit: pass
9. Interaction state clarity: pass
10. Functional preservation: pass

Automatic failures observed: none.

final result: passed

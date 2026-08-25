# Steward Construction Implementation Plan

1. Add domain contracts and tests for source-state heads, exact material lots, affinity work, consent, conservation, shelter proof construction, and replay rejection.
2. Extend world commands/events/projection with harvested sources, material lots, consumed lot custody, and structures.
3. Validate harvest reach, canonical source, current source head, verified active card, creature work family, and lawful availability at the service boundary.
4. Validate shelter terrain, ownership, exact material inputs, and one-time consumption at the service boundary.
5. Route both commands through the existing idempotent outbox and canonical Receiz World checkpoint publication.
6. Render nearby sources and shared structures in Three.js, derive fixed collision obstacles from the same structure dimensions, and add natural click interaction.
7. Extend the Foraging Satchel with exact timber/stone holdings and one Trail Shelter placement action.
8. Verify focused contracts, full tests, lint, typecheck, production build, mobile browser interaction, refresh persistence, collision, and console cleanliness.

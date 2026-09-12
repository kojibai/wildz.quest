# Shared journey implementation

Goal: connect companionship, exploration and home life while preserving responsive world interaction.
Architecture: small pure projections and bounded client hooks integrated in PlayCampaign; existing world commands remain authoritative.
Stack: React 19, Next.js 15, TypeScript, existing Three.js world.
Spec: ../specs/2026-09-12-shared-journey.md

- [x] Add owner-scoped companion journal and sanitization tests (wilds-journey / use-wilds-journey).
- [x] Add deterministic next-step model and accessible Living Story panel (wilds-next-step / WildsJourneyPanel).
- [x] Add opt-in local playtest recorder, bounded metrics and export (wilds-playtest / WildsPlaytestPanel).
- [x] Integrate truthful capture, harvest, build, discovery and home events in PlayCampaign; remove artificial harvest settlement delay.
- [x] Add real site directions and contextual discovery descriptions, home proximity recovery, actionable progression.
- [x] Run tests/typecheck/production build; inspect desktop and narrow browser flows; document evidence and human playtest protocol.

Global constraints: no changes to identity/proof authority, no invented companion history, no background telemetry upload, no new asset downloads or rendering complexity. Reuse current approved art/audio; this pass changes experience and systems, not asset style.

# Wildz Flagship Mobile Experience — Release Evidence

This document accumulates reproducible evidence for the flagship mobile-world rebuild. Final comparative scoring and the complete viewport matrix are added during the release-qualification pass.

## Runtime quality and progressive loading

- Production build: `pnpm build` passed on 2026-08-10 after stopping the guarded development runtime.
- Initial `/` app manifest: 23 JavaScript chunks, 2,001.1 KB raw and 544.5 KB gzip, measured from the deduplicated `/layout` + `/page` entries in `.next/app-build-manifest.json`.
- Planning baseline: 836 KB first-load JavaScript. The comparable compressed manifest measurement is 291.5 KB lower (34.9%).
- Noncritical chunks: world map, landmark/Hearttree shell, settlement, ecology, raid, trainer challenge, and Mortal Arena are loaded with `next/dynamic`; trainer and Arena modules begin preloading as soon as a trainer challenge opens.
- Live 390 × 844 WebKit evidence: medium quality, DPR 1.25, 123 renderer calls (76.9% of the 160-call budget), approximately 73,834 triangles (41.0% of the 180,000-triangle budget), all within budget.
- Runtime governor: bounded 120-frame window; one-tier downshift after 120 slow visible frames; one-tier recovery after 600 healthy visible frames; 30-second transition cooldown; hidden frames excluded; device base recomputed on resize, orientation, and reduced-motion changes.

Ignored browser evidence:

- `output/playwright/contextual-world-mobile.png`
- `output/playwright/trainer-challenge-mobile-clean.png`
- `output/playwright/trainer-transition-mobile.png`
- `output/playwright/mortal-arena-zones-active-mobile.png`

## Signature trainer visual and audio pass

### Asset generation

- Image mode: built-in image generator; final project assets converted to optimized WebP.
- `public/game/trainers/lanternforge-keeper-portrait.webp`: 768 × 768, 76 KB. Prompt: original androgynous Lanternforge Keeper bust; lantern shoulder armor; technical expedition coat; glowing geometric identity seal; emerald, charcoal, antique gold, and ember palette; premium stylized 3D; no text, watermark, franchise resemblance, creature, or weapon.
- `public/game/trainers/lanternforge-emblem.webp`: 512 × 512, 35 KB. Prompt: one symmetrical diamond Kai seal nested in an angular lantern; brushed brass and luminous glass; ember light with emerald rim; no text, people, extra symbols, border, or watermark.

### Audio matrix and blocker

Credential probe on 2026-08-10:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

The required external audio provider was unavailable, so no generated MP3 is claimed. The game instead uses its existing gesture-unlocked, settings-aware Web Audio runtime for this pass.

| Category | Event | Runtime cue | Duration | Loop | Group |
| --- | --- | --- | ---: | --- | --- |
| UI | Companion carousel/ability detent | `companion-detent` synthesized 720→880 Hz sine | 0.08 s | No | effects |
| Encounter | Trainer recognized/challenge opened | `trainer-challenge` synthesized 196→880 Hz triangle | 0.68 s | No | effects |
| Combat | Strike impact | Existing `battle-hit` recorded/synth fallback | 0.20 s | No | effects |
| Combat | Danger, victory, defeat | Existing error/boss action/defeat cues | Event-specific | No | effects |
| Ambience | World and arena beds | Existing scene-directed runtime programs | Scene lifetime | Yes | ambience/music |

Runtime integration preserves user-gesture unlock, master/effects/ambience/music settings, mute, scene switching, visibility cleanup, and no per-frame SFX. Remaining audio gap: replace the two new synthesis voices with authored recordings when `ELEVENLABS_API_KEY` is available.

Reference ledger:

- `threejs-audio-generator/SKILL.md`
- `threejs-audio-generator/references/audio-workflows.md`
- `imagegen/SKILL.md`

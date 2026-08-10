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

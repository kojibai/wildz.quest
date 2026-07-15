# Wildz release verification

Date: 2026-07-15. Target: `wildz.quest`. Production preview: Next.js 15.5.19 on local WebKit at `http://127.0.0.1:3000`.

## Result

Automated application gates and the tested production gameplay paths pass. Live Receiz settlement, durable cross-instance listing storage, and public profile publication remain environment/integration dependencies; unavailable rails return an explicit failure and never transfer ownership.

## QA reference ledger

| Required reference | Loaded | Result |
|---|---:|---|
| QA/release checklist | yes | Applied |
| Visual verification | yes | Applied |
| Playtest QA | yes | Applied |
| Release checklist | yes | Applied |
| Game UI quality | yes | Applied; standalone wrapper fixes made |
| HUD readability | yes | Applied; 390px collision fixes made |
| Responsive UI fit | yes | Applied across five target sizes |
| AAA quality gate / scorecard | yes | Applied below |

## Commands and evidence

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`: pass; 150 tests, zero failures.
- `pnpm secret:scan`: pass across 212 tracked text files without printing values.
- `pnpm receiz:doctor`: identity/artifact/proof rails available; live API, checkout, and webhooks require environment configuration.
- Manifest and service-worker header requests: HTTP 200; standalone manifest, maskable icons, root scope, and no-store worker update headers confirmed.
- Browser console: zero errors and zero warnings after gameplay and overlay interactions.
- Canvas: one canvas, 390×657.98 CSS pixels / 487×822 drawing buffer on mobile, DPR 1.25.
- Canvas pixel sample: 4,099 unique colors in a 96×96 sample, channel range 0–255.
- Renderer: 67 calls, 55,738 triangles, 93 geometries, 3 textures; configured budget passed (calls 41.9%, triangles 31.0%).
- First-load route payload reported by production build: 456 kB.

## Player paths exercised

- Automatic Receiz ID and deterministic female explorer creation.
- Run/walk mode, keyboard movement, mobile pointer-drag movement and pointer release.
- Companion training: card XP 136→146, energy 84→78, mission 38%→47%.
- Mission action: XP 146→164, mission 47%→68%.
- Public profile open/close with focus return.
- Public Vault and compact market overlay rendering.
- Market unavailable state confirms no ownership mutation without settlement configuration.
- PWA manifest and service-worker scope/cache headers.

## Responsive artifacts

- `output/verification/wildz-mobile-360x640.png`
- `output/verification/wildz-mobile-390x844.png`
- `output/verification/wildz-mobile-412x915.png`
- `output/verification/wildz-tablet-768x1024.png`
- `output/verification/wildz-desktop-1440x900.png`
- `output/verification/wildz-profile-mobile.png`
- `output/verification/wildz-market-mobile.png`
- `output/verification/wildz-canvas-desktop.png`

## Visual scorecard

| Category | Score (0–3) |
|---|---:|
| Art direction | 2 |
| Hero/player | 2 |
| Enemies/companions | 2 |
| Rewards/interactables | 2 |
| World/environment | 3 |
| Materials | 2 |
| Lighting/render | 3 |
| VFX/motion | 2 |
| UI/HUD | 3 |
| Performance evidence | 2 |

Average: 2.3; no category below 2. The release gate passes. Showcase quality is not claimed.

## Issues found and fixed

- Removed a TypeScript-only assertion from the JavaScript service worker.
- Replaced inherited commerce-card sizing with a true viewport-filling game shell.
- Corrected full-height grid allocation so the world, controls, and command dock fit one viewport.
- Ported formerly wrapper-scoped mobile HUD rules to the standalone shell, removing 390px collisions.
- Prevented a remote profile handle from displaying the local player’s explorer or Vault.

## Deployment and residual risks

- Deploy with the normal Next.js production build/start workflow.
- Configure Receiz access, webhook, and settlement variables from `.env.example` before enabling live transactions.
- Current listing memory is process-local until connected to a durable Receiz public-state rail; do not advertise cross-instance persistence before that integration is configured.
- No external 3D/image/audio provider credentials were present. The game uses preserved procedural art and synthesized audio; the new brand assets are repository-owned SVG/PNG files.

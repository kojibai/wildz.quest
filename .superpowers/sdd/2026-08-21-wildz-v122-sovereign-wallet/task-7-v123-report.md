# Task 7 — V123 wallet browser, performance, and release closure

Date: 2026-08-22
Release head reviewed: `ab76ddd`

## Outcome

The Receiz V123 sovereign-wallet tranche builds and launches as part of the production Wildz game. The Phi instrument is mounted directly below the Kai Klok, opens one exclusive terminal outside the Three.js Canvas, preserves the world/camera/active creature while open, and restores the same world position and active creature after close and refresh.

The production surface remains authority-honest. In this local release environment the Wildz proof session was present but `/api/auth/receiz/me` reported `status: unknown`, so the terminal rendered `AUTHORIZATION REQUIRED`, disabled Send and receive-coordinate creation, and never fabricated a balance, recipient, locator, or receipt. Live Phi transfer is not claimed without the deployment ports listed below.

## Authority and independent review

- Exact coordinated packages: `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` `123.0.0`.
- Official checker: V123, 36 operations, exact compatible range `>=123.0.0 <124.0.0`.
- The final independent security/authority rereview of `377fe64..ab76ddd` returned CLEAN.
- Server capability admission now includes durable recipient lookup only from a `durable: true` limiter.
- Client Send requires both that server-admitted capability and an injected proof-authorization port.
- Recipient projections are normalized and bound to the exact requested username before publication.
- Task 5 terminal HMAC, exact CAS winner, ambiguity journal, and execution recovery remained unchanged through the final UI fix.

## Release gates

| Gate | Evidence |
|---|---|
| Full test suite | `pnpm test`: 1,765/1,765, 161 suites, 0 failures |
| App typecheck | `pnpm typecheck`: exit 0 |
| Test typecheck | `pnpm exec tsc -p tsconfig.test.json --pretty false`: exit 0 |
| ESLint | `pnpm lint`: exit 0 |
| Receiz checker | `pnpm receiz:check`: exit 0, V123 `ok: true` |
| Architecture lock | `pnpm receiz:architecture-lock`: exit 0, 491 runtime files |
| Receiz conformance | `pnpm receiz:conformance`: 15/15, 0 failures |
| Production build | `pnpm build`: exit 0, 19/19 static pages; only the existing upstream `web-worker` dynamic-dependency warnings |
| Diff integrity | `git diff --check`: exit 0 |

The performance suite includes 10,000-frame wallet diagnostics proving zero refresh, receive, transfer, cache-write, or publication work in the gameplay frame path. Source and integration contracts also keep the wallet controller outside Canvas, preserve the same PlayCampaign/Canvas key across card switches, bind wallet cache authority to player plus proof-session generation, and keep persistence/restore owned by the existing continuity checkpoint rather than wallet state.

## Production browser evidence

Production server: `http://127.0.0.1:3000`, Next.js 15.5.19 production build.

- Desktop terminal screenshot: `output/playwright/wallet-v123-release/wallet-v123-desktop.png`.
- Mobile 390×844 screenshot: `output/playwright/wallet-v123-release/wallet-v123-mobile-390x844.png`.
- Desktop terminal retained the visible live world behind a restrained scrim.
- Mobile terminal occupied exactly 390×844 with zero document overflow.
- Mobile dialog controls measured a minimum 44×44 CSS px; bottom tabs measured 50 px high.
- Keyboard interaction was exercised in-browser: Send received focus and ArrowRight selected Receive.
- Close restored focus to the Phi instrument. Position remained `X -2 · Z -1`, active creature remained `Luuvual`, and the same position/creature restored after a full page reload.
- Two canvases were present at mobile size: the world drawing buffer was 487×1055 for a 390×844 CSS surface and the HUD map buffer was 180×180 for 64×64 CSS.
- Visual inspection found a nonblank world, readable desktop/mobile hierarchy, no clipping, no horizontal page overflow, and no wallet/HUD overlap.

The bundled Three.js canvas-inspector script could not run because its own skill installation lacked `@playwright/test`; the direct Playwright DOM/canvas inspection and screenshots above were used instead. Production diagnostics are intentionally disabled, so `window.__THREE_GAME_DIAGNOSTICS__` was not available in the production bundle.

The browser console had no uncaught JavaScript exception or React/Three warning. It did record three expected HTTP 401 resource entries when the unauthenticated local session opened the wallet (`summary`, `capabilities`, and `ledger`). Those exact failures produced the visible `AUTHORIZATION REQUIRED` state. Authenticated live-rail browser evidence is therefore still required before claiming live balances or transfers.

## Remaining non-SDK deployment requirements

V123 supplies the SDK rails. The following are application/deployment ports and remain deliberately fail-closed:

1. Cross-instance durable transfer journal and authenticated terminal-record store.
2. Server-derived proof-authority admission/context resolver with current Kai, revocation, owner, and exact-head checks.
3. Exact transfer-context and encrypted attempt/receive-locator secrets.
4. Durable distributed recipient-lookup limiter.
5. Browser identity-key proof-authorization port wired to PlayCampaign.
6. Authenticated live V123 execution evidence covering commit, lost response, exact recovery, duplicate idempotency, terminal reload, and second-server continuity.
7. Resource/card transfer remains unavailable until exact multi-participant inventory/ownership execution is implemented.

No local balance, guest authority, process-only journal, plaintext recipient coordinate, preview result, or fixture is used as a substitute.

## Reference ledger

| Reference | Consulted | Used | Evidence / failure reason |
|---|---:|---:|---|
| `threejs-qa-release/SKILL.md` | Yes | Yes | Production build/launch, visual inspection, interaction, console, responsive, and release evidence workflow |
| `threejs-qa-release/references/qa-release-checklists.md` | Yes | Yes | Functional, playtest, visual, performance, and release matrix |
| `threejs-qa-release/references/checklists/visual-verification.md` | Yes | Yes | Desktop/mobile screenshots, nonblank world, fit and readability inspection |
| `threejs-qa-release/references/checklists/playtest-qa.md` | Yes | Yes | Open/tab/close/reload continuity and keyboard path exercised |
| `threejs-qa-release/references/checklists/release.md` | Yes | Yes | Build, console, responsive, performance, and handoff evidence |
| `threejs-game-ui-designer/checklists/game-ui-quality.md` | Yes | Yes | Authority truth, status readability, exclusive modal hierarchy |
| `threejs-game-ui-designer/checklists/hud-readability.md` | Yes | Yes | Phi placement/readability below Kai and no overlap |
| `threejs-game-ui-designer/checklists/responsive-ui-fit.md` | Yes | Yes | Desktop/mobile geometry, safe viewport, no overflow, 44 px controls |
| `playwright/SKILL.md` and CLI workflow/reference | Yes | Yes | Named browser session, snapshots before refs, real clicks, keyboard, reload, screenshots, console/requests |
| Bundled `inspect-threejs-canvas.mjs` | Yes | No | Failed before navigation because the skill runtime could not resolve its own `@playwright/test` dependency; direct Playwright inspection substituted |

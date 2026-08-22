# Task 6 — Sovereign HUD instrument and responsive terminal report

Date: 2026-08-22
Base: `47f322f`

## Outcome

Task 6 adds the in-world Phi reserve instrument directly beneath the Kai Klok and one exclusive, accessible Wildz Sovereign Terminal. The terminal remains outside the Three.js Canvas and gameplay reducers, preserves the running world behind its desktop scrim, and presents five exact surfaces: Overview, Send, Receive, Assets, and Ledger.

The visual language is a restrained obsidian/mineral instrument with etched rules, stable numeric columns, Phi gold only for admitted value and deliberate authority, and mineral green only for verified state. It avoids generic dashboard cards, crypto motifs, external wallet chrome, tutorial language, and fabricated balances or completion.

## Truth and authority behavior

- The HUD abbreviates only its visual value; its accessible name and terminal preserve the exact admitted micro-Phi amount.
- Verified display cents are formatted with strings, never JavaScript `Number`, so values beyond IEEE-754 precision retain every admitted cent.
- Loading, authority-required, offline-verified, failed/revoked, pending recovery, zero-write rejection, and committed outcomes use distinct text and geometry in addition to color.
- Send is visibly fail-closed while the production transfer runtime or durable recipient lookup is unavailable. The UI cannot promote staged or unknown state to success and has no local settlement fallback.
- The authorization control is disabled unless a proof-authorizing callback is admitted. When present it requires a 900 ms pointer hold. Pointer up, pointer leave, pointer cancel, lost capture, blur, hidden visibility, orientation change, and overlay replacement cancel the gesture.
- Escape, scrim close, and header close cannot release wallet modal admission during staging, an armed authorization pointer, or authorization in progress.
- The browser receives and renders sanitized controller projections only; no raw proof, subject, owner, head, authority, digest, or token field is introduced.

## Responsive and accessibility behavior

- Desktop: left-anchored `clamp(520px, 46vw, 760px)` terminal with the live world remaining visible.
- Tablet/narrow laptop: centered bounded sheet.
- Mobile: full safe-viewport terminal, a five-item bottom rail, one internal vertical scroller, and confirmation above the bottom inset.
- Short landscape: compact left rail and shallow header.
- Every terminal button/input/select has a 44 px floor; authorization is 52 px. Safe-area insets cover header, content, footer, navigation, and HUD placement.
- The terminal is one labeled `aria-modal` dialog with a tablist/tabpanel navigation model. Existing modal lifecycle owns focus containment, Escape, and exact focus return.
- The HUD origin remains mounted but hidden/inert under exclusive ownership so the exact button can become enabled and receive focus on release without remounting the world.
- Long values and usernames use bounded tracks, tabular numerals, ellipsis where identity is secondary, and `overflow-wrap: anywhere` where exact content must remain visible.
- Reduced-motion removes terminal and instrument animation/transition without removing state feedback.

## Strict TDD evidence

Initial RED: after adding TSX tests to the test compiler, `tsc -p tsconfig.test.json` exited 2 only for the missing `WildsWalletInstrument`, `WildsWalletTerminal`, and deterministic fixture modules.

Precision RED: the focused render test exposed an incorrect rounded USD display after a 20-digit cent value crossed `Number` precision. The formatter was replaced with exact string grouping and cents placement.

Ownership RED: the campaign test proved that wallet modal admission was released before checking whether an authorization could close. The guard now runs before owner release.

Placement RED: the responsive CSS test proved the instrument was only source-adjacent, not geometrically beneath Kai. The left instrument home now gives Kai row 1 and the wallet row 2, with audio in its separate 44 px column.

## Reference ledger

| Reference | Used | Consequence |
|---|---:|---|
| `references/ui-patterns.md` | Yes | Authored HUD instrument and owned game terminal; no dashboard/card-grid shell; stable numeric containers and world-path protection. |
| `checklists/game-ui-quality.md` | Yes | Single projection source, explicit async/failure states, visible disabled/focus states, world-cohesive material language. |
| `checklists/hud-readability.md` | Yes | Fixed HUD footprint below Kai, redundant status light/text, exact accessible value, no HUD USD. |
| `checklists/responsive-ui-fit.md` | Yes | Desktop/centered/mobile geometry, bounded tracks, one content scroller, long-value and long-username fit. |
| `checklists/mobile-input.md` | Yes | Pointer event cancellation, safe areas, 44/52 px targets, touch-owned scroll regions, portrait and short-landscape rules. |

## GREEN verification

- Focused wallet UI and fixture render tests: 8 pass, 0 fail.
- Wallet controller plus ownership/HUD integration tranche: 55 pass, 0 fail.
- `pnpm exec tsc -p tsconfig.test.json --pretty false`: exit 0.
- `pnpm typecheck`: exit 0.
- Scoped ESLint for every changed TS/TSX file: exit 0 with no warnings after refactor.
- `git diff --check`: exit 0.
- Full suite, production build, screenshots, console inspection, and viewport/browser evidence are intentionally reserved for Task 7; no browser-release claim is made here.

## Remaining deployment boundary

The UI is production-honest but live send remains unavailable until the complete Task 5 runtime and proof-authorizing browser integration are admitted. The terminal never substitutes a local consent object, fake recipient, process-local journal, or preview-shaped completion. Resource/card row detail also remains unavailable until their strict sanitized projections and authoritative transfer rails exist; current counts are labeled as admitted summary counts only.

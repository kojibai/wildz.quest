# Building, mobile controls, and profile refinement

Changes are in the main working tree. No deployment was performed.

## Behavior

- Select a building piece, then tap a valid nearby world position to place its plan. Material deposits and work retain their authenticated construction stages. An invalid position displays its resolution. Selecting a new kind clears the old preview.
- The compact mobile tray remains open while the uncovered world and movement controls receive input. Minimize/restore retains the chosen piece. The Living Construction catalog includes individual pieces and routes functional workshops/storage back to their actions.
- Solo authenticated players can build supported blueprints and tools. Material, proximity, placement, proof and ownership checks remain. An unavailable Phi award no longer prevents lawful construction.
- Framed and later floor geometry supplies walkable support; box contacts and movement floor resolution respect construction surfaces.
- A Dive tap persists toward a bounded depth target instead of clearing after one animation frame. Manual ascent cancels it; existing pressure, seabed and stamina bounds remain.
- Browser identity exports visibly include the handle, Kai beat:step:pulse, and full pulse count, with the same export moment in their searchable filename.
- `/u/[handle]` is a standalone public profile page. The owner profile reports publishing, published and recovery states, provides a retry button, and links to the public page.

## Verification

- `pnpm test` initially found one obsolete profile route assertion. Updated it to enforce the standalone page and absence of the game shell. Recompiled the tests, ran its 7 tests, then ran the full compiled suite: **2,171 passed, zero failed**.
- `pnpm typecheck`: passed.
- `pnpm build`: passed, including final type and lint checks.
- `git diff --check`: passed.
- Production preview: `http://127.0.0.1:3000`. Mobile and desktop profile routes mount without a canvas. The development-only build fixture returns HTTP 404 in production.
- Browser fixture at 390 × 844: selecting Wall, tapping the world, tapping movement, minimizing, tapping the world again, and restoring all completed. This is isolated UI/input routing evidence, not an authenticated end-to-end construction session.
- Floor edge/support, persistent dive, solo material construction, zero-award settlements, replay/tamper rejection and identity restoration are covered by regression tests.
- Reviewed mobile seal artwork and mobile tray screenshots. Earlier desktop artwork capture clipped below the viewport; the final mobile capture shows the complete artwork.

Artifacts under `output/playwright/`: `build-mobile-final.png`, `build-mobile-minimized.png`, `seal-mobile-final.png`, `profile-production-mobile.png`, `profile-production-desktop.png`. The final tray removes the redundant pre-placement button shown in the earlier mobile fixture screenshot.

## Scope and remaining measurement

No account was externally published during QA. The production profile smoke check used an unpublished handle. Real-device GPU/frame-time measurements and a live authenticated building/diving playthrough were not performed in this pass. The shared construction texture refinement is not an AAA graphics certification. Legacy blueprint structures and individual-piece support remain distinct proof records; this pass unifies their catalog and usable workshop/storage controls, without inventing support anchors for legacy structures. Individual pieces still do not issue Phi awards.

Build warnings: existing SDK/web-worker dynamic dependency and an existing `WildsStewardEnvironment` memo dependency warning; the development artwork fixture also has a non-blocking Next.js img warning. The production fixture is gated.

## Skill and reference ledger

Read and applied:
- UI skill: UI patterns, game UI quality, HUD readability, responsive fit and mobile input references.
- Playwright skill and CLI reference for browser fixture and production smoke checks.
- Graphics skill: visual scorecard, implementation blueprint, model/render recipes, material-lighting quality, performance-safe visual detail, procedural-model quality.
- Generator skill sourcing decision: Tripo and Gemini credentials unavailable. Reused piece geometry with small shared procedural timber, stone and roof textures; no external assets added.
- QA release skill: `references/qa-release-checklists.md`, `references/checklists/visual-verification.md`, `references/checklists/playtest-qa.md`, `references/checklists/release.md`.

The checks above distinguish verified results from the full playtest/performance items that were not measured.

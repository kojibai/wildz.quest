# Final integration fix report

Date: 2026-08-11
Base: `9753b1dc1b944b6e995b9ff6fc2537b883b330e3`
Scope: final integrated blockers only; this is not a whole-game showcase claim.

## Outcomes

- Profile is a real accessible explorer control; Market is reachable from Card Vault without restoring the removed chassis.
- Selected named abilities are controlled by the campaign and causally enter `use-field-ability`; pointer and keyboard wheel paths select the same real reducer action.
- The stage owner union covers map, trainer, combat, landmark, settlement, ecology, raid, reward, ceremony, memorial, profile, market, command, and multiplayer. Noncombat modal Escape lifecycle is centralized so the earlier overlay listener cannot invalidate it.
- Explorer rendering derives from immutable character genesis. Legacy continuity `avatarStyle` remains persistence-compatible but cannot change rendered proof identity.
- Dead `WildzSocialDeck` ownership was removed. Focus restoration RAFs are cancellable and validate connected/enabled origins. Touched-module hook warnings are resolved.
- Local HTTP passive proof bootstrap now returns logical `unavailable` before nonce admission when the proof sealer is unconfigured; configured deployments retain nonce-first fail-closed admission.
- Profile and Market shell ownership is controlled by `WildzApp` for the complete overlay lifetime. The world and utility roots remain inert and `aria-hidden`, focus is trapped in the shell dialog, Escape closes it, and focus returns only to a connected enabled stable origin.
- Keyboard A transfers real DOM focus to the listbox that owns `aria-activedescendant`; arrows navigate, Enter commits, Escape cancels, and both exits restore the companion button. Pointer hold-slide remains independent and causal.
- Disconnected Market presentation no longer performs a passive authority request. It renders a local unavailable state while the server route remains fail-closed.

## TDD evidence

Initial RED reproduced six integration blockers. Additional browser REDs reproduced:

1. unconfigured local proof sealer returned transport 401 when WebKit could not retain a Secure nonce cookie over HTTP;
2. first-press Escape failed because the overlay hook synchronously invalidated the modal listener;
3. the corrected hook initially surfaced a touched exhaustive-deps warning.

The correction reviews added RED fixtures for persistent shell ownership, listbox navigation, proof-invariant lifecycle projection, disconnected Market refresh policy, arrow-key world isolation, owner-driven wheel cancellation, and visible modal focus boundaries. The final browser RED identified a hidden `display:none` file input incorrectly counted as the Profile trap's last focus target; the focused behavioral test failed before the shared eligibility filter was corrected. The final blocker suite is 15/15. Full result: 1,058/1,058 tests across 109 suites.

## Production browser evidence

Exact replay: product commit `c26ae652894db84868c0343c108c048aa32d0fb4`, Next build `pVMRsX8Mh21tHuB69B34C`, Chromium 152, `http://127.0.0.1:49816/`, 390×844 at DPR 1, 2026-08-11T05:10:30.321Z–05:10:37.332Z. The saved replay script installed console, page-error, request-failure, response-status, and request listeners before navigation. It observed 84 requests with 0 console warnings/errors, 0 page errors, 0 failed requests, and 0 HTTP responses ≥400.

Retained machine-readable evidence:

- Script: `docs/release/evidence/final-integration/final-integration-evidence-script.js` — SHA-256 `0cbc544102b97e5268f89a33f11e24a18446dbc311dd9f5fea9666254af314f9`.
- Result: `docs/release/evidence/final-integration/final-integration-evidence-result.json` — SHA-256 `0a7fd11f3c8589cd406a473a0fbf4ce751239f733363221f02cfcd48cd27fa9c`.
- Manifest: `docs/release/evidence/final-integration/final-integration-evidence-manifest.json`; all recorded tracked artifact hashes and byte sizes were independently revalidated.
- Screenshots: Profile `2cab5576…dc7ac2`, Market `b5e4fcfe…4b65cd`, keyboard listbox `6ae135e4…77ba8`, pointer wheel `b4df6c2c…964dd`, owner cancellation `513977f6…743a6`; full values are in the manifest.

Exact commands are retained in `manifest.commands`: `pnpm start -p 49816`; cached Playwright CLI fresh-session open; and saved `run-code` replay from the tracked script. The replay deliberately writes a new capture under `output/playwright/`; the tracked JSON and screenshots remain the immutable recorded run. The complete claim predicate passed via `jq -e`, the result and manifest parse via `jq`, and every manifest hash/size was recomputed from disk.

- Profile (`.profile`): the real explorer origin opened the shell dialog; world and utility roots stayed inert, the world was `aria-hidden`, repeated W/Arrow/A and two companion action attempts left X/Z, energy, XP, bond, event, and selection byte-equal. Twelve forward Tabs wrapped `Edit profile → Upload Identity Seal or Record → Save Identity Seal → Return to world` three times without leaving the shell. Escape restored the connected identity origin.
- Market (`.market`): World tools → Card Vault → Open Market held the world inert/`aria-hidden`, rendered the local unavailable state, issued zero `/api/market/listings` requests, trapped twelve Tabs, and restored the connected persistent world-tools origin after Escape.
- Keyboard ability (`.keyboardAbility`): A moved actual DOM focus to a `tabIndex=0`, `role=listbox` composite. Its `aria-activedescendant` referenced exactly one `role=option[aria-selected=true]`. Left, Right, Up, and Down each changed the active option while X/Z remained exactly -2/-1 after every key. Enter committed Emberglide Bond and restored companion focus; the next Enter caused energy -2, XP +4, bond +2, and a changed event. Ordinary Escape also restored companion focus.
- Pointer ability (`.pointerAbility`): a real pointer hold acquired capture, upward slide selected Prism Pulse, release committed the same label and released capture, and tap caused energy -1, XP +4, bond +1, a changed event, and the real contextual dialog.
- Exclusive cancellation (`.ownerCancellation`): A opened the focused keyboard wheel, the companion acquired actual pointer capture, and the real Profile origin claimed exclusive ownership. The wheel synchronously unmounted, capture released, focus stayed in the Profile shell rather than returning to the inert companion, and the world stayed inert. Ordinary commit later restored companion focus.
- Proof mismatch: browser state was not fabricated. The automated fixture invokes production lifecycle helpers for bootstrap, actual artifact commit, and identity reset. The same genesis plus conflicting legacy `avatarStyle` produces identical proof-derived projection/render style through each lifecycle.
- Memorial: no real memorial-bearing QA profile was available. Browser evidence was not fabricated; automated ownership, focus trap, Escape, and cleanup contracts qualify this path.

## Final gates

- `pnpm test`: 1,058 passed, 0 failed, 109 suites.
- `pnpm typecheck`: passed.
- `pnpm lint`: exit 0 with no warnings; the touched `WildzApp` dependency warning was resolved with a stable callback and complete dependency list.
- `git diff --check`: passed.
- `pnpm build`: passed; `/` 561 kB first load; known `snarkjs`/`web-worker` dynamic dependency warning remains.
- `pnpm release:check`: passed; 1,058 tests, typecheck, Receiz v118 integration, 15/15 conformance, warning-free lint, 745-file secret scan, build, and doctor.
- `python3 /Users/bjklock/.codex/skills/threejs-game-director/scripts/audit_reference_report.py --premium --audio docs/release/flagship-mobile-experience.md`: passed (`Director report audit passed.`).

## Honest residuals

- Scores are unchanged: this closes integration correctness and reachability blockers but does not add world-wide authored content, audio, or performance evidence.
- Memorial and conflicting-continuity restoration remain automated-only in this final browser replay because no real qualifying profile/artifact was available; proof invariance is exercised through production-used lifecycle constructors, not a source-regex or phase-label claim.
- Market authority absence intentionally remains visible for an unauthenticated local profile.
- The broader performance, audio, content-breadth, and cross-location residuals in `docs/release/flagship-mobile-experience.md` remain.

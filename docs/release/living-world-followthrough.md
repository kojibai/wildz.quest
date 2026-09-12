# Living world follow-through

This release adds portable explorer memories, useful shelter activities, nearby owned companion residents, authored discovery guidance, and small construction rewards.

## Delivered

- Owner-scoped journey notes travel in the next saved Identity Seal and merge across saves. Recollection uses grounded journal templates without modifying creature proofs.
- Real shelters offer rest, nearby workbench/cache actions, and a daily owned-companion suggestion. Up to two eligible owned companions appear near home; active, support, retired, and unavailable companions are excluded.
- All twelve existing discovery families have an authored premise and objective. Route guidance respects admitted abilities and distinguishes arrival from completion.
- Valid material-backed construction work can earn up to Φ0.01 per step. Existing emission ceilings permit smaller awards (including Φ0.001) or zero; replay, tampering, and legacy events cannot mint duplicate rewards.
- Exact proof validation caching reduces repeated owned-world projection work while preserving synchronous save correctness. See [measured benchmark](./owned-proof-cache-benchmark.md); cold performance is worse, and this is not a browser FPS claim.

## Verification

- `pnpm test`: 2,252 passed, 0 failed, 206 suites.
- `pnpm build`: passed, including TypeScript checking.
- `pnpm lint`: passed with two pre-existing warnings in BuildGuidanceBrowserFixture and WildsStewardEnvironment.
- Receiz architecture lock: 653 runtime files passed. Receiz v126 integration check passed. SDK conformance previously completed with no failures during this release.
- Secret scan: 1,355 text files passed before this report was added; no secret values printed.
- Desktop browser: production build started on port 3019; world renders and Profile opens with cached player identity and published companion card. Development home fixture renders two existing creature models; rest/tool actions and reduced-motion toggle respond.
- Development fixture is gated with `notFound()` outside development. No new external assets or audio were introduced.

## Remaining evidence and limitations

- The public bjklock profile and supplied card were still unavailable at the last live check. The original Identity Seal belongs to the user; its owner must publish from that authenticated session. This release does not fabricate publication or bypass registry validation.
- Human playtesting, mobile device performance, and sustained frame-time validation remain necessary. Automated tests and desktop inspection do not establish retention, delight, or universally freeze-free play.
- Nearby home residents are owned companions, not simulated real-player visitors. Daily home suggestions and authored site stories build on existing systems; they are not an unlimited new quest system.

## Reference ledger

Read: threejs-qa-release SKILL.md, references/qa-release-checklists.md, references/checklists/visual-verification.md, references/checklists/playtest-qa.md, references/checklists/release.md. QA is partial for the explicit remaining evidence above; no AAA-quality or complete human-playtest claim is made.

Production deployment uses the existing GitHub main → Vercel integration for wildz.quest. The user explicitly approved committing these files on main after reviewing the publication question. Deployment outcome is reported separately with the actual commit and deployment identity.

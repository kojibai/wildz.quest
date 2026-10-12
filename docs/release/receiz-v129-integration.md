# Receiz v129 package alignment and capability evidence

Wildz pins the public `@receiz/sdk`, `@receiz/mcp-server` and `@receiz/ai-skills` packages to `129.0.0`. Read-only `pnpm view <package>@129.0.0 dist.integrity --registry=https://registry.npmjs.org` on 2026-10-11 independently returned the exact SHA-512 values already present in `pnpm-lock.yaml`:

| Package | Published integrity |
| --- | --- |
| `@receiz/sdk` | `sha512-Y8WMYMVim5LrMpsCP85kxYdR6yQpBmIgt0DIWqXy320BqCECxg8du+AOUwzWJsAOQeJSorIPkysdoTnQPsWsrQ==` |
| `@receiz/mcp-server` | `sha512-BN+x3ETZ8DeaEi4ARWOEpw8uUWI88m3BFSOrzPyy06DPbCfT2DdP4rdaWgixVYtVh4OPlPOurEapxm0thxDGEg==` |
| `@receiz/ai-skills` | `sha512-EMWSpxTTZCMIoGeXHaMj4Lw0XQIcQIhekRYZkpNOEG5T6gavtrm920zqmmxwI7dLNNbap6p75hlYV8iqtXRDOQ==` |

The shipped constitutional ruleset and registry version remain `127.0.0`, with exact registry digest `8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`. The current 60-operation matrix digest is `c4e0cff348b62f31db2bb2ffdeec533a92ca3a6d476757bb9b559ac58a7875e1`, and its compatible package range is `>=129.0.0 <130.0.0`. `receiz.app.json` and `receiz.generated.json` retain every operation/authority/evidence field; only their old package ranges changed. Retained V124/V125/V128 wire identifiers, historical package records and prior proof bytes are preserved. `scripts/receiz-v128-check.mjs` keeps its existing filename but checks the actual v129 identity.

The actual generated catalogs expose 704 public SDK functions, 425 client methods, 356 full MCP tools and 43 AI skills. The AI index schema is `receiz.ai-skills-index.v129`; the retained MCP parity schema is `receiz.mcp.sdk-ai-capability-parity.v125`. The public-function inventory digest is `af61e23d857fa1fa54fd2a09d5b0f02afadd55b6a02936dcacbae300f124cb94`. These catalogs describe source/package capabilities beneath sealed proof authority.

## Inspected source contracts

Inspection used the installed SDK current constants, public function inventory, `docs/registered-native-runtime.md`, `docs/offline-proof-valuation.md`, and `docs/capability-execution-coverage.md`; the same-release MCP README, exported full tool inventory and exact schemas; then the AI commerce skill/no-database-store example, registered native session example, full financial tool map, proof valuation reference and release skill/manifest with KKS temporal doctrine.

Registered native calls bind the exact public OIDC client ID, preserving case and `rc_`, through SDK application configuration, challenge audience, proof grant, current complete subject-source publication, authority session, replay and execution. Subject identity and the stable Wildz product/world namespace remain separate. A secret or username cannot replace this binding. Qualification must inspect every called operation and deployed dependency; syntax, a scope catalog or a constructor alone is insufficient.

Native Market configuration now takes the existing Wallet `RECEIZ_CLIENT_ID` first. `RECEIZ_APPLICATION_ID` is a compatibility fallback only when that client is absent. Next publishes this public ID alone, and the server resolves the same configuration again at each native proxy edge. The production sign-in redirect was read without publishing or signing: it identifies client `rc_PtuBxB_Gbm9OkFeflZiwCz-d` and callback `https://wildz.quest/api/auth/receiz/callback`. Secrets were neither printed nor changed. Build's existing world namespace remains `wildz`.

Native session opening signs a fresh challenge nonce after the separately approved grant exchange. Public value issuance follows explicit seller activation, freezes a bare public card and its complete sealed native projection certificate, and matches the existing six-field native listing `sourceDigest`. The native journal law and old replay bytes remain unchanged. The first public issuance is retained across listing changes and verified descendants; it is labelled as public proof issuance, never relabelled as the private capture origin. Private Identity Seal, player, Original and account bytes cannot enter the public replay. Failed value publication leaves native purchases enabled and provides a retry in Activity.

Visible card values are checked lazily in one bounded worker queue. Workers terminate after each result, error or timeout; no keys, bearer, payment or subject-authoring capability enters them. USD uses the actual admitted Connect conversion basis, with Phi retained when that basis is unavailable. Model samples, asking prices, actual completed sales and ownership transfers remain distinct. Private archived receipts require an explicit older-history check and independent receipt admission; browsing does not bootstrap that work or clone unrelated local archives.

## Exact MCP purchase and value surfaces

The [saved full-library descriptors](receiz-v129-mcp-market-tools.json) carry the actual complete schemas for the following 13 adapters. Strict top-level schemas reject additional properties; nested financial `body` objects preserve their documented SDK inputs. Mutation adapters preview first and require the same arguments plus the exact single-use confirmation digest before dispatch.

| Surface | Exact MCP input | Implemented boundary |
| --- | --- | --- |
| `receiz_connect_wallet` | `{}` | Authenticated wallet observation; `receiz:wallet.read`. |
| `receiz_connect_transfer` | `{ body, options?, confirmation? }` | Delegated transfer; `body.recipientUserId`, `unit: "usd" \| "phi"` and corresponding decimal amount; retain nonce/idempotency identity. |
| `receiz_connect_checkout` | `{ body: { amountUsd, ... }, confirmation? }` | `amountUsd` is a nonempty string; SDK validates the decimal. Card-session creation with `receiz:payments.create`. |
| `receiz_connect_checkout_session` | `{ query: { checkoutSessionId?, sessionId? } }` | Only the two named query keys are allowed; session/provider observation with `receiz:payments.read`. |
| `receiz_payments_embedded_checkout` | `{ body: { username, amountUsd, ... }, confirmation? }` | Public named-merchant card-session route; existing merchant/provider admission. |
| `receiz_commerce_one_click_checkout` | `{ body: { tenantHost, amountUsd, ... }, confirmation? }` | Card-session composition. Applying wallet funds returns `wallet_settlement_execution_required`, with zero wallet application and no card request. |
| `receiz_v123_value_execute_settlement`, `receiz_v123_value_execute_reserve` | `{ input, confirmation? }` | Distinct canonical SDK value rails and existing source/admission prerequisites. |
| `receiz_v123_value_execution_by_idempotency` | `{ input }` | Read existing outcome before retrying an unknown result. |
| `receiz_bearer_artifact_claim` | `{ artifactReference, confirmation? }` | Complete-source verification, held SDK-issued sealed artifact, canonical `ownership.claimBearerAsset`, verified sealed successor and private custody output. No caller-selected owner/head/card payload. |
| `receiz_proof_value_inspect` | `{ artifactReference, valuationKaiUPulse, ...documentedBasis }` | Local `projectReceizProofValueV129`; explicit decimal uPulse. |
| `receiz_proof_value_sample` | `{ artifactReference, valuationKaiUPulses, ...documentedBasis }` | Local `sampleReceizProofValueV129`; 1–256 explicit decimal coordinates. |
| `receiz_proof_value_replay_verify` | `{ replayReference }` | Local `verifyReceizProofValueReplayV129`. |

Artifact/replay references match `^receiz:file:[a-f0-9]{64}:.+$`. Valuation basis fields are the actual `expectedProofDigest`, `expectedHistoryHead`, `policy`, `rarityPolicy`, `marketReferenceRule`, `saleRecoveryReferences`, `usdBasis`, `askingPricePhiMicro` and `includeReplay`. References are verified exact workspace sources; caller-shaped source/runtime/sale JSON is inadmissible. Readers allow 64 MiB files, 256 KiB arguments, 256 samples/recoveries and 8 MiB output, rejecting exceeded limits rather than truncating proof.

There is no standalone tool named for an atomic Wildz purchase. The documented composition separates funding, admitted Reserve credit, renewed quote approval, payment, seller proceeds, complete delivery, canonical claim, buyer custody and asset use. Card-session success alone cannot establish purchase or ownership. Valuation performs zero network, file, custody, payment or approval writes; intrinsic value, selected market reference, asking price and executed sale price stay distinct. Missing historical origin, precision, carried history or accepted sale joins remain explicitly unavailable.

The full-library inventory differs from the reviewed Marketplace nonfinancial 195-tool allowlist. That restricted profile excludes the wallet, checkout, transfer, claim, Settlement/Reserve execution adapters and the three newly added valuation tools. The retained read-only `receiz_v123_value_execution_by_idempotency` lookup remains enabled. Historical HTTP commerce methods require an explicitly configured compatible host; default compatibility denial is intentional. Legacy `connect.mintNote` remains disabled, and raw token-only note claims have no current enclosing-source-bound MCP adapter. These exclusions cannot be worked around by treating a method list as authority.

## Observed qualification and remaining evidence

The official v129 repository checker passed with zero blocking findings after package-range alignment. It retains the reviewed universal-entrypoint scanner exception only after independently parsing imports and rejecting every compiler symbol on the runtime entrypoint. The architecture lock passed. All 27 targeted release identity, doctrine, matrix, function inventory and schema-boundary tests passed; targeted script/test ESLint and `git diff --check` passed. SDK conformance passed all 15 checks with reported zero network and database calls; full MCP initialization/list/conformance also passed all 15 checks with an explicitly blocked fetch, zero network calls and zero writes. Conformance labels its emulator evidence `sandbox-only`.

The enrolled-device `receiz:offline-qualification` sealing exercise was not run in this release-alignment task: no already-enrolled disposable `WILDZ_TEST_SEAL_DIRECTORY` was provided. The script continues to reject missing enrollment and never enrolls implicitly. This does not substitute for fresh selected-artifact or physical-device verification.

A genuine production-pinned 6,603-byte artifact from the existing Receiz checkout was also verified with installed SDK `129.0.0`, network access replaced by a rejecting fetch, and no verification-root override. `verifyReceizArtifact` returned `verified-artifact`; `projectReceizProofValueV129` returned `available` under `phi/kosmos-vφ-5` / `b05b2049`; two exact sample coordinates exported and passed `verifyReceizProofValueReplayV129` as `verified-replay`, with zero writes. The artifact digest was `e021bcfb9215cd939c6ee7dbef29cca31607fa75dfbe95b5bdd2d1d3ddd85963`, and the replay digest was `9d895a11289fe5902a13dbb3a2c55eca49db4728194259283e95dc3acd67b1bc`. Source payload and replay bytes were not copied into Wildz. This proves the actual SDK calculator and offline replay path; the artifact is not a Wildz card and does not qualify Wildz's card-bound publication happy path.

The enclosing integration passed 4,443 repository tests with zero failures and one existing skip. After the final publication retry correction, 236 focused Market, Wallet, native binding, session and storage checks passed with zero failures. TypeScript compilation, ESLint, architecture lock, secret scanning and the optimized production build passed. Mobile fixture review confirmed card front/back, compact detail navigation, USD/Phi chart controls and review → payment → accepted delivery UI; those transactions were explicitly simulated. Independent review verified the frozen issuance retry and retained native journal compatibility.

Authenticated deployed server/database qualification, actual wallet funding/credit, payment, seller proceeds, complete bearer delivery, claim/custody/use, provider completion and physical-device behavior remain separate evidence. No live financial action or new public issuance was performed. Passing package checks, descriptors and fixtures does not establish those live stages.

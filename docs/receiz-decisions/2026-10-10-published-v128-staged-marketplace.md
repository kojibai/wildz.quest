# Receiz capability-gap decision: staged Wildz marketplace purchases

Status: reviewed capability audit; Wildz-only staged implementation authorized after the corrective wallet commit. No atomic sale or automatic refund capability is claimed.

## Exact release identity

- Installed `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills`: `128.0.0`, without an unpublished patch or adjacent Receiz change.
- Public SDK function inventory: `receiz.sdk.public-functions.v1`, 680 entries, digest `687bdd064b49bf7df1c32eb4ab3c0f1389c80c8bc90d7cfbec32147db1cc73ad`.
- Registry digest: `8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`.
- Operation-matrix digest: `940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`.
- Compatible package range: `>=128.0.0 <129.0.0`.
- Host source audited read-only at released Receiz HEAD `191f4b933`; host source evidence below is evidence of that implementation, not a new endpoint proposal or live service qualification.

## Requested outcome

An owner lists an exact creature or resource package, another player reviews its USD price and actual connected-wallet Phi payment, and both players can complete and recover the purchase. The buyer receives verified usable custody. A lost reply does not charge twice, replace the asset Original, or make a payment receipt appear to confer ownership.

The existing wallet, messaging, standalone Send, and gameplay loading remain intact. Marketplace work begins after their corrective commit.

## SDK inventory performed first

The installed public function inventory, public client types, implementation, and released host were inspected for these alternatives:

| Published primitive | Qualified use and boundary |
| --- | --- |
| `client.connect.wallet()` / `client.connect.transfer()` | Actual connected-wallet balance, execution conversion, debit/credit, and canonical private transfer message. Requires the real sender, recipient, and conversation; it does not transfer creature custody. |
| `client.assets.createProofObject()`, `client.artifacts.verifyAndOpen()`, `client.ownership.claimBearerAsset()` | Create/open native Originals and obtain the actual one-use ownership successor from a runtime-issued sealed artifact. Preserve its namespaces and carried ownership history; no detached card is an input authority. |
| `client.sources.publishSealedSourceV124()`, `client.domains.verifiedReplay()`, replay proof export/restore, authority sessions | Publish exact sealed replay source with actual source-author consent and conditional domain-head admission. Suitable for a named listing/reservation law with exact source evidence; a public-store write cannot replace this admission. |
| `client.execution.planAtomicOperationV124()`, `stagePrepared()`, `execute()`, `resolveByIdempotencyKey()` | Plans include multiple categories, but the released production executor rejects multiple operations. It does not currently combine a Connect wallet transaction with native bearer claim. |
| `client.value` / V125 edge value settlement and reserve | Require genuine admitted value origins, exact value heads, plan-bound authority, and corresponding execution. A wallet summary cannot be minted into such a source. Settlement and Reserve remain distinct. |
| `client.commerce.inventory.reserve()` / `adjust()` | Client methods target `/api/connect/commerce/inventory/reserve` and `/adjust` (`dist/index.js:1631–1632`). Matching route implementations were not found in the audited released host. Method/catalog presence is not operational reservation authority. |
| `client.commerce.oneClickCheckout()` / Connect card checkout | The SDK explicitly refuses to count a wallet read as a settlement (`dist/index.js:2798–2811`, `wallet_settlement_execution_required`). Card checkout is separate merchant payment/fulfillment, not atomic native asset custody. |
| `client.bearer` instrument preview/issue/claim/status | The client documents this as an explicit historical HTTP compatibility surface (`dist/index.d.ts:2979–2984`). It is not a substitute for the modern native artifact claim. |

The decisive production boundary is released host `app/lib/receiz/v124/runtimeDependencies.server.ts:2012–2039`: `operations.length !== 1` returns `UNSUPPORTED_ATOMICITY`; only exact supported settlement/reserve/access/world-composite delegates proceed, and incomplete inventory/ownership plans remain unsupported. Portable commit-set verification does not eliminate that executor boundary.

## MCP inventory performed second

Only metadata was invoked: `receiz_capabilities` with `mode: "describe"` and `receiz_required_scopes`. No financial, listing, source-publication, or claim tool was executed.

The returned `receiz.mcp.sdk-ai-capability-parity.v125` descriptor reports release `128.0.0` and names source publication, verified replay, atomic planning/staging/recovery, V123 value execution, V125 edge value, and historical bearer instrument adapters. The installed `v127SdkOperations.js:35` maps `receiz_commerce_inventory_reserve` to the SDK method with delegated mutation semantics. That mapping does not supply the absent audited host implementation.

The currently enabled marketplace MCP integration is nonfinancial. It supplies inspection, planning, and conformance, not a live canonical Connect transfer/modern bearer-claim adapter for this runtime. Neither MCP availability nor its JSON response grants custody. The SDK remains the runtime boundary.

## AI-skill doctrine performed third

Read the repository [Wildz market operator](../../ai-skills/wildz-market-operator-skill/SKILL.md), installed `receiz-multi-subject-transaction`, `receiz-value-execution`, `receiz-value-rails`, `receiz-bearer-ownership`, and `receiz-commerce-skill`, and their relevant SDK maps/example.

Their constraints are applied here: the complete enclosing Original is stronger than a projection; exact admitted predecessors and heads determine authority; atomic means all members or none; Phi uses exact integer micro-units; USD display valuation is not settlement authority; verified ownership follows the actual claimed successor. Unknown outcomes preserve the exact attempt. Authoritative work stays off animation, movement, and startup paths. An MCP/AI plan or possession alone cannot replace device consent or native admission.

## Existing exact proof path and defects

1. [Market repository](../../src/lib/receiz/wildz-market-repository.ts#L114) currently falls back to `publicStoreRail`. At lines 120–180 it fabricates genesis/append proof shapes, labels projection state `verified`, and recognizes an object in a local WeakSet as admission. The actual publish request does not conditionally compare the expected domain revision/head. This cannot safely reserve one listing for one buyer.
2. [Listing route](../../app/api/market/listings/route.ts#L63) checks exact public card JSON at lines 71–85. [Public card resolution](../../src/lib/receiz/wildz-market-public-card.ts#L53) is discovery/selection; it does not admit the seller's current native Original or latest causal keeper projection.
3. [Market payment adapter](../../src/lib/receiz/wildz-market-adapter.ts#L243) calls Connect at lines 273–279 without the required `conversationId`. It expects older top-level transfer/ledger fields instead of the current nested canonical response. Its catch at lines 280–281 calls an ambiguous post-commit failure `payment_failed`.
4. The same adapter creates app ownership JSON at lines 323–340 after payment. No native claim, returned successor Original, or complete carried custody history authorizes that ownership. A successful payment is only payment authority.
5. [Resource market capability resolution](../../src/lib/receiz/resource-package-market-capability.ts#L10) correctly states that a public-feed write, mutex, or readback is not CAS, but expects an application-specific rail absent from stock128. Resource purchases should use the newly qualified source-journal reserve/accept protocol rather than pretend this optional rail exists.

The modern Wildz gift/source paths preserve the exact private creature bearer Original, immutable birth payload, causal current-card sidecar, both root-witnessed approvals, and native ownership successor. Resource packages use a non-bearer `custody: "current"` Original plus actual domain-source reserve/accept/unpack admission; they must not be routed through generic bearer claim. Full sources and claimable bytes remain private. Public listing metadata contains only the necessary display data, immutable source commitments, and price.

## Proven capability gap

Released128 has no qualified production operation in the inspected path that atomically combines the existing connected-wallet debit/credit with modern creature bearer ownership claim or resource-source acceptance. Its public atomic planner is not evidence that this combination executes. It also has no Connect request field that pins a USD conversion quote while simultaneously requiring an exact pre-reviewed Phi debit.

Released host `app/api/connect/transfers/route.ts:102–114,183–194` computes USD-mode Phi using the sender's execution-time rate. That rate may be derived from the actual wallet's displayed balance as well as its fallback quote (`:124–135`). The route requires a genuine member conversation at `:173–207` and atomically writes payment plus canonical private message at `:295–309`. A nonce omitted or malformed at `:76–81` becomes a new random nonce, so the exact valid nonce must always be preserved. Its response and canonical Original are the outcome source, not an app receipt flag.

A seller's public listing alone is also not a full-plan device approval for an arbitrary future buyer. The minimal supported flow obtains the seller's explicit approval for the actual buyer and exact asset/payment plan. Instant purchase while the seller is absent would require a separately qualified native bounded mandate/delegation; this record does not assume one.

## Minimal proposed addition

Implement a Wildz-only staged market adapter over the existing published primitives; add no Receiz code, custom wallet ledger, hosted database, fake grant, or alternative claim verifier.

1. Replace `publicStoreRail` admission with an exact named market-law source journal using published SDK source publication and verified replay. Listing, cancellation, buyer reservation, and progression compare the actual admitted predecessor/head. Establish an actual SDK authority session/source genesis; never promote the legacy public snapshot into genesis. Qualify global concurrent reservation and restart recovery before enabling purchases. A public index may continue to serve metadata discovery.
2. Prepare seller custody using the current creature producer/sidecar or resource exchange. Freeze its exact descriptor and privately retain the Original before publishing the listing. Enforce one semantic source reservation and verify actual current custody on each authoritative action. Never remint a wrapper on retry, publicly expose a bearer Original, or substitute a birth card for an evolved current projection.
3. Keep listing prices in exact USD cents. On Buy, obtain the actual buyer's current Connect wallet quote/effective rate and display both the USD price and exact Phi charge. Derive only from that source using the released conversion/rounding law; validate the displayed USD through public `quoteReceizDisplayUsdV122`. No fixed app conversion or floating-point financial math is permitted.
4. Freeze a purchase-specific attempt that binds listing/reservation head, buyer/seller, source descriptor, USD price, actual quote basis, exact Phi amount, conversation, expiry, and stable semantic nonce. Both participants explicitly approve the complete terms. Revalidate the quote before any debit; a changed quote requires a new review before submitting any financial attempt. Submitted/unknown attempts retain their original terms regardless of expiry.
5. Reuse the strict Connect Phi port with purchase-specific authorization binding and the existing staged controller. Execute the frozen exact Phi amount in `unit: "phi"`; USD remains the displayed listing/review denomination. This fixes the financial amount even if the later display rate changes. If the product instead demands exact USD at execution, use an explicitly authorized USD-mode attempt and report the canonical resulting Phi; do not silently reinterpret the existing exact-Phi approval or claim that both values were pinned.
6. Use explicit native creature Accept or resource-source Accept and independently verify the actual successor/CAS outcome. Advance market completion and crew/inventory projection only from those verified sources. Distinguish `payment confirmed — delivery pending`, `received — refresh needed`, and fully completed purchase. A staged receipt cannot be called atomic; no automatic reversal or guaranteed refund is assumed.
7. Retain/read back exact payment and source attempts before execution. Recover the same payment through its canonical private message and the same source through native one-use/source-CAS custody. Transport retries publish the same bytes. Local projection repair never charges, reseals, claims another source, or releases a possibly paid reservation. A missing observation is pending, not zero-write evidence.

These are application workflow and reducer changes around native admission, not a new financial rail. The named market reducer must verify each source/payment commitment and exact replay before authorizing its transitions. A new market source candidate sealed before publication remains only a candidate; live admitted replay/CAS is required before it represents an accepted reservation.

## Cost and removal analysis

- **Latency:** paint current public listings/local truth first. Session/source initialization, current-quote lookup, proof preparation, and recovery run only on explicit marketplace actions. No wallet read/loading, world hydration, fuel, movement, render, or camera path gains a network call.
- **Dependencies/configuration:** use the installed stock SDK, existing narrow same-origin transport, encrypted continuation session, actual configured `RECEIZ_CLIENT_ID`, device-held identity, and bounded durable source/recovery repositories. No adjacent checkout, SDK patch, Supabase client, or new service is required.
- **Privacy:** only bounded descriptors/metadata enter public discovery and journal state. Claimable Originals, current-card proof sidecars, identity material, and payment attempts use existing authenticated private transport. Signing keys and continuation credentials never enter listing/progress JSON.
- **Offline:** retained native Originals remain portable; local crew memory is authenticated cache admission, not a portable global publication receipt. A fresh purchase/reservation needs actual source publication/currentness and quote. Missing capabilities fail before a financial attempt.
- **Failure:** pre-execution source/quote/storage failures cause no financial request. After submission, unknown preserves the exact operation. Stages may have different terminal outcomes; report and recover them rather than claim zero writes everywhere. Payment-confirmed asset failure needs explicit recovery/dispute handling, not silent relisting or duplicate debit.
- **Removal condition:** replace staged choreography only when an officially released and operationally qualified primitive couples these exact wallet and custody sources in one commit with complete durable recovery. Preserve existing sources and historical receipts during migration.

## Executable evidence and acceptance gates

This record is based on static installed SDK/host evidence and read-only MCP description. It does not claim production financial qualification. Before marketplace enablement, require:

- Actual source-law reservation success, stale-head rejection, conflicting buyers, cancellation, same semantic attempt replay, and cold restore; no fake admission objects.
- Genuine native creature successor and resource acceptance positives; forged/wrong-owner/wrong-key/foreign-application/stale-source/history-sidecar negatives; byte-exact namespace/history preservation and received asset usability.
- Actual Connect contract mocks: canonical conversation/recipient, effective quote, exact USD cents/Phi micro, current nested response, independent canonical message read, same valid nonce, scope and actor rejection.
- Quote change before submission forces review; a quote change after uncertain submission cannot create a second attempt. Reserve and Settlement authorization remain unchanged outside the new purchase purpose.
- Lost debit reply, lost claim reply, failed source publication, failed progress publication, quota/readback failure, changed identity, two-tab contention, reload, and local projection failure. Verify one payment and one source transition, exact recovery, and truthful intermediate status.
- Regression checks for baseline wallet loading, messaging, standalone Send, crew growth/re-send, resource unpack, marketplace public/private views, and zero added calls on warmed gameplay paths.
- Full project tests/typecheck and official `receiz:check` against stock128. Live qualification, if later requested, is a separate explicit action; this audit performed none.

## Approval

### Implemented source boundary

The old `publicStoreRail` fallback is retired. Legacy market admission now fails closed unless its explicit conditional rail independently verifies its proof. The new market journal uses stock `sources.publishSealedSourceV124`, exact enclosing replay Originals, actual device/source-author consent, and the shared named-domain predecessor CAS. Its immutable namespace contains the fixed law, not changing marketplace or resource balances. This matches the released `receiz_domain_append_v124` namespace equality guard in `supabase/migrations/20260822070100_receiz_v124_production_runtime.sql`; mutable holdings are derived only by independently verifying and replaying the complete source event chain.

The public store locates that chain and grants no admission. Content-addressed linked archive pages preserve every predecessor Original. The current enclosing custody Original can use bounded byte pages: reconstruction preserves its exact base64url bytes and checks the native artifact SHA before stock SDK root opening. Pages are at most 192 KiB; the Original reference is bounded to 8 MiB of base64url text. The complete signed SDK publish request and same-origin wrapper are measured against Wildz's smaller 2,000,000-byte limit, including the repeated feed and device challenge. Partial, changed, reordered, overlarge or mismatched content is rejected. No checkpoint substitutes for predecessor verification, and no claimable bearer, generic private identity memory, approval Original or financial receipt enters public pages.

Resource sources use the same exact-byte transport with their own closed namespace and archive-page schema. Their previous 128-leaf lifetime cap is removed: the public locator retains at most 32 inline tail Originals and 8 MiB of tail base64url text, with older leaves in immutable linked pages. Every leaf is reconstructed, SDK root-opened, matched to its predecessor and independently replayed; full verifier-derived artifact-SHA ancestry establishes prefix membership across compaction. Newly sealed package and creature-origin carriers can reference those exact bytes instead of embedding the entire proof. Existing inline proof carriers remain readable; this format compatibility does not admit a different mutable namespace law. No existing native Original is rewritten.

Before resource source CAS, Wildz measures both the actual source-publication wrapper and the downstream two-source custody portable/multipart payload against the 2,000,000-byte bridge budget. This measurement grants no custody: the SDK still exports its actual held replay after acceptance. A single command or embedded gameplay history that exceeds this budget fails before CAS; paging removes accumulated source-count limits, not native per-request limits. The exact custody Original is retained before weak archive publication, and page/top-locator readback and same-attempt retries preserve its bytes after a lost reply.

Public progress commits intention and receipt digests only. Releasing a possibly paid listing requires identical closed terms in two distinct named buyer/seller native device-authored, root-sealed terminal-consent source leaves; their actual seal coordinates must follow the admitted approval. The private purchase adapter separately admits the actual payment and asset receipts. Joint closing consent is not financial or native asset title. A definitive failed-attempt release uses the expiry and authenticated coordination boundary below; missing outcomes stay locked.

If a previously in-flight canonical debit is independently observed after the first no-payment closing consent, verified paid progression supersedes that one consent and preserves every semantic lock. It cannot complete or release the sale; the public progression digest remains an intention below actual payment authority.

These shared source locks coordinate Wildz workflows. Released128 does not atomically couple the connected-wallet payment with native custody, or prevent an independent native gift, claim or spend outside this application between staged payment and delivery. Per-action custody checks and application locks do not create that missing global native custody lock. The UI and recovery must preserve this limitation rather than promise atomic settlement.

Verification here includes pure closed-law/CAS conflict checks, actual stock SDK candidate and identity-signing/request-size tests, bounded transport reconstruction and tamper negatives, immutable-namespace contract tests, durable unknown-attempt recovery, and fail-closed root-proof tests. Transport doubles and diagnostic keys are not production root-seal or financial qualification. No live publication, enrollment, transfer, claim or financial action was performed.

### Definitive rejected-attempt coordination

Released Connect can return `wallet_insufficient_funds` without retaining a terminal transfer nonce. A mutable browser "failed" flag or absent chat message therefore cannot release a payment-locked listing: the same original consent might still execute before its sealed review expiry.

Wildz may retain a bounded, server-authenticated coordination witness only after that exact SDK rejection. It uses the existing attempt secret and binds the original encrypted attempt digest, client nonce, device key, sender, recipient, amount and expiry. Its authenticated read is distinct from a native financial receipt; it issues no value or custody authority. An unknown response receives no witness. Release waits until the original sealed execution window has expired, then requires matching buyer and seller device-authored/root-sealed terminal-consent source leaves. Before expiry the failed original remains locked. Expiry and an earlier insufficient response do not rule out another already in-flight native execution. The witness read therefore checks the actual canonical Connect outcome again; a committed payment takes priority. Matching closing source consents are voluntary application coordination, not proof that the native nonce is permanently terminal. Unknown observations remain locked. No new database, secret, host endpoint in Receiz, financial rail, or replay funding is introduced.

This additive Wildz-only retry coordination was reviewed by the root coordinator on 2026-10-10. Recovery tests must cover witness tampering, cross-account/leg reuse, expiry, lost responses and zero duplicate debits.

- Reviewer/coordinator: root agent, acting on the user's explicit request for Wildz-only released128 marketplace listing/buy/sell and approval of staged trades.
- Exact scope: this capability decision and the Wildz-only staged marketplace composition above, implemented after corrective commit `098a976`. Listing, named purchase review, separate payment and asset acceptance, recovery, and bounded full-ancestry transport use the installed released128 primitives. No live listing, payment, or claim was performed or authorized by this record.
- Date: 2026-10-10.

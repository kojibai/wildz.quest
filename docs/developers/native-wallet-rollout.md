# Published v128 wallet integration

Wildz uses the exact public `@receiz/sdk`, `@receiz/mcp-server`, and
`@receiz/ai-skills` packages at `128.0.0`. There are no package patches, Receiz
source changes, new Receiz endpoints, or database migrations in this integration.
The public SDK catalog has 680 callable functions and digest
`687bdd064b49bf7df1c32eb4ab3c0f1389c80c8bc90d7cfbec32147db1cc73ad`.

The wallet read/controller/source/loading baseline is commit
`84a4270e6dff96366362d698036c07ff183f261a`. Resource display additions use the
same available fruit, vegetable, meat, Honey and package holdings on Assets and
Ledger. They do not alter balance authority. The living world retains its
existing source, bootstrap and Boss HUD path.

Direct Send must use actual released APIs, the authenticated current account,
the exact confirmed recipient and amount, and a durable same-attempt identity.
An ambiguous response must remain pending until the original operation is
resolved; it must never produce a new send automatically.

Trade offers and counteroffers carry exact selections through the existing
private messaging path. Proposals are coordination only. The user approved staged exchange: both peers approve the exact package, then
each leg completes in order through the released SDK. The agreement is complete
only after every leg has independently verified acceptance or settlement evidence.
Peer progress messages never establish ownership or value. Pending legs recover
the original attempt without repeating sends.

The earlier additive SDK/host implementation was uncommitted, undeployed, and
withdrawn. Its local source files were restored and its pnpm patches removed.
The historical executor proposal does not authorize applying migrations or
changing the Receiz repository.

Resource packages use the released source publication and named-domain CAS APIs.
Collection records exact admitted gameplay commands locally; SDK qualification
and publication run only on an explicit wallet action. The package Original has
`custody: "current"`; recipient-authored source acceptance changes the application
keeper without rewriting its native genesis owner or invoking a bearer claim.
Unpacking imports exact finite members. Consumption, storage, withdrawal, repacking
and paid-object actions replay the same source law; cached holdings and keeper
fields are presentation data. A final gameplay fence runs after asynchronous
proof preparation immediately before a new source publication. Read-only recovery
of an already accepted action does not publish or repeat that fence.

Historical export requires the retained genesis-to-command trace and exact card
Originals. Saved inventory counts alone cannot become transferable source units.
An older creation command can bind a complete shared world checkpoint containing
remote state absent from the retained per-owner resource trace. Such a command
cannot be relabeled to a smaller checkpoint or silently omitted: that trace
reports a source-qualification boundary until its exact admitted dependencies are
available. Existing local collection, inventory display, builds and Boss state
continue through their original gameplay path. New source-backed builds plan
against the freshly replayed resource source rather than its merged display.

The marketplace uses a shared native source CAS for listings and named purchase
reservations. A public store locator provides discovery; it does not establish
custody or payment. Both devices approve the complete agreement, including the
exact asset, named peers, USD price and current buyer-wallet Phi quote. A changed
quote requires a new review before the first debit. An uncertain debit retains
its original attempt and nonce. Actual canonical Connect payment admission and
actual recipient asset acceptance remain separate stages. Closing a paid sale
requires matching native source consents from both named peers. Listing status
is a separate display projection and does not mutate the approved creature card.

The released host requires the source namespace to stay immutable across CAS
appends. Resource and market adapters use fixed law namespaces and replay the
complete signed trace to derive current holdings. Lost replies recover the
frozen publication through native replay rather than treating a cached count as
success. Resource and market history use lossless, content-addressed pages within the
released host's signed-request byte limit; every original still undergoes root,
predecessor and source-law verification. Resource source tails stay bounded to
32 Originals and 8 MiB of exact base64url text; older ancestry stays in immutable
192 KiB pages and remains part of full verification. Package and creature-origin
proof transport can reference exact Original byte pages. References establish no
authority; reconstruction precedes native root opening. Source publication JSON
and SDK custody portable/multipart capacity is checked before a new native source
append. Private package and creature carriers remain bounded during their own
retention and publication, after reservation or origin admission; referenced
ancestry removes their former unbounded inline history.
Private completed payment and trade
checkpoints are archived only after native qualification and successful byte
readback. Unknown and incomplete work stays available for recovery, and new
work must pass local continuation capacity checks before reserving an asset.

Legacy inline transport remains readable when its native chain has the required
immutable law namespace. A previously admitted mutable-state namespace would
fail qualification and cannot be silently rewritten into that law. No live
source publication occurred in this task, and no such production chain was
observed. This is not a migration claim for an unknown deployed source.

The market runtime opens on an explicit market action. Constructing the HUD,
subscribing to its cached listing display and ordinary gameplay rendering open
no marketplace SDK runtime. Panel cleanup releases subscribers. These boundaries
avoid new marketplace work in the gameplay frame loop; they are not a claim of
zero network latency for proof verification or payment.

Staged purchases cannot promise an atomic exchange or prevent an independent
native claim or spend outside this app between payment and delivery. A known
Connect rejection may have an authenticated app retry witness, below native
financial authority. It cannot turn a missing receipt into proof of no payment;
canonical payment admission takes priority, and uncertain purchases stay locked.
These compatibility decisions are recorded in
`docs/receiz-decisions/2026-10-10-published-v128-staged-marketplace.md`.

Before release, run typecheck, lint, tests, production build, architecture lock,
secret scan and the coordinated v128 compatibility/conformance checks. Live
transfers and deployment require the separately reviewed user confirmation;
local tests do not claim that production funds or custody moved.

Corrective validation on 2026-10-10: 3,936 tests passed, one skipped and zero
failures or cancellations; full ESLint, TypeScript, production build,
architecture lock, secret scan, doctor and coordinated published-v128 checks
passed. The build retains the SDK dependency's existing dynamic-worker warning.
Mobile browser checks cover embodied camera switching, running jump travel,
mouths, hands, action layout and the current-Kai dream reward. An iOS memory
termination and a funded production transfer were not observed or claimed.
Independent offline qualification requires an already enrolled disposable
`WILDZ_TEST_SEAL_DIRECTORY`; that fixture was not supplied, so that separate
qualification is still pending.

Marketplace follow-up validation on 2026-10-10: 4,035 tests passed, one skipped,
zero failures and cancellations. Full TypeScript, ESLint, production build,
architecture lock (1,125 runtime files), secret scan, doctor and coordinated
published-v128 checks passed. The existing SDK worker dependency warning remains.
Focused native transport and recovery checks include lossless 130-event resource
ancestry, exact signed-request sizes, zero source CAS writes for overlarge source
or custody candidates, cold reads, corrupted pages and lost locator replies.
Independent archive review passed 33 focused tests. Mobile UI checks cover the
named buyer/seller staged flow through a development display simulation, plus
paired left controls with the odd action at the top and the double-chevron jump
icon. These local checks do not claim a funded production payment, live native
custody exchange, or an enrolled production root-seal qualification.

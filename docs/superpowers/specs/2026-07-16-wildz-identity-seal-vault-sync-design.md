# Wildz Identity Seal Vault Sync Design

## Goal

Let a player who entered Wildz through a proof-sealed Vault attach an Identity Seal from their own profile popover, gain signing authority, recover the complete Vault associated with that Receiz identity, and converge the verified uploaded Vault with the latest Receiz Vault without losing valid currently owned cards or save history and without retaining cards that were transferred away or reached a terminal lifecycle state.

The flow uses the official Receiz SDK and user-held Identity Seal authority. It does not invent a player access token, use an operator token as player authority, or use MCP to sign runtime player actions.

## Current Truth

- Fresh characters and restored Identity Seals have verified local identity-key authority.
- A proof-sealed Vault can authenticate its artifact-scoped Wildz player and restore its carried cards and save, but it has no private identity key and cannot sign account-scoped writes.
- Wildz persists active continuity locally in encrypted IndexedDB.
- Identity-backed Vault export already signs with the protected Identity Seal key.
- The profile popover currently exposes sharing and Vault presentation, but no authority-upgrade action.
- Existing profile publication expects bearer-token authority and is not the desired proof-native path for player Vault synchronization.

## User Experience

The current player's profile popover shows a compact Identity Seal icon only when all of the following are true:

- the profile belongs to the active player;
- the active session authority is `proof-sealed-vault`; and
- no verified signing identity is already attached.

The icon uses the existing dark translucent profile action styling. Its accessible name is **Attach Identity Seal**. A short supporting label explains: **Sign and sync this Vault with Receiz**. The control opens a hidden file input that accepts the supported Receiz Identity Seal formats.

The interaction has five visible states:

1. **Ready** — the compact Seal action is available.
2. **Verifying** — the selected Seal is being parsed and verified locally.
3. **Recovering Vault** — the canonical Receiz identity is confirmed and its latest Vault is loading.
4. **Signing sync** — the reconciled complete Vault is waiting for or using the Seal signature.
5. **Complete** — the profile briefly reports **Signing enabled · Vault synced** and the Seal action disappears.

When the device is offline, successful local verification reports **Signing enabled · sync pending** instead of claiming remote synchronization.

If the Seal is passphrase-protected, Wildz requests the passphrase only when the SDK needs it to sign. The passphrase is never stored.

## Identity Outcomes

### Matching Identity Seal

When the Seal's canonical Receiz actor matches the actor carried by the active Vault:

- Wildz upgrades the current session from artifact-scoped Vault authority to verified identity-key authority.
- The current uploaded Vault remains a reconciliation input.
- Wildz recovers the latest complete Vault for that same Receiz identity.
- The two verified Vaults are reconciled and the result is signed and published.

### Different Identity Seal

When the Seal belongs to a different canonical Receiz actor:

- Wildz first flushes the current artifact-scoped Vault to local encrypted storage.
- Wildz does not merge any card, event, character, progression, setting, receipt, history, or position from the previous actor into the new actor.
- The verified Seal becomes the active identity.
- Wildz completes signed Receiz ID continuation for that identity.
- Wildz recovers the latest complete Vault associated with the Seal's canonical Receiz username.
- If Receiz has no Vault for that identity, Wildz creates a new owner-bound empty Vault and publishes it only after the user signs.

The previous artifact-scoped Vault remains intact in its own local owner scope and can be restored again later. Account switching never silently destroys or transfers it.

## Receiz Vault Projection

Wildz publishes one canonical owner-scoped complete Vault projection through the Receiz SDK.

- Schema: `receiz.wildz_remote_vault.v1`
- Namespace: `wildz-vault:<canonical-handle>`
- Source URL: the canonical Wildz Vault URL for the Receiz username
- Writer authority: SDK identity-proof signing with the matching Identity Seal
- Recovery: SDK app-state resolution by canonical source URL
- Confirmation: a returned Receiz append anchor and admitted head matching the submitted projection

The projection contains the complete portable Wildz save required to resume the same player:

- canonical player and identity coordinates;
- character genesis;
- portable card assets and their complete proofs;
- admitted custody, transfer, claim, and lifecycle references needed to derive current inventory;
- progression and companion state;
- append-only personal, civic, ecology, raid, and settlement history;
- receipts and canonical cursors;
- settings;
- world position and other versioned PlayState fields;
- a monotonic Vault revision, prior-head reference, content digest, and admitted timestamp.
- the exact carried Kai head and Kai-Klok coordinate through which the Vault proof object is complete.

The projection never contains an Identity Seal, private key, passphrase, access token, refresh token, email address, Vault decryption secret, or browser session secret. The existing complete Wildz save is treated as portable player state; public profile sanitization remains a separate, smaller projection.

## Reconciliation Law

Reconciliation accepts only Vaults whose complete payload and owner coordinates verify. Proof history is bidirectional and append-only. Current inventory is not an append-only union; it is an exact projection derived from the merged proof history and the latest admitted ownership and lifecycle facts.

### Card proof history and exact current inventory

- Card proof objects present on only one side are retained in merged history when they verify.
- Exact duplicate card proofs are stored once.
- For the same stable asset identity, a newer valid living-card revision that extends the verified lineage replaces its ancestor as the displayed revision while retaining its ancestry.
- A divergent proof, immutable identity conflict, invalid owner transition, or broken lineage stops reconciliation.
- Uploading a card never rewrites its historical provenance.
- Wildz resolves the latest admitted custody for every stable card identity from capture proof plus verified sale, send, transfer, and claim receipts.
- Custody precedence and freshness follow the canonical Kai Pulse ordering projected by the Kai-Klok deterministic state machine, with admitted Receiz append and causal references as proof of admission. Browser time, upload time, array order, and file modification time have no authority. Two incomparable canonical heads are a conflict.
- A card is included in the active Vault exactly once only when the latest admitted custody names the active Receiz identity.
- A card sold, sent, transferred, or claimed by another identity is excluded from the prior owner's active Vault even when a stale uploaded Vault still contains its bytes.
- A card received or claimed by the active identity is included after its ownership receipt and card proof verify.
- Wildz resolves the latest admitted lifecycle fact for every card. Terminal states such as `dead`, `destroyed`, or `retired` exclude the card from the active creature inventory while preserving its proof and event history.
- Terminal lifecycle facts are irreversible. A later non-terminal client snapshot cannot supersede them.
- A stale Vault can never resurrect a terminal card or reclaim a transferred card.
- A locally captured card missing from Receiz is eligible for signed append only when its capture proof names the active owner and Receiz contains no later transfer, claim, or terminal lifecycle fact.
- Current Vault count is computed from this final ownership-and-lifecycle projection, never from the number of card objects found in either input file.

### Append-only history

- Events, receipts, settlements, and canonical records merge by their stable identifiers.
- Exact duplicates deduplicate.
- Conflicting payloads under the same stable identifier stop reconciliation.
- Ordering is restored through Kai Pulse and the Kai-Klok deterministic state machine after union.

### Complete-save snapshot

- Character identity must match the active Receiz actor and cannot be replaced by another actor's character.
- The freshest valid Vault revision under Kai Pulse/Kai-Klok ordering supplies ordinary mutable snapshot fields such as settings and world position.
- Monotonic counters and earned progression cannot decrease; their verified maximum or existing deterministic reconciliation rule wins.
- Append-only proof history uses the union rules above. Card inventory is rebuilt from the exact ownership-and-lifecycle projection, even when either complete-save snapshot contains more stale card objects.
- The reconciled projection advances from the admitted Receiz head. A stale head produces a conflict and causes recovery plus another deterministic reconciliation attempt rather than overwrite.

These rules make synchronization convergent: if the uploaded verified Vault contains more valid still-owned state than Receiz, the missing state is signed and appended to Receiz; if Receiz contains more valid state, it is added locally; if Receiz contains a later transfer, claim, or terminal lifecycle fact, stale local inventory is removed. Both sides finish with the same exact active-card count and the same retained proof history.

## Offline Determinism

The complete Wildz Vault is itself a proof object. Its digest, causal history, Kai head, and Kai-Klok coordinate allow Wildz to verify and restore the exact player state carried through that head without a network connection.

- Identity Seal verification and matching-actor reconciliation run locally.
- Wildz can restore the complete character, progression, settings, position, proof history, and exact active inventory as of the Vault's verified carried head.
- New offline gameplay events are ordered deterministically after the known head and retained as pending additions.
- If signing authority is available, Wildz can prepare a signed, idempotent pending Vault append against that known head while offline.
- The pending append does not claim Receiz admission until a real acknowledgement is received.
- On reconnection, Wildz requests only verified additions after the carried Kai head. If no later additions exist, it submits the pending append. If later additions exist, it replays them through the Kai-Klok state machine, recomputes custody, lifecycle, exact count, and complete-save freshness, then signs the rebased candidate.
- A passphrase-protected Seal may require the player to enter its passphrase again for a rebased signature; the passphrase is never retained.

Offline Wildz therefore knows the exact state through its verified proof-object head. It never claims knowledge of later global Receiz admissions that the proof object does not carry.

## Data Flow

1. The profile Seal action passes the selected file to an identity-attachment coordinator.
2. The existing artifact codec reads the file once and verifies the Identity Seal through `@receiz/sdk`.
3. The protected identity repository prepares the verified key without exposing it to React state.
4. Wildz compares the Seal's canonical actor with the active Vault actor and selects the matching-upgrade or clean-switch path.
5. Wildz completes the existing signed Receiz ID continuation and obtains the canonical account coordinate.
6. Wildz resolves the latest remote Vault projection and the admitted ownership, claim, transfer, and lifecycle facts from Receiz, then verifies their schemas, digests, owners, Kai Pulse/Kai-Klok coordinates, heads, cards, histories, and complete save.
7. The reconciliation module produces one deterministic candidate plus a report of local additions, remote additions, deduplications, cards removed by newer custody, terminal cards removed from active inventory, the exact resulting count, and conflicts.
8. The identity repository opens the protected key only for the SDK signing operation. A passphrase prompt is shown if required.
9. `publishPublicStoreWithIdentityProof` publishes the candidate with an idempotency key derived from actor, prior head, and content digest.
10. Wildz accepts success only after Receiz returns an admitted anchor/head for the exact candidate.
11. One local continuity transaction activates the verified identity and stores the acknowledged merged Vault.
12. Wildz reconnects the same-origin proof session and live-world hooks under the resulting identity.

## Atomicity and Failure Handling

- Seal parsing, proof verification, remote recovery, reconciliation, and signing happen before the active local owner scope changes.
- A different-identity switch stores the old Vault before activation begins.
- No local merged state is committed until Receiz acknowledges the exact signed projection.
- Network failure, cancellation, invalid passphrase, stale head, malformed remote state, or signature rejection leaves both original Vaults unchanged and offers retry.
- Offline verification and gameplay remain available from the carried proof-object head; remote acknowledgement stays visibly pending.
- A proof conflict shows a concise message explaining that the Vaults could not be safely combined. Wildz does not select a winner automatically.
- A locally larger card count is never sufficient evidence for overwrite; admitted transfer, claim, and lifecycle facts always outrank stale possession snapshots.
- Repeated submissions use the same idempotency key and converge on the same admitted head.
- Closing the profile popover cancels only the UI wait; it does not erase a verified input or an acknowledged append.

## Component Boundaries

- `WildzProfileSheet` renders the conditional Seal action and status only. It does not parse artifacts or hold key material.
- `WildzApp` supplies active-authority state, owns the transition result, and reconnects gameplay after a successful upgrade or switch.
- A focused Identity Seal attachment coordinator owns verification, actor comparison, remote recovery, reconciliation, signing, and atomic activation.
- A pure remote-Vault codec validates and hashes the complete projection.
- A pure reconciliation module implements the bidirectional merge law and returns structured conflicts.
- A pure current-inventory projector derives exact membership from verified card proofs, ownership receipts, claims, sends, sales, transfers, and lifecycle facts.
- A Receiz remote-Vault repository wraps SDK resolve and identity-proof publication primitives.
- The existing protected identity and continuity repositories remain the only local authority storage.

## Security and Authority Rules

- Private key material never leaves the protected identity repository.
- React props, browser application state, logs, URLs, and API bodies never contain the raw Identity Seal or passphrase.
- MCP may inspect SDK capabilities during development, but it is not invoked by the player runtime and never signs for a player.
- A server environment token is not accepted as player identity authority.
- Every signed projection binds the canonical actor, source URL, prior Receiz head, complete content digest, and idempotency key.
- Different actors never share a reconciliation transaction.
- Uploaded Vault possession alone never upgrades identity authority.
- Card bytes alone never prove current custody after an admitted ownership or lifecycle event exists.

## Testing

### Unit and contract tests

- The Seal action appears only for the active player's `proof-sealed-vault` session.
- Verified identity sessions and other players' profiles do not show the action.
- Matching Seal attachment preserves the current Vault as reconciliation input and upgrades authority.
- Different Seal attachment flushes the old scope and loads only the new actor's Receiz Vault.
- Eligible currently-owned local-only and remote-only cards converge into one exact active set.
- Exact duplicates deduplicate and valid living revisions advance.
- Sold, sent, transferred, or externally claimed cards disappear from the prior owner's active Vault while remaining in history.
- Received or claimed cards appear once for the current owner.
- Dead, destroyed, and retired cards remain auditable but do not count as active creatures.
- A stale uploaded Vault cannot resurrect or recount a transferred or terminal card.
- The reported Vault count exactly matches the final current-owner, non-terminal projection.
- Divergent proofs, conflicting events, and owner mismatches fail closed.
- Complete-save reconciliation preserves proof history, derives exact current inventory, and selects the newest valid mutable snapshot.
- Fewer remote cards cause a signed Receiz append; more remote cards cause a local append.
- A stale remote head recovers and retries without overwrite.
- Freshness is invariant under input order and follows Kai Pulse/Kai-Klok ordering rather than client timestamps.
- Offline restore produces the exact state through the Vault proof object's carried Kai head and queues later deterministic additions without claiming remote admission.
- Reconnection fetches additions after the carried head and deterministically rebases any pending signed Vault update.
- No acknowledgement means no local activation.
- Passphrase, key bytes, access tokens, and artifact bytes never appear in public results or logs.

### Browser verification

- Vault-only login → own profile → attach matching Seal → optional passphrase → **Signing enabled · Vault synced** → action disappears.
- Vault-only login → attach different Seal → old Vault remains isolated → new username and its Receiz Vault render.
- Offline and rejected-signature states preserve the current player and expose retry.
- Offline attachment shows **Signing enabled · sync pending**, keeps gameplay available, and changes to **Vault synced** only after Receiz acknowledgement.
- Desktop and mobile profile popovers keep the Seal action compact, readable, keyboard accessible, and clear of Share/Copy controls.
- No framework overlay or relevant console errors occur through either path.

## Acceptance Criteria

- A Vault-only player can discover the signing upgrade without being nagged elsewhere in gameplay.
- A matching Identity Seal safely grants signing authority to that player's Vault session.
- A different Identity Seal switches to its own Receiz identity and remote Vault without cross-account merging.
- The complete verified local and Receiz Vaults converge without losing unique valid currently owned cards, history, progression, or newer save state.
- Receiz is updated when the verified uploaded Vault has more valid still-owned state, and local continuity is updated when Receiz has more or contains later custody/lifecycle facts.
- Sales, sends, transfers, claims, deaths, destruction, and retirement produce the same exact active-card count locally and on Receiz.
- Offline restore and reconciliation work from the Vault proof object's verified Kai head; reconnection incorporates only later admitted additions through deterministic Kai-Klok replay.
- Every remote write is signed by the user-held Identity Seal through the SDK and accepted only with exact Receiz acknowledgement.
- No player access token, operator token, or MCP runtime signer is introduced.

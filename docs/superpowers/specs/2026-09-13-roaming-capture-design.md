# Roaming encounters and earned capture

Status: Wildz implementation connected and locally verified. No live ownership change has been attempted.

## Scope correction

All work stays in Wildz. Use the installed Receiz SDK, MCP, and AI skills at 126.0.0. Do not change the Receiz backend, SDK, or their repositories. The earlier proposal to extend those systems was based on inspecting only the pending-transfer instrument path and was incorrect.

## User rules

Choosing Roam makes capture possible without an extra eligibility toggle. Another player must fight; the creature autonomously defends itself and can win. Actual outcomes and battle actions appear in the shared Vault/HUD history. Capture must preserve the creature identity and prior history, remove it from the previous party and return journey, and add it once to the successful player's inventory.

## Existing native composition

- Deterministic gameplay: reuse `pvp-battle-engine.ts`. The roaming battle kernel validates complete card inputs, chooses defense from the prior snapshot without reading the challenger move, rejects stale or conflicting commands, and derives reports from the transcript. A win establishes gameplay eligibility only; it does not write ownership.
- First native artifact: the existing `createWildzExportProofObject` uses `client.assets.createProofObject`, downloads, independently reopens, and verifies authenticated owner binding. Retain and reuse the same complete single-creature artifact. The document-sealed Vault export is not a replacement for native ownership custody.
- Capture: reuse `claimWildzBearerArtifact`: `artifacts.verifyAndOpen` -> `ownership.claimBearerAsset({ artifact: opened.sealedArtifact })` -> exact download and independent reopening. Preserve the resulting carried ownership witness and unchanged creature payload. No transfer instrument is prepared at Roam.
- Continuity: native verification, append planning, capability verification, staging, and named-domain acceptance remain SDK operations. Inspect the actual enclosing source carrier before selecting the matching append path. A server row, battle JSON, digest-shaped value, or MCP result cannot manufacture proof authority.
- Existing `/api/market/claims` already composes artifact-native claim, extraction, and ownership reconciliation. Reuse this behavior without introducing a second custody mechanism.

## Integration requirements

Keep complete custody-bearing bytes private until the capture conditions have been admitted. Public map/presence records only locate encounters and must not expose an immediately claimable source artifact. Bind the exact creature, expedition, current owner, challenger, battle revision, and transcript before release/claim.

The authenticated Wildz gateway encrypts private app-state transport with AES-256-GCM and purpose-bound associated data. This encryption protects bearer bytes even if an app-state wrapper is resolved through the SDK's by-URL endpoint. It does not grant native ownership. The winner receives only the independently reopened native claim result; the original bearer source is never released to the challenger.

An encounter has a fixed three-minute lifetime. A verified winning turn opens a fixed two-minute capture window. Recall queues while the encounter holds the creature and resumes after resolution or expiry. Device-local battle reports replay actual commands and are read by both crew surfaces; these observations never claim to be custody evidence.

Capture restoration validates the latest card as a causal descendant of the original native payload, then merges that sidecar through normal continuity persistence. The original creature payload, ownership witness and namespace history are preserved. Live ownership refresh removes a departed creature only after independently verified reconciliation.

Recall and encounter admission must have an explicit causal order. Preserve pending outcomes across reload and retry. Never report a capture, return, or inventory transfer from a merely proposed operation.

Use the same recorded outcome in Vault and HUD. Receiving an authenticated capture invalidates the old party member and active return runtime; prior observations remain readable.

## Verification

Test both battle winners, independent defender choice, retreat, bounded draw, duplicate replay, conflicting or stale turns, proof changes, and self-challenges. Test exact artifact reuse and single-card binding, source ownership and namespace preservation, non-bearer rejection, no transfer on unsuccessful defense challenge, exact native result verification, and interrupted-operation recovery. Then verify the full UI, map, recall, and two-inventory flow.

The installed MCP tools were inspected through `createReceizMcpRuntime` and `tools/list`. `receiz_capabilities` described the SDK locally; `receiz_living_subject_conformance` passed its 19 local checks. This is operator/conformance evidence, not proof of a live capture or deployed application integration.

Local verification: 2,622 tests passed, TypeScript passed, lint had no errors, and the production build passed. A 390×844 Chrome browser run checked an actual combat turn, autonomous defense, Escape retreat, defender victory without a capture button, and simulated capture confirmation without horizontal overflow or browser errors. Native claim routing and restore/reload were tested with injected adapters; a live two-account custody transfer was not performed.

Recovery boundary: when the native result was retained, retry returns that verified result without claiming again, including after the capture window closes. If the native service commits but its response is lost before result retention, the installed claim API provides no guaranteed result-recovery operation. No automatic native retry loop or invented successful outcome is used.

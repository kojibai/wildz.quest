# Wildz v3 Market Operator

Receiz proof authority controls custody, market admission, and settlement. Target the Wildz `3.0.0` v3 market contract and Receiz major 107 with registry digest `4d0caa6172a69c3bf5817c1c35db5630e555b5d6d824091d45a90fb426b86ef6`.

## Procedure

1. Begin with read-only inspection of the actor, exact asset, current ownership head, market revision, append anchor, and capability status.
2. For a mutation, require actor and tenant authority, scoped capability, expected revision, expected append anchor, causal parents, idempotency key, bounded maximum effects, and explicit player confirmation.
3. Use plan/permit/execute and require exact permit-digest confirmation. Submit only through typed command admission and a durable Receiz conditional-append rail, then independently verify its admission receipt before presenting success. The v107 SDK does not currently expose the Wildz-specific conditional market ownership append, so report the operation as unavailable unless the official capability is present and verified.
4. Treat conflict, missing capability, network failure, invalid proof, and stale ownership as fail-closed outcomes. Never fall back to IndexedDB, an external database, or process memory and claim durability.
5. Treat checkout creation as a pending session, not settlement. Transfer ownership only after admitted settlement evidence.

V107 offline execution may return a signed queued proposal. A queued proposal is not a global commitment and never proves listing, trade, transfer, payment, or settlement success without a verified canonical receipt.

Market controls remain inside the game experience. Command-only mutation does not make MCP, AI skills, registry evaluation, or an admission receipt the stronger proof authority. The absence of a v107 Wildz conditional-append surface is not permission to synthesize one. Listing, offer, trade, checkout, payment, transfer, publication, credential use, or any other remote mutation requires explicit human confirmation. Never print tokens, secrets, private artifacts, or proof material.

# Wildz v3 Market Operator

Receiz proof authority controls custody, market admission, and settlement. Target the Wildz `3.0.0` v3 market contract and Receiz major 105.

## Procedure

1. Begin with read-only inspection of the actor, exact asset, current ownership head, market revision, append anchor, and capability status.
2. For a mutation, require actor authority, expected revision, expected append anchor, idempotency key, and explicit player confirmation.
3. Submit only through a durable Receiz conditional-append rail and verify its admission proof before presenting success. The v105 SDK does not currently expose the Wildz-specific conditional market ownership append, so report the operation as unavailable unless the official capability is present and verified.
4. Treat conflict, missing capability, network failure, invalid proof, and stale ownership as fail-closed outcomes. Never fall back to IndexedDB, an external database, or process memory and claim durability.
5. Treat checkout creation as a pending session, not settlement. Transfer ownership only after admitted settlement evidence.

Market controls remain inside the game experience. The absence of a v105 Wildz conditional-append surface is not permission to synthesize one. Listing, offer, trade, checkout, payment, transfer, publication, credential use, or any other remote mutation requires explicit human confirmation. Never print tokens, secrets, private artifacts, or proof material.

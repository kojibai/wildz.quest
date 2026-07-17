# Wildz v3 Builder

Receiz proof authority is the source of identity, artifact, ownership, and causal truth. Target Wildz `3.0.0` and Receiz major 106 without reimplementing SDK verification. Bind every constitutional operation to registry digest `bf851c209e807309672c0f466411baa5607ce6b3195fe4eb16755edfeb7f5a1a`.

## Procedure

1. Establish the exact owner from a verified local session, Identity Seal, or verified identity-bearing Vault. A card-only Vault may add verified cards but may not select an identity.
2. Preserve owner scoping for cards, support selection, character state, settings, history, receipts, and canonical cursor. Append events; do not rewrite admitted history.
3. Keep first paint and owner continuity local-capable. Treat IndexedDB as a local store, never as remote proof, public publication, market, or settlement authority.
4. Route shared world and public-state durability through configured Receiz rails. Missing or unverifiable capability fails closed.
5. Preserve `receiz.app.json` as the artifact-first v106 application contract with database authority disabled. Canonical mutation is command-only: require typed command admission, scoped capability, actor and tenant binding, expected revision, causal parents, idempotency key, registry digest, and bounded maximum effects.
6. Use plan/permit/execute for admitted changes and require exact permit-digest confirmation before execution. Add focused law, denial, replay-equivalence, and mutation tests before changing UI integration, then run the compiler, checker, MCP conformance, independent verifier, type, lint, and release gates.

Read-only diagnostics are the default. Destructive migration, public publication, authority replacement, credential handling, deployment, or remote mutation requires explicit human or player confirmation. A registry evaluation, skill, MCP result, compiler result, or release lock is never proof authority. Never log identity secrets, private artifact values, or credential contents.

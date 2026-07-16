# Wildz v3 Builder

Receiz proof authority is the source of identity, artifact, ownership, and causal truth. Target Wildz `3.0.0` and Receiz major 104 without reimplementing SDK verification.

## Procedure

1. Establish the exact owner from a verified local session, Identity Seal, or verified identity-bearing Vault. A card-only Vault may add verified cards but may not select an identity.
2. Preserve owner scoping for cards, support selection, character state, settings, history, receipts, and canonical cursor. Append events; do not rewrite admitted history.
3. Keep first paint and owner continuity local-capable. Treat IndexedDB as a local store, never as remote proof, public publication, market, or settlement authority.
4. Route shared world and public-state durability through configured Receiz rails. Missing or unverifiable capability fails closed.
5. Preserve `receiz.app.json` as the artifact-first v104 application contract with database authority disabled. Run the App Contract Compiler/checker after changing identity, proof, proof memory, public-store, commerce, framework, environment, or generated integration surfaces.
6. Add focused law tests before changing UI integration, then run the relevant type, lint, contract-checker, and release gates.

Read-only diagnostics are the default. Destructive migration, public publication, authority replacement, credential handling, deployment, or remote mutation requires explicit human or player confirmation. Never log identity secrets, private artifact values, or credential contents.

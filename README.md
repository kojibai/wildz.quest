# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

The application is aligned to the exact Receiz v113 toolchain: `@receiz/sdk@113.0.0`, `@receiz/mcp-server@113.0.0`, and `@receiz/ai-skills@113.0.0`. All three resolve directly from the official npm registry with integrity checks pinned by `pnpm-lock.yaml`. The checked-in `receiz.app.json` is the artifact-first source contract; `pnpm receiz:check` runs the v113 integration checker and locks the release to registry digest `4c4aa85f9785d205dcf7e4e5109837a83f8c3bf8e166130ae7e87353f299c637` and operation-matrix digest `091ab9e6b3acb05283510a19754e53c637dbd96b47b499a524dc44c34f8e783b`. V113 admission and planning are zero-write and non-authoritative. Transitions require same-runtime verified custody, a plan-bound verified capability, immutable staging, independent byte resolution, and atomic acceptance in a named commit domain; receipts remain report-only. The contract forbids database authority, and Wildz adds no external database.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Identity Seal/key entry uses the official v113 same-origin signed continuation with no Receiz redirect. A legacy proof-sealed Vault restores its embedded Wildz identity and complete verified collection into an artifact-scoped Wildz session. Historical-owner cards remain playable through an encrypted commitment to the exact verified Vault, while canonical account-only actions still require owner-continuity or Identity Seal/key authority. Durable shared-world publication requires the server-only Receiz Connect credential described in `.env.example`; it is coordination authority only, not player or artifact authority. Live settlement also requires its Receiz capabilities and otherwise fails closed without changing ownership.

The v113 commerce surface does not by itself supply Wildz's required conditional market ownership append. Listing, offer, trade, and settlement mutations remain unavailable and fail closed whenever that verified capability is absent; no local store is promoted to durable authority.

Receiz v113 supplies proof-object-first artifact custody, bearer ownership, bounded local verification, and structural-only offline reconciliation. A global result means acceptance by the named `receiz.com/global/v1` coordination domain, not universal consensus or effect delivery. Historical sealed bytes remain verifiable evidence, but historical runtime objects, plans, capabilities, confirmations, stores, and receipts cannot authorize a current receiver. Wildz preserves witnessed history, and a queued proposal is not a global commitment.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

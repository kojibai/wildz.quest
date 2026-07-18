# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

The application is aligned to the exact Receiz v110 toolchain: `@receiz/sdk@110.0.0`, `@receiz/mcp-server@110.0.0`, and `@receiz/ai-skills@110.0.0`. All three resolve directly from the official npm registry with integrity checks pinned by `pnpm-lock.yaml`. The checked-in `receiz.app.json` is the artifact-first source contract; `pnpm receiz:check` runs the v110 integration checker and locks the release to registry digest `824aa4af849c4840ba94535798eab36e45d514703b6ae0cd30d4aa53f3c896e4`. V110 unified artifact admission and recovery planning are zero-write; recovery commits require verified capability and atomic storage, while plans and explanations remain non-authoritative. The contract forbids database authority, and Wildz adds no external database.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Identity Seal/key entry uses the official v110 same-origin signed continuation with no Receiz redirect. A legacy proof-sealed Vault restores its embedded Wildz identity and complete verified collection into an artifact-scoped Wildz session. Historical-owner cards remain playable through an encrypted commitment to the exact verified Vault, while canonical account-only actions still require owner-continuity or Identity Seal/key authority. Durable shared-world publication requires the server-only Receiz Connect credential described in `.env.example`; it is not a player token. Live settlement also requires its Receiz capabilities and otherwise fails closed without changing ownership.

The v110 commerce surface does not by itself supply Wildz's required conditional market ownership append. Listing, offer, trade, and settlement mutations remain unavailable and fail closed whenever that verified capability is absent; no local store is promoted to durable authority.

Receiz v110 supplies proof-object-first artifact custody and bearer ownership. Historical key, head, receipt, reconcile, and signed-command mechanics are compatibility history rather than current outcomes. Wildz preserves that witnessed history, and a queued proposal is not a global commitment.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

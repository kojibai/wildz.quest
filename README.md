# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

The application is aligned to the exact Receiz v107 toolchain: `@receiz/sdk@107.0.0`, `@receiz/mcp-server@107.0.0`, and `@receiz/ai-skills@107.0.0`. All three resolve directly from the official npm registry with integrity checks pinned by `pnpm-lock.yaml`. The checked-in `receiz.app.json` is the artifact-first source contract; `pnpm receiz:check` runs the v107 integration checker and locks the release to registry digest `4d0caa6172a69c3bf5817c1c35db5630e555b5d6d824091d45a90fb426b86ef6`. The contract forbids database authority, and Wildz adds no external database.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Identity Seal/key entry uses the official v107 same-origin signed continuation with no Receiz redirect. A legacy proof-sealed Vault restores its embedded Wildz identity and complete verified collection into an artifact-scoped Wildz session. Historical-owner cards remain playable through an encrypted commitment to the exact verified Vault, while canonical account-only actions still require owner-continuity or Identity Seal/key authority. Durable shared-world publication requires the server-only Receiz Connect credential described in `.env.example`; it is not a player token. Live settlement also requires its Receiz capabilities and otherwise fails closed without changing ownership.

The v107 commerce surface does not by itself supply Wildz's required conditional market ownership append. Listing, offer, trade, and settlement mutations remain unavailable and fail closed whenever that verified capability is absent; no local store is promoted to durable authority.

Receiz v107 also supplies unified identity, media, portable-account, bearer-ownership, proof-head, receipt, and offline-command operations. Wildz preserves its verified v106 history through the checked-in forward-only migration state. Any offline command is a signed queued proposal, not a global commitment; only a verified canonical receipt may advance shared authority.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

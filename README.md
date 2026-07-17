# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

The application is aligned to the exact Receiz v106 toolchain: `@receiz/sdk@106.0.0`, `@receiz/mcp-server@106.0.0`, and `@receiz/ai-skills@106.0.0`. All three resolve directly from the official npm registry with integrity checks pinned by `pnpm-lock.yaml`. The checked-in `receiz.app.json` is the artifact-first source contract; `pnpm receiz:check` runs the v106 integration checker and locks the release to registry digest `bf851c209e807309672c0f466411baa5607ce6b3195fe4eb16755edfeb7f5a1a`. The contract forbids database authority, and Wildz adds no external database.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Identity Seal/key entry uses the official v106 same-origin signed continuation with no Receiz redirect. A legacy proof-sealed Vault restores its embedded Wildz identity and complete verified collection into an artifact-scoped Wildz session. Historical-owner cards remain playable through an encrypted commitment to the exact verified Vault, while canonical account-only actions still require owner-continuity or Identity Seal/key authority. Durable shared-world publication requires the server-only Receiz Connect credential described in `.env.example`; it is not a player token. Live settlement also requires its Receiz capabilities and otherwise fails closed without changing ownership.

The v106 commerce surface does not by itself supply Wildz's required conditional market ownership append. Listing, offer, trade, and settlement mutations remain unavailable and fail closed whenever that verified capability is absent; no local store is promoted to durable authority.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

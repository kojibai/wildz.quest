# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

The application is aligned to the exact Receiz v104 toolchain: `@receiz/sdk@104.0.0`, `@receiz/mcp-server@104.0.0`, and `@receiz/ai-skills@104.0.0`. Until those official v104 artifacts are available from the package registry, the repository pins the matching release tarballs in `vendor/`. The checked-in `receiz.app.json` is the artifact-first source contract; `pnpm receiz:check` runs the v104 integration checker against the repository and its generated evidence. The contract forbids database authority, and Wildz adds no external database.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Live settlement requires the Receiz environment described in `.env.example`; without it, checkout fails closed and ownership never changes.

The v104 commerce surface does not by itself supply Wildz's required conditional market ownership append. Listing, offer, trade, and settlement mutations remain unavailable and fail closed whenever that verified capability is absent; no local store is promoted to durable authority.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

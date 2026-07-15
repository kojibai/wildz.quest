# Wildz

Wildz is the standalone, full-screen Receiz game PWA for [wildz.quest](https://wildz.quest). It preserves the open-source Wildz world, collection, battles, progression, multiplayer, Vault recovery, and proof model while replacing the commerce site with a game-first social market overlay.

```bash
pnpm install
pnpm dev
```

Players receive a local Receiz ID on first landing—there is no signup gate. At explorer selection they may restore an existing Identity Seal or verified Vault. Live settlement requires the Receiz environment described in `.env.example`; without it, checkout fails closed and ownership never changes.

See [Receiz rails](docs/RECEIZ_RAILS.md), [MCP](docs/MCP.md), and [AI skills](ai-skills/README.md).

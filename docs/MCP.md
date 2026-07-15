# Wildz MCP contract

Wildz uses `@receiz/sdk@^100.0.0` in application code and documents `@receiz/mcp-server@100.0.0` as the compatible agent tool layer. MCP is operational tooling, never browser authority: tools may inspect capabilities, validate proofs, and prepare commands, but identity signatures, ownership heads, settlement admission, and player confirmations remain authoritative.

Never place credentials in prompts, logs, examples, browser storage, or generated artifacts. Mutations require actor identity, expected revision, idempotency key, and explicit confirmation for listing, offer, trade, payment, transfer, publication, or release actions.

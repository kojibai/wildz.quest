# Receiz V124 production runtime in Wildz

Wildz uses the exact `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` `124.0.1` packages against constitutional ruleset `124.0.0`. The checked-in application contract declares the complete 53-operation V124 matrix. The enclosing sealed proof object and its admitted append-only history remain stronger than a token, authority session, execution handle, MCP reference, projection, receipt, database row, or AI response.

## Active application composition

- The Receiz client is pinned to application/audience `wildz`; callers do not choose a different application identity.
- OAuth scopes are derived from SDK rails. Twin access includes `receiz:twin.read`, `receiz:twin.write`, `receiz:creator.execute`, and `receiz:twin.execute`. World access includes `receiz:world.private`.
- Creature conversation paints and commits the local proof-grounded subject Twin immediately from the complete carried card history. It never waits for network qualification, model output, voice generation, or synchronization.
- When delegated access exists, the optional remote Twin/performance rail first requires V124 operational qualification for subject resolution, proof-brain retrieval, Twin messaging, memory projection, and namespace resolution. A qualified remote subject memory summary may enrich the stream, but remains a non-authoritative projection.
- The application adapter exposes the canonical SDK authority-session lifecycle, atomic execution plan/stage/execute/resolve/cancel paths, verified additions/replay/checkpoint paths, trusted-host private additions, replay proof-object export/restore, V124 namespace resolution, privacy-safe recipient resolution, and sealed-source publication. No method reconstructs authority from JSON.
- Receiz diagnostics qualify the full 53-operation matrix when delegated access exists and report unavailable operations explicitly.

## Ceremony-bound capabilities

Authority sessions, private additions, recipient locators, and durable execution are invoked only for an operation that possesses their required exact artifacts, heads, grants, scopes, and explicit consent. They are not opened speculatively at login or on every frame. Session creation requires both the Receiz identity artifact and the exact subject source artifact; neither a browser cookie nor an MCP handle can substitute for them.

Value movement remains preview → explicit edge consent → exact proof-authority exchange → durable stage/execute → resolution by execution ID or semantic idempotency key. Unknown outcomes are resolved before retry. Settlement and Reserve remain separate rails, and Phi—not USD—is the moved value.

## MCP and AI skills

The 22 V124 MCP tools and 42 AI skills are operator/developer composition surfaces. They are not shipped into the gameplay bundle and never become player authority. MCP keeps handle/session/private material in trusted-host custody, and private additions never enter model output. The application consumes the same canonical SDK methods the MCP adapters map to, preserving SDK/MCP parity without turning MCP into a second backend.

## Latency law

Known local proof paints first. Optional remote qualification, Twin performance, memory summaries, public projection, and synchronization run after or alongside that response. Their failure cannot erase, delay, or downgrade carried proof truth.

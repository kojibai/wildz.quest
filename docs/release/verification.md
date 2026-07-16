# Wildz v3 release verification

Date: 2026-07-16. Target version: `3.0.0`.

## Qualification status

The exact local candidate passed the repository release gate and is qualified for commit. Production activation still requires the production Receiz environment, a successful authorized strict-live run, and the external interoperability and remote-mutation gates described below. This document does not declare the candidate deployed, tagged, pushed, strict-live qualified, or externally published.

## Versioned toolchain

| Package | Requested version | Installed version | Role |
|---|---|---|---|
| `@receiz/sdk` | `104.0.0` | `104.0.0` | Application identity, artifact, native proof-object, App Contract Compiler/checker, and remote-rail client |
| `@receiz/mcp-server` | `104.0.0` | `104.0.0` | Operator tooling; never application authority |
| `@receiz/ai-skills` | `104.0.0` | `104.0.0` | V104 operator procedure guidance; never proof authority |

The finalized v104 SDK, MCP, and AI-skills packages resolve directly from the official npm registry, with their published integrity values pinned by the lockfile. `receiz.app.json` declares artifact-first authority with database authority disabled; the v104 compiler and `pnpm receiz:check` validate the repository integration plan and generated evidence.

## Local evidence

| Gate | Result |
|---|---|
| `pnpm release:check` | Pass: v104 repository integration checker, complete Node test suite, typecheck, lint, full tracked/untracked text secret scan, production build, and default Receiz doctor |
| Proof/Vault regressions | Pass in the full suite, including complete 97/98-card restore, identity-bearing Vault login, Identity Seal login, historical owners, duplicate drops, revision reconciliation, and atomic fork rejection |
| Native proof-object continuity | Pass: v104 Record → Seal artifact, owner, claim, verify path, bundle verification, and final verifier continuity; the deployed `wildz-v103` retry namespace remains stable |
| Legacy compatibility | Pass: strict bounded app-owned reader plus payload digest, owner, namespace, prior-head, and revision checks |
| Owner continuity | Pass: exact duplicates drop, verified newer revisions win, and divergent immutable origins or proof forks fail |
| Public-profile continuity | Pass: verified cards publish before a non-empty owner profile; only marked sanitized anonymous profile JSON is cached by exact URL |
| V3 ecology lifecycle | Pass: activation, resolution, historicization, expiry, cap release, causal replay, and retry idempotency |
| Market settlement coordinator | Pass with local contract doubles: admitted trade, Receiz Connect transfer proof, corroborating wallet ledger event, conditional ownership append, and idempotent recovery; v104 exposes no Wildz-specific conditional append, so the live adapter remains fail-closed without that capability |
| Mobile entry | Chromium and WebKit pass: one-line Genesis copy, no horizontal overflow, and clean entry logs |
| Gameplay presentation | Chromium mobile smoke passed; WebKit mobile world render was visually inspected at the release viewport |
| PWA boundary | Real Chromium worker activation and offline navigation passed; an unvisited public route rendered offline guidance without leaking another page |

The supplied production-shaped Vault was inspected without recording private bytes, paths, identity values, hashes, or card identifiers. It decoded to 98 cards with an embedded player. An actual-byte browser restore using a mocked successful verifier recovered the embedded identity and all 98 cards. The real local verifier attempt failed closed when the live verifier was unavailable; the mocked-verifier result is frontend/coordinator/IndexedDB evidence, not live Receiz verification.

## Pending external evidence

The following remain production or externally authorized gates and were not rewritten as local passes:

- `pnpm receiz:doctor:strict` was attempted and failed closed before live probes because the production credentials and configuration were absent; strict-live qualification remains pending.
- Remote world, public-profile, market, payment, transfer, settlement, and publication mutations remain pending. V104 does not expose the Wildz-specific conditional market ownership append, and the local paths fail closed until the configured Receiz deployment admits every required capability.
- The external six-writer artifact exercise remains pending; its six-writer local fixtures passed.
- Deployment, tag, push, and production publication were not performed.

## Offline verification contract

The worker may cache the versioned app shell, previously visited public profile and card documents, and successful allowlisted card GET responses. Authentication, live world, social presence, market, Receiz, artifact-proxy, personalized, failed, and mutation responses are network-only. An unvisited public document falls back to `/offline`, never the cached root document.

## Remote verification contract

There is no external database added by Wildz. Browser owner state is local IndexedDB state; durable shared state depends on configured Receiz rails. Those rails fail closed when missing, stale, unverifiable, or unreachable. A checkout session is not settlement, and ownership never transfers without admitted settlement evidence.

## Release decision

Version `3.0.0` is locally qualified for commit. Production activation is conditional on the supplied environment, the strict-live doctor, and the remaining authorized external gates.

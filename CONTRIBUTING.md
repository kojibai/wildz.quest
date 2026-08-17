# Contributing to Wildz

Wildz welcomes focused contributions that improve the product without weakening its proof, identity, ownership, or release boundaries.

## Before you start

- Search existing issues and pull requests before opening new work.
- Use an issue for substantial features, new canonical mutations, schema changes, or changes to authority semantics.
- Never include real credentials, identity keys, private artifacts, player data, or production proof objects in an issue, test, fixture, prompt, log, or commit.
- Read the [Receiz-first engineering law](docs/RECEIZ_FIRST_ENGINEERING.md), [architecture](docs/ARCHITECTURE.md), and relevant Receiz documentation before any Receiz-related design or edit.
- All Receiz reasoning must start in this order: exact installed SDK inventory, same-release MCP inventory/schema, applicable AI skills, existing exact proof path, then the smallest native composition.
- Custom infrastructure requires a reviewed, checked-in [capability-gap decision](docs/receiz-decisions/TEMPLATE.md) before implementation. Not finding or not understanding the native primitive is not a gap.

## Development setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The default local environment does not need production credentials. Features that depend on live Receiz rails must report an unavailable or recovery-pending state when those capabilities are absent.

## Making a change

Keep changes narrow and preserve these invariants:

- Verify complete carried artifacts before interpreting payloads.
- Keep SDK access behind the Receiz adapter/domain repository boundary.
- Treat IndexedDB, process memory, caches, model output, plans, and receipts as projections—not canonical authority.
- Preserve append-only witnessed history and explicit structural conflicts.
- Keep deterministic game rules independent of hidden time, randomness, and network state.
- Require current actor, head/revision, idempotency, capability, and confirmation evidence for canonical mutations.
- Keep MCP and AI-skill packages out of browser bundles.
- Fail closed when proof, capability, configuration, or remote admission is missing.

Add or update tests for observable behavior. Authority-bearing changes should include rejection, replay, stale/conflicting state, and partial-failure cases—not only the happy path.

## Verification

Run the full local gate before opening a pull request:

```bash
pnpm release:check
```

For a faster iteration loop, use the individual commands:

```bash
pnpm receiz:architecture-lock
pnpm test
pnpm typecheck
pnpm lint
pnpm receiz:check
pnpm receiz:conformance
pnpm secret:scan
pnpm build
pnpm receiz:doctor
```

Strict-live qualification requires authorized production-like configuration and must never be represented as passing based on local mocks:

```bash
pnpm receiz:doctor:strict
```

## Pull requests

A strong pull request explains:

- The product problem and user-visible result.
- The authority boundary touched, if any.
- Receiz SDK, MCP, AI-skill, contract, or operation-matrix changes.
- The exact SDK primitives, MCP tools/schemas, and AI skills inspected before the design; or the approved capability-gap decision when no native composition exists.
- Offline and failure behavior.
- Verification performed and any intentionally pending external evidence.
- Screenshots or recordings for material UI changes.

By contributing, you agree that your contribution is licensed under this repository's MIT License and that you have the right to submit it.

All participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md). Security vulnerabilities belong in the private process described in [SECURITY.md](SECURITY.md), not a public issue.

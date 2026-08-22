# Receiz-first engineering law

This is a mandatory repository rule for every Receiz-related feature, fix, refactor, optimization, dependency decision, authority decision, or release. It applies to humans, agents, generated plans, and code review. Reasoning starts inside the exact installed Receiz SDK, MCP, and AI-skill release—never from a replacement architecture.

## Required reasoning order

Before designing or editing a Receiz-related path, perform this sequence in order:

1. **SDK inventory:** inspect the exact installed `@receiz/sdk` version, types, public methods, constants, runtime/conformance implementation, and relevant examples. Identify the native application primitive and its proof/head/authority contract.
2. **MCP inventory:** inspect the same-release `@receiz/mcp-server` tool inventory and schemas for capability discovery, operator workflow, audit, and conformance. Do not invent a tool or import MCP into application runtime code.
3. **AI-skill doctrine:** read the applicable same-release `@receiz/ai-skills` skill completely, including its directly required references. Extract its authority, failure, portability, latency, and admission laws.
4. **Existing proof path:** trace the current exact artifact, head, history, custody, and append flow before proposing a change. Preserve proven working semantics unless the request explicitly changes them.
5. **Native composition:** implement the smallest composition of existing SDK primitives that produces the requested result. Keep MCP as tooling, AI skills as doctrine, and the verified proof object as authority.
6. **Executable proof:** add success, rejection, replay/idempotency, stale/conflict, zero-write failure, and authority-boundary tests appropriate to the change; run the architecture lock, official checker, MCP conformance, and release gate.

No external service, provider session, replacement model, hand-built protocol, parallel authority, or application-defined substitute may be designed merely because the native surface was not inspected first.

## Genuine capability-gap exception

Custom infrastructure is allowed only when the exact installed SDK, MCP inventory, and applicable AI skills have been inspected and a real capability gap remains. Before implementation, add a decision record under `docs/receiz-decisions/` using `TEMPLATE.md`. It must name:

- the requested outcome;
- exact installed package/release identity;
- every inspected SDK primitive and why it cannot satisfy the outcome;
- every inspected MCP tool/schema and why it cannot satisfy the operator/conformance need;
- every applicable AI skill and the laws it imposes;
- the existing proof/head/custody/append path that will remain unchanged;
- the minimal proposed addition and why it creates no alternate authority;
- hot-path, dependency, privacy, portability, failure, and removal costs;
- rejection/fail-closed behavior and executable tests; and
- explicit reviewer approval for the gap.

Absence of documentation, unfamiliarity, time pressure, a temporary integration failure, or a guessed limitation is not a capability gap. A fallback that changes the promised identity, proof, intelligence, voice, ownership, settlement, or memory semantics is not equivalent behavior.

## Layer law

- The verified enclosing proof object and its admitted append history are strongest truth.
- The SDK is the application/runtime interface to Receiz capabilities.
- MCP is capability discovery, operator, audit, and conformance tooling; it never enters browser/application hot paths and never becomes proof authority.
- AI skills are mandatory engineering doctrine; they never become runtime code or proof authority.
- Server, database, index, cache, receipt, plan, model output, UI state, and agent explanation remain projections unless an exact Receiz law explicitly admits them.

## Enforcement

`pnpm receiz:architecture-lock` enforces the coordinated package identity, runtime/tooling separation, current high-risk path invariants, checked-in doctrine, and capability-gap process. It runs inside `pnpm release:check`, and CI runs that release gate on every pull request and push to `main`.

The lock is intentionally only one layer. Contributors must also run the official v122 repository checker and MCP conformance, update the application contract when appropriate, and supply live evidence for claims that source inspection cannot prove.

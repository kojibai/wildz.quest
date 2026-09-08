# Receiz v126 integration — 2026-09-07

Wildz pins the public SDK, MCP server, and AI skills packages to `126.0.0`. Registry digest: `80137c2e6f294050ef36ff75e4daac15c7790b7f04d9a91fab9d1970fa3c0b09`. Operation-matrix digest: `42c7f0924df91b4ba11c1b891fee2b92abb509430a86b030735c23d055e67949`. Package SHA-512 integrities were independently compared with the public npm registry.

The application contract adopts all 60 current operation definitions with range `>=126.0.0 <127.0.0`. The installed compiler regenerates the integration manifest. The checker uses the current registry/matrix exports; the retained V125 authority flags and V124/V125 runtime and MCP names remain the published protocol interfaces. Existing source custody, artifact verification, and proof history remain intact.

The builder, market, and release skills bind to the same v126 digests and explain complete source custody, first-seal ownership, deterministic coordinates, and verified append continuity. Historical integration records remain unchanged.

Validation:

- All 2,172 tests passed, with zero failures or skipped tests, including generated contract parity, the v126 public function catalog, artifact verification, wallet admission, and package/digest checks.
- Typecheck, the v126 repository integration checker, architecture lock, MCP conformance, secret scan, and default Receiz doctor passed.
- Production build passed, with a `web-worker` dynamic-dependency warning through the SDK/snarkjs dependency chain and the two source lint warnings noted below.
- All three checked-in skills passed the skill validator.
- Application/source lint passed with two warnings in unchanged files: the fixture image element and a steward environment hook dependency.
- The aggregate `pnpm release:check` passed through conformance, then was interrupted during repository-wide lint, whose scope includes local worktrees. Source lint, secret scan, build, and doctor were run separately. This is not an attestation of a completed aggregate release gate or strict-live qualification.


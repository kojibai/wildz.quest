# Receiz v129 Market Integration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the native purchase integration; independent valuation and release alignment tasks use superpowers:dispatching-parallel-agents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the published Receiz 129.0.0 SDK, MCP server and AI skills into Wildz Market, preserving current users and game behavior and verifying the supported purchase and value paths.

**Architecture:** Keep existing signed public listing/profile publication, private Messages, staged payment and complete artifact delivery. Bind native operations to the configured exact registered client ID. Add a read-only valuation adapter over SDK-admitted complete public proof artifacts; keep intrinsic values, sale evidence and asking prices distinct.

**Tech Stack:** Next.js, React, TypeScript, Receiz SDK/MCP/AI skills 129.0.0.

**Spec:** `docs/receiz-v129-proof-value-contract.md`, installed SDK `docs/registered-native-runtime.md` and `docs/offline-proof-valuation.md`, and the user's approved Market design and purchase requirements.

## Global Constraints

- Pin all three packages to `129.0.0`; retained v124/v125/v128 protocol names remain unchanged.
- Preserve the exact registered OIDC client ID, its case and `rc_` prefix. No username alias or hardcoded replacement.
- Identity and existing artifact history remain unchanged; no rewriting prior application coordinates.
- Use exact canonical uPulse for history/transactions and `☤KAI` whole pulses for visible labels.
- Default displayed valuation to USD with Phi selectable; no fabricated prices, histories or precision.
- Buying requires exact purchase approval. Card checkout funds the buyer's wallet; payment, delivery, claim and custody are separate verified stages.
- No gameplay-time proof sampling or new frame-loop work. No live financial transaction by the agent.

## Review Focus

- A missing/mismatched application setting cannot silently choose an unauthorized slug or expose a client secret.
- Existing public listings must become purchasable by another buyer only after actual native source admission.
- Reload/lost-response recovery cannot duplicate funding, payment or delivery.
- Valuation must bind the exact public card to a canonically verified artifact; caller metadata is insufficient.
- Legacy proofs without required valuation data remain explicitly unsupported, without inventing origin coordinates.

### Task 1: Native application binding and purchase readiness

**Files:** `next.config.mjs`, `src/lib/receiz/wildz-application.ts`, relevant source transport/runtime tests, `src/features/market/wildz-market-controller-v128.ts` if actual readiness defects are found.

**Interfaces:** `wildzNativeApplicationId()` shares the existing Wallet `RECEIZ_CLIENT_ID` exactly through native SDK configuration, challenge audience and source/replay validation. `RECEIZ_APPLICATION_ID` is a compatibility fallback only when the Wallet client is absent. Preserve `WILDZ_RECEIZ_APPLICATION_ID` as the stable world/product namespace, existing wire schemas and native journal law.

- [ ] Add regression checks for exact registered IDs, foreign bindings and missing configuration.
- [ ] Use the server's existing OIDC client configuration as the native application setting, rejecting conflicting explicit settings.
- [ ] Verify grant/publication/session/source replay sequence against shipped v129 guidance.
- [ ] Exercise purchase review, insufficient funds, pending recovery and buyer delivery through existing test ports.

### Task 2: Read-only proof valuation

**Files:** New focused `src/features/market/wildz-market-value-v129.ts`, necessary public artifact reader, `PlayCampaign.tsx` integration, `tests/wildz-market-value-v129.test.ts`.

**Interfaces:** Produce `WildzMarketValuePort` using actual `verifyReceizArtifact`, artifact admission, `projectReceizProofValueV129`, `sampleReceizProofValueV129`, export and verify replay. Consume exact card/proof source and explicit current uPulse.

- [ ] Trace public complete artifact availability and preserve its exact card binding.
- [ ] Test real SDK admission/replay and rejection of mismatched or unsupported proof inputs.
- [ ] Map intrinsic value, model samples and full calculation trace to existing display DTOs; expose only verified public replay.
- [ ] Integrate visible Market reads with bounded caching and sampling; verify no financial writes or gameplay frame work.

### Task 3: Coordinated release alignment

**Files:** `package.json`, `pnpm-lock.yaml`, release checks, SDK version tests, local AI skills and alignment documentation.

- [ ] Install all three exact 129.0.0 packages and inspect full MCP tool schemas and shipped AI instructions.
- [ ] Update package-version checks while retaining the actual constitutional registry/ruleset and matrix bytes.
- [ ] Verify published package integrity, SDK/MCP capability coverage and offline conformance.

### Task 4: Integration verification

- [ ] Run typecheck, relevant lint, full tests and production build.
- [ ] Verify Market UI buyer/seller, offer, history, USD/Phi and checkout/recovery interactions through browser fixtures.
- [ ] Run authenticated read-only live qualification where a genuine session is available; distinguish untested live payment/delivery/provider stages from fixture evidence.
- [ ] Review the final integration and resolve actionable findings before committing authorized changes.

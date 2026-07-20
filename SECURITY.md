# Security policy

Wildz treats identity keys, complete artifacts, owner continuity, market admission, and settlement as security-sensitive surfaces.

## Supported version

Security fixes are maintained for the latest release on the `main` branch. Older releases may receive a fix when compatibility and severity justify it, but are not guaranteed support.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Include affected version/commit, impact, prerequisites, a minimal reproduction, and any suggested mitigation.

If private vulnerability reporting is unavailable, open a public issue containing no exploit or sensitive details and ask the maintainer for a private reporting channel.

Please do not access other users' data, test against production without authorization, degrade service, publish an exploit before a fix is available, or include live credentials/artifacts in a report. Good-faith reports that respect these limits are welcome.

## High-value areas

Reports are especially useful when they involve:

- Identity Seal/key handling, authentication continuation, or session fixation.
- Artifact verification bypass, parser-before-verifier behavior, digest confusion, or resource exhaustion.
- Cross-owner IndexedDB/session leakage or public-profile/card data exposure.
- Capability, actor, tenant, expected-head, idempotency, or confirmation bypass.
- Ownership, listing, trade, transfer, payment, or settlement inconsistencies.
- Webhook verification, SSRF, open redirects, cache poisoning, or service-worker data leakage.
- Secrets entering browser bundles, logs, prompts, generated proof metadata, or repository history.
- MCP tools or AI skills bypassing the same authority checks required by the application.

## Secret handling

Never commit `.env.local`, access tokens, client secrets, signing keys, passphrases, production artifact bytes, or user identifiers. Public examples must use empty values or obvious placeholders. Run `pnpm secret:scan` before every release.

## Disclosure process

Maintainers will acknowledge a complete report when possible, reproduce and assess it, coordinate a remediation, and credit the reporter if requested. Release timing depends on severity, affected rails, and whether coordination with Receiz or another dependency maintainer is required.

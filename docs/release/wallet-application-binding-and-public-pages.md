# Wallet application binding and public pages — September 12, 2026

## Implemented

Wallet read-authority challenges use the server-configured `RECEIZ_CLIENT_ID`. The signed ticket, challenge audience, exchanged authority and completion configuration must agree. Browser input cannot select the application. The `wildz` application namespace remains unchanged for existing records and V124 execution contracts. Changing a public-data namespace to make login succeed would be a separate, unsafe migration.

An `IDENTITY_NOT_BOUND` rejection triggers at most one reconnect through the existing SDK-signed account continuation. It verifies that the same local key is still active and that the remote session admits that exact key before obtaining and signing a fresh wallet challenge. Scope denials and repeated binding failures stop without a transfer.

Bounded protocol failures survive to the wallet UI and server diagnostics. Logs contain only a validated result code, never an artifact, signature, bearer, profile payload, or raw response. No transfer request is replayed by this change.

The standalone profile uses one page scroll instead of inheriting the in-game sheet's height cap. Public card loading has a 15-second timeout, stale-request protection, a retry action, and a separate link to the latest published card when the exact profile-indexed revision is unavailable. Exact card proof matching remains required.

World Law uses a forest-colored single-viewport reader with accessible tabs, independently scrollable text, original source chapters, keyboard navigation, and mobile safe-area spacing. The constitution text and digest are unchanged.

## Production evidence and remaining boundaries

- Vercel logs for September 12, 05:00–05:07 UTC show successful Wildz wallet challenge GETs followed by failed POSTs. Matching Receiz proof-authority exchanges return 400.
- A public OIDC validation request for client `wildz` returns `unauthorized_client`.
- Wildz's public login redirect carries a different registered `rc_…` client. No private seal or token was inspected to establish this mismatch.
- Installed SDK 126.0.0's `v124Contracts.applicationId` accepts only `^[a-z][a-z0-9.-]{0,127}$`, whereas Receiz's OIDC registration creates `rc_` plus mixed-case base64url client IDs. The Receiz server's V124 route boundary uses the same restrictive application-ID grammar. Its proof-authority production dependency looks up that application ID in `oidc_clients`. A direct installed-SDK `qualifyV124` diagnostic using the registered ID fails with `V124_QUALIFICATION_APPLICATION_INVALID` before any network request. Full V124 transfer compatibility requires a coordinated SDK/server application-ID contract correction or an officially supported named application registration. Do not bypass SDK validation or create grant rows directly.
- The installed SDK's card transfer preview points to `/api/receiz/v120/bearer/transfers/preview`. An unauthenticated empty diagnostic POST returns HTML with status 200, not a preview result; the inspected Receiz checkout has no implementation of that route. Authenticated production execution remains unverified. Card transfers must use a supported, operational SDK workflow with verified enclosing artifacts, not a fabricated success result.
- The isolated production preview, using the public registered client ID and a temporary local ticket secret, reached `IDENTITY_NOT_BOUND` for its test identity. The bounded reconnect path was added in response; its success, repeated-rejection, and scope-denial cases are covered by tests. Original-seal production renewal remains unverified.
- Anonymous `https://wildz.quest/u/bjklock` did not recover a published profile during this investigation. The separately published test profile did recover and its exact card opened. These are distinct observations.

No real transfer has been submitted. User permission to test a transfer was received; exact asset/amount and recipient were requested and remain pending. The test accounts observed here hold 0 Phi. Local checks do not establish original-seal production settlement.

## Validation

All 2,307 tests, Receiz v126 integration check, and SDK/MCP conformance passed. Automated wallet checks cover configured client audience and rejection of cross-application tickets before exchange, alongside the existing seal, scope, signature, ticket and ownership checks.

Mobile WebKit at 390×744 confirmed: document width 390, document height 744, World Law footer within the viewport, all reader tabs and source navigation work, public profile has no nested sheet clipping, and the published card opens and closes. No browser page errors. Desktop reader and mobile card screenshots were inspected.

An isolated production build passed with only its temporary webpack disk cache disabled because the normal cache exhausted disk space. The user's port-3022 server and repository build configuration were preserved.

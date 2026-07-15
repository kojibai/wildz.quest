# Receiz rails

| Product primitive | Authority | Failure rule |
|---|---|---|
| Receiz ID / Identity Seal | SDK identity proof | Never expose private key material |
| Vault and living cards | Portable proof chain | Reject invalid or stale heads |
| World and multiplayer | Server-admitted events | Reject teleports and replay |
| Public profile | Sanitized public projection | Private cards and Seal data are omitted |
| Listing and trade | Ownership head + idempotent command | Stale revision fails |
| Checkout | Receiz wallet/card rail | No ownership transfer before admitted settlement |

The first paint and offline shell never depend on a database. Durable social state requires configured Receiz rails. Capability absence is returned explicitly; it is never simulated as success.

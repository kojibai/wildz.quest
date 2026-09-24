# Receiz v127 migration contract

Use SDK, MCP and AI skills 127.0.0 as one release. The registry digest is
8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065;
the operation matrix digest is
eadd171a45fcc51e275a1c57de1eb8e67614757a5723d141793641edf7207a10.

Replace the temporary copied v126 runtime with the public `@receiz/sdk/offline`
API and resources from the installed package. Keep existing device custody by
verifying and migrating its nonexportable CryptoKey locally. Only explicit save
setup may enroll; background card preparation must never register a new device.
Use a dedicated worker for proving; reverify exact output on the receiving side.

Preserve every byte of the game envelope inside the sealed payload. Do not
rewrite existing canonical proofs, owner identity, or history. Reuse current
native artifacts unchanged. A newly sealed game backup is a canonical document;
it is not itself a transfer or an invented native ownership genesis. Native
owner-bound creation requires a genuine same-runtime identity admission through
the SDK. Never replace that admission with a username or device certificate.
Keep native-only transfer and wallet admission checks intact.

Qualify cards, Identity Seals, Vaults and maps with real canonical proving,
network disabled, exact saved-byte reopening, tamper rejection, complete game
payload restoration, and old native-artifact compatibility. Exercise packaged
MCP file verification independently. Update current contracts/checkers/skills
and UI release labels, but retain historical protocol names and durable schemas.
Run types, regressions, release identity checks, architecture lock, SDK/MCP
conformance and a production build. Report any unresolved boundary honestly.

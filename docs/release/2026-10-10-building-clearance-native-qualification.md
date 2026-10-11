# Building clearance Task 3 native qualification

The controller executed the reviewed explicit disposable-signer qualification on 2026-10-10. No default/player signer, production source domain, live listing or financial action was used. Enrollment was a separate explicit opt-in; subsequent qualification reused the same private signer with networking forbidden.

## Reproduction

Compile the test modules with `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs`. The opt-in fresh isolated enrollment command is `node scripts/qualify-clearance-native-source.mjs --enroll-disposable`. It writes private artifacts only to a fresh 0700 `/private/tmp/wildz-clearance-native-*` directory, with secrets/Originals 0600. It must be reviewed before another explicit enrollment; never run it from tests or startup.

The reviewed same-private-custody command used for the passing result was:

```sh
node scripts/qualify-clearance-native-codec.mjs --directory /private/tmp/wildz-clearance-native-GpXcYj
```

The command verifies and opens the existing genuine Identity Seal and worker Original, prepares actual application paid/clearance/pickup events through installed SDK 128.0.0 opaque v124 event primitives, seals complete source and custody portable documents, then independently opens/restores each segment through a fresh SDK. It preserves retained preparation and exact Original bytes for retries. All network calls are forbidden after the initial isolated enrollment.

The complete original 12-harvest paid command prefix is asserted equal to the original retained literal source; the larger compound contains 36 lawful harvests and three paid shell nodes. Both have three native source segments and one finite pickup. Candidate-author grant/actor coordinates are explicitly fixture-only metadata, never authenticated host authority.

## Byte composition and evidence

The original literal full trace restored natively with existing archive byte transport but failed actual production capacity: 33,608,533 inline proof bytes / 23,405,500 compacted bytes. Plain DEFLATE v1 still failed the unchanged source-request preflight (794,349 raw event bytes, 427,525 encoded event bytes, 2,071,294 sealed source bytes). The repeated worker Original exceeded DEFLATE's matching window. These native artifacts were retained unchanged.

The approved application codec v2 deduplicates exact repeated long JSON string tokens before bounded async DEFLATE. It decodes identical canonical journal bytes before existing admission. Native intent/candidate bind the exact encoded bytes; it is not a sealed artifact format or source authority. Current codec head: `sha256:f951e0ed4cd7579ef9cd69e52b0091cf8598236d66819272371b75d4acb047e7`. Literal historical events and retained v1 preparations remain readable and unchanged. V2 qualification uses new attempts and filenames.

The closed decoder checks declared compressed/table/raw limits, exact raw digest and canonical equality, table indices and aggregate expanded bytes before joining text. It bounds dictionary and parts counts before bookkeeping allocations and requires distinct long tokens actually referenced at least twice. These decoder checks preserve all encoder output and retained native candidate bytes. The regression for unused oversized table populations was observed failing before the fix and passing afterward.

| Case / stage | Raw event B | Encoded B | Candidate B | Sealed source B | Custody payload B | Sealed custody B | Source request B | Custody request B | Proof B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 / paid | 794352 | 44322 | 232415 | 254521 | 454526 | 476160 | 339878 | 455132 | 974974 |
| 12 / clearance | 800140 | 45491 | 242435 | 264717 | 925559 | 947777 | 353472 | 926165 | 1957077 |
| 12 / pickup | 802024 | 45686 | 244250 | 265852 | 945703 | 967937 | 354986 | 946309 | 2338751 |
| 36 / paid | 2312689 | 66031 | 335356 | 357694 | 637947 | 660093 | 477444 | 638553 | 1357786 |
| 36 / clearance | 2318881 | 67289 | 345806 | 367920 | 1292455 | 1314769 | 491078 | 1293061 | 2721574 |
| 36 / pickup | 2321171 | 67480 | 347446 | 369016 | 1312583 | 1334801 | 492540 | 1313189 | 3240631 |

Both complete genuine native chains passed all unchanged 2,000,000-byte source JSON/custody multipart preflights, Original/archive bounds and aggregate reader limit. Exit 0; status `verified-local-native-codec-source`; offline network calls 0. Final heads:

- Twelve: `988a7d73067943896de2687e9cc3a4a83f4c01e6772d5188a51474e5fd79deac`; source artifact SHA256 `864c4f3dc4d68d40cb85ccc64588504dad5cbcebfd61ac0c8c671c49307f724c`.
- Compound: `0ba593e19309010225e2419d0988eeb0ab4610ddfc4c1e3dbb348bef0c0184ca`; source artifact SHA256 `f6c328d7c95f509075fd7be3a83213eac8a45eb9a1201948662666988254c79b`.

After the decoder population checks, fresh SDK readers reopened both exact retained packets with the same heads, three segments and one pickup/depletion each, network calls 0. A fixture retry initially rejected a regenerated custody payload because the script guessed a retained Original's MIME instead of preserving the offline sealer's returned `application/octet-stream` descriptor. No Original was replaced. The repaired script now reopens completed packets without identity access/signing; future interrupted runs retain/reuse exact returned descriptors and fail closed if legacy metadata is missing. Repaired resume passed with the same heads and `identityAccess:false`, `sealing:false`. The production source client already retains complete returned descriptors; installed SDK custody export is deterministic from held replay and explicit portable metadata (`v124Domains.js:539–592`, `v124ReplayProofObject.js:2382–2411`, `portableAsset.js:309–325`). No production custody change was needed.

Local evidence logs: `/private/tmp/wildz-clearance-task3-native-codec-v2-qualified.log` (sizes), `/private/tmp/wildz-clearance-task3-native-v2-decoder-restored.log` (hardened decoder), `/private/tmp/wildz-clearance-task3-native-codec-v2-script-resume.log` (repaired retained-packet command). No log contains private key material or Original bytes.

Twelve-harvest codec encode 13.90–14.19 ms, decode 7.57–9.41 ms; compound encode 32.73–40.61 ms, decode 19.30–20.31 ms. Observed Node event-loop delay at 10 ms measurement resolution: 11.16–11.76 ms and 13.69–20.71 ms respectively. Measurements include canonical JSON and token processing. They are local Node observations, not iPhone/Safari frame-budget evidence. Compression occurs on explicit source preparation; exact retained candidates are reused on retry. No movement/camera/render path calls the codec or native source admission.

## Evidence limits

This establishes genuine sealed local root/source restoration and actual application source semantics under existing byte limits. Released SDK in-memory admission-store tests separately establish CAS/rollback/idempotence on competing real final-portion commands. Neither establishes authenticated production-host source publication/currentness/CAS. Existing authenticated proof authority, actor admission, source publication and verified current replay remain mandatory in production. No UI/iPhone activation or browser performance test is claimed. Private originals and secrets remain outside the repository.

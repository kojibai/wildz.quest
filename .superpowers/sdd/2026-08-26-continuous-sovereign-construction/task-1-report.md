# Task 1 report: renewable hay and construction resource coverage

## Changed files

- `src/features/play/wilds-resource-authority.ts`
  - Added `hay` resource authority and fixed construction slots 6/7/8 for hay, timber, and stone.
  - Preserved the legacy slot 0-5 algorithm and canonical identities.
  - Added one shared deterministic scan capped at 32 terrain samples; dry candidates are reused for all three construction kinds and wholly aquatic regions append no construction sources.
- `src/features/play/wilds-steward-construction.ts`
  - Added hay material lots, verification, harvest admission, and gather operation semantics.
  - Preserved timber and stone operation consequence values.
- `src/features/play/wilds-source-work-authority.ts`
  - Credits only compatible optional creatures and tools, and omits incompatible card proof references so an active helper cannot gate solo harvesting.
- `src/features/play/wilds-construction-site.ts`
  - Keeps the legacy prefab boundary narrowed to timber and stone and rejects verified hay lots until continuous component recipes own hay consumption.
- `tests/wilds-resource-lot-world.test.ts`
  - Covers fixed construction slots, canonical hay, renewability, and the complete canonical hash of all six legacy source objects.
- `tests/wilds-steward-construction.test.ts`
  - Covers exact solo hay lots and gather operation consequences.
- `tests/wilds-resource-authority.test.ts`
  - Covers the 32-sample budget and absence of invented resources in a known all-water region.
- `tests/wilds-construction-site.test.ts`
  - Covers fail-closed rejection of a valid hay lot by legacy prefab authority.
- `tests/wilds-source-work-authority.test.ts`
  - Covers incompatible helper omission through world admission and matching-helper operation credit.

## Commands and results

- `./node_modules/.bin/tsc -p tsconfig.test.json --pretty false`
  - Emitted test output with only the preserved `wilds-world-outbox.test.ts` Task 6 API and command failures.
- `node scripts/patch-test-imports.mjs`
  - Passed.
- `node --test .test-build/tests/wilds-resource-authority.test.js .test-build/tests/wilds-resource-lot-world.test.js .test-build/tests/wilds-construction-site.test.js .test-build/tests/wilds-source-work-authority.test.js .test-build/tests/wilds-steward-construction.test.js .test-build/tests/wilds-steward-phi.test.js`
  - Passed: 34 tests, 0 failures.
- `git diff --check`
  - Passed.

## Concerns and follow-up

- Regions with no dry candidate in the bounded scan expose only their unchanged six legacy sources. Nearby-region discovery supplies renewable construction resources without inventing physically invalid underwater hay, timber, or stone.

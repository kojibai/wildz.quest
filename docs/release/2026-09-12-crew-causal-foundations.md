# Crew causal foundations and transaction recovery

This is an infrastructure checkpoint, not an end-to-end crew release.

## Implemented

- SDK-digested causal records preserve local observed Kai micro-pulses, monotonic causal time, logical sequence, worker predecessors and admitted dependency citations. Unknown actions have no admitted effects.
- SDK mandate preparation and preflight bind exact subjects, heads, consent, scope and budgets through explicit verification ports.
- Bounded path planning and allocation-free movement require canonical locomotion permissions and swept collision sampling.
- Whole-request reservation helpers prevent partial allocation within a supplied scheduling snapshot.
- Existing authored transaction recovery no longer reports uncertain execution as zero writes, redispatches unknown outcomes, or dispatches an already staged identical transaction.

## Verification

Full suite: 2,388 tests passed, including the final mandate review regressions. Production build passed before the final isolated mandate-helper fixes; final full-suite TypeScript compilation and targeted ESLint passed afterward.

No animation-loop integration or network polling was added. These checks do not establish live worker execution, multi-device crew continuation or mobile frame-time equivalence.

## Still required

Persistent roster assignments and causal journal; atomic worker-head and lot reservation updates; production proof verification and SDK mandate issuance; authoritative worker movement; admitted gathering, hauling and construction; crew controls and visible workers; actual-event memories and discovery maps; multi-device and real-device playtesting. See ../implementation/creature-crews.md.

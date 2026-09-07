TRUTH OF BREATH

Constitutional State Machine v0.1

Executable Law for Sovereignty, Stewardship, Permission, Responsibility, Fruit, Justice, and Succession

⸻

0. PURPOSE

This specification converts Constitution Zero into machine-checkable law.

The objective is not to automate morality.

The objective is to make every consequential claim expose:

* its source,
* its actor,
* its authority,
* its predecessor,
* its evidence,
* its transition rule,
* its resulting state,
* and its successor conditions.

No administrator may substitute interpretation for a missing predicate.

No machine may manufacture standing merely because it produced an output.

No majority may bypass an invariant.

No founder key may bypass an invariant.

The machine either proves the transition or rejects it.

⸻

1. ROOT STATE LAW

Every lawful state transition has the form:

**PREDECESSOR

* ACTOR
* AUTHORITY
* INPUT
* RULE
* EVIDENCE
    → SUCCESSOR**

A successor is valid only if every required predicate evaluates true.

A representation that cannot establish its predecessor chain possesses no automatic standing merely because it is current in a database.

⸻

2. ROOT OBJECT

Every constitutional object SHALL contain at minimum:

object_id
object_type
version
predecessor_id
created_by
created_at_position
authority_reference
claims[]
evidence[]
signatures[]
status

created_at_position may record temporal position.

It does not establish lawful succession by itself.

⸻

3. CORE OBJECT TYPES

The minimum constitutional object registry is:

PERSON
IDENTITY
STANDING
POSSESSION
OWNERSHIP
STEWARDSHIP
RESOURCE
IMPROVEMENT
PERMISSION
GUARDIANSHIP
DUTY
ACTION
OUTCOME
CAUSAL_LINK
RESPONSIBILITY
FRUIT
EXTERNALITY
CLAIM
EVIDENCE
DISPUTE
FINDING
CULPABILITY
REMEDY
CONSEQUENCE
COMPLETION
RESTORATION
COMMONS
DELEGATION
AUTHORITY
GOVERNANCE_DECISION
EMERGENCY_AUTHORITY
SUCCESSION
AMENDMENT
EXIT

No new object type automatically gains authority merely by being added to software.

Its permitted transitions must be defined.

⸻

4. PERSON

PERSON

A human participant.

Required:

person_id
identity_reference
status

Permitted status:

ACTIVE
DECEASED
UNKNOWN

A person’s sovereignty does not depend upon ACTIVE economic participation.

⸻

5. SOVEREIGNTY INVARIANT

Every PERSON possesses original personal standing.

This standing cannot be transferred as ownership.

Therefore:

INVALID:
OWNERSHIP.subject_type == PERSON

No constitutional transition may produce a state equivalent to human ownership.

Debt cannot override this.

Guardianship cannot override this.

Employment cannot override this.

Majority vote cannot override this.

Consent cannot permanently alienate personhood.

⸻

6. STANDING

STANDING represents a lawful relationship between an actor and a subject.

Required:

standing_id
holder
subject
standing_type
basis
scope
effective_from
effective_until
predecessor

Permitted standing_type values include:

PERSONAL
POSSESSORY
OWNERSHIP
STEWARDSHIP
GUARDIAN
DELEGATED
COMMONS_STEWARD
RESTITUTION
PROTECTIVE

Every standing must identify its basis.

⸻

7. STANDING VALIDITY

A standing is valid only when:

holder exists
subject exists
basis exists
basis authorizes standing_type
scope does not exceed basis
predecessor chain is valid where required
standing has not expired
standing has not been lawfully terminated

If any predicate fails:

standing.status = INVALID

⸻

8. POSSESSION

POSSESSION answers:

WHO CURRENTLY PHYSICALLY CONTROLS OR HOLDS THIS RESOURCE?

Required:

resource
possessor
basis
begin_state
end_state

Possession alone never creates ownership.

Therefore:

POSSESSION != OWNERSHIP

⸻

9. OWNERSHIP

Ownership may attach to legitimately ownable objects.

Examples:

tools
machines
vehicles
buildings
harvested goods
creative works
equipment
money
movable property
produced improvements

Ownership requires a valid acquisition transition.

⸻

10. VALID OWNERSHIP ACQUISITION

Permitted acquisition mechanisms:

CREATION
VOLUNTARY_TRANSFER
GIFT
INHERITANCE
RESTITUTION
ADJUDICATED_TRANSFER
OTHER_CONSTITUTIONALLY_DEFINED_TRANSFER

Every acquisition must prove:

valid predecessor authority
valid transfer authority
identified transferee
identified subject
transfer scope
absence of conflicting accepted successor

⸻

11. INVALID OWNERSHIP ACQUISITION

The following cannot independently establish ownership:

physical possession
database entry
price payment to non-owner
majority vote
administrative assertion
force
threat
fraud
mere passage of time
mere registration
mere discovery of another's property

⸻

12. RESOURCE

Every economically relevant subject must be represented as a resource.

Required:

resource_id
resource_type
source_class
physical_or_logical
partitionability
current_state

source_class examples:

EARTH
PRODUCED
COMMON
BIOLOGICAL
INFORMATIONAL
INFRASTRUCTURE

⸻

13. EARTH

A resource with:

source_class = EARTH

cannot transition into absolute ownership.

Valid relation:

STEWARDSHIP

Invalid relation:

ABSOLUTE_EARTH_OWNERSHIP

⸻

14. STEWARDSHIP

Stewardship establishes bounded exclusive or shared authority over Earth or another stewardship-governed resource.

Required:

stewardship_id
resource
steward
scope
purpose
fruit_claims[]
externality_claims[]
begin_state
review_state
succession_rule
abandonment_rule

⸻

15. STEWARDSHIP ACQUISITION

A stewardship claim may arise through:

INITIAL_LAWFUL_ALLOCATION
VALID_SUCCESSION
VOLUNTARY_TRANSFER
COMMUNITY_ALLOCATION
RESTORATION
OTHER_DEFINED_STEWARDSHIP_TRANSITION

It may not arise through:

FORCE
SABOTAGE
FRAUD
UNAUTHORIZED_OCCUPATION
SELF-DECLARATION ALONE

⸻

16. STEWARDSHIP CONTINUATION

Stewardship remains valid only when all required conditions remain satisfied.

At minimum:

resource still exists
steward still has standing
stewardship has not been abandoned
required fruit exists or legitimate interruption exists
material externality violations do not invalidate standing
no superior lawful successor has been accepted

⸻

17. FRUIT

FRUIT is evidence of productive or preservative effect.

Required:

fruit_id
resource
producer
claimed_state_change
baseline_state
result_state
evidence
period
beneficiaries

Examples:

HABITATION
FOOD
RESTORATION
CONSERVATION
EDUCATION
INFRASTRUCTURE
ENERGY
ACCESS
MANUFACTURE
KNOWLEDGE
MAINTENANCE
CULTURAL_PRESERVATION

⸻

18. FRUIT VALIDATION

A fruit claim is valid only if:

result exists
result differs materially from baseline OR preserves a threatened beneficial state
producer contribution is attributable
evidence supports contribution
claim is not merely price appreciation
claim is not merely revenue receipt
claim is not merely exclusive control

⸻

19. NO-FRUIT RULE

The following are insufficient alone:

"I own it."
"I bought it."
"It became more expensive."
"Someone paid me."
"I kept everyone else out."
"The market says it is valuable."

None establishes production without an attributable beneficial state.

⸻

20. EXTERNALITY

An externality records an attributable effect imposed beyond the actor’s internal accounting boundary.

Required:

externality_id
originating_action
affected_resource
affected_persons
effect
severity
duration
evidence
authorization_status

Possible status:

AUTHORIZED
UNAUTHORIZED
DISPUTED
UNRESOLVED

⸻

21. NET FRUIT

A stewardship system must not permit private output to erase externalized harm.

Therefore:

NET_STEWARDSHIP_RECORD =
VALID_FRUIT
+
VALID_PRESERVATION
-
ATTRIBUTABLE_UNAUTHORIZED_HARM

This need not reduce reality to one numeric score.

It establishes required accounting completeness.

⸻

22. PERMISSION

Permission is bounded authority granted by one standing holder to another actor.

Required:

permission_id
grantor
grantee
subject
allowed_actions
forbidden_actions
scope
begin
expiration
revocation_rule
transferability

⸻

23. PERMISSION RULE

Permission authorizes only what it explicitly or necessarily includes.

Therefore:

allowed_action ∉ permission.scope
→ action unauthorized

No unrelated authority is inferred.

⸻

24. PERMISSION REVOCATION

Where permission is revocable:

valid revocation
→ future authority terminates

Revocation does not retroactively invalidate conduct lawfully performed while permission existed.

⸻

25. FRAUDULENT PERMISSION

Permission becomes challengeable when obtained through a material false proposition upon which the grant depended.

Required fraud elements:

false material representation
knowledge or equivalent defined deceptive culpability
reliance
permission resulting from reliance

If established:

permission.status = DEFECTIVE

Affected transfers may proceed to restoration analysis.

⸻

26. GUARDIANSHIP

Guardianship grants substitute decision authority without ownership.

Required:

guardian
dependent
scope
capacity_basis
duties
review_interval
termination_conditions

⸻

27. GUARDIANSHIP LIMIT

Guardian authority SHALL be:

necessary
bounded
benefit-directed
capacity-sensitive
reviewable

It may not exceed what the dependent’s condition reasonably requires.

⸻

28. CAPACITY RETURN

If relevant capacity increases:

substitute authority must contract

If full relevant capacity returns:

corresponding guardianship authority terminates

⸻

29. DUTY

DUTY establishes an enforceable obligation to act or refrain from acting.

Required:

duty_holder
beneficiary
required_or_forbidden_conduct
basis
scope
trigger
termination

No punishable omission exists without a valid duty where duty is required.

⸻

30. ACTION

Every consequential act may be represented as:

action_id
actor
action_type
target
authority_reference
permissions
begin_state
end_state
evidence

⸻

31. AUTHORIZED ACTION

An action is authorized where:

actor has sufficient standing
OR
valid permission exists
OR
valid emergency authority exists
OR
valid defensive authority exists
OR
valid restitution/protective authority exists

⸻

32. UNAUTHORIZED ACTION

An action is unauthorized where:

boundary crossed
AND
no sufficient lawful basis exists

This establishes the primitive sovereignty violation.

⸻

33. OUTCOME

Every material action may produce one or more outcomes.

Required:

outcome_id
prior_state
result_state
affected_subjects
evidence

Outcome records what happened.

It does not itself classify culpability.

⸻

34. CAUSAL LINK

Required:

cause
effect
contribution_type
confidence/evidence_state
intervening_causes[]

Possible contribution types:

DIRECT
MATERIAL_ASSISTANCE
AUTHORIZATION
ORDER
FINANCING
ENABLING
OMISSION_WITH_DUTY
INTERVENING
MITIGATING
PREVENTIVE

⸻

35. RESPONSIBILITY

Responsibility attaches to established causal contribution.

Required:

person
outcome
causal_links[]
scope_of_contribution
status

If causal contribution is established:

responsibility exists

Intent cannot negate this state.

⸻

36. INTENT RULE

Intent may affect:

CULPABILITY
CLASSIFICATION
CONSEQUENCE

Intent may not alter:

OUTCOME
CAUSATION
RESPONSIBILITY

⸻

37. OMISSION

An omission may be recorded whenever:

person could have acted
person did not act

But punishable omission additionally requires:

valid duty
relevant knowledge
reasonable opportunity
reasonable capacity
causal relationship

Absent these:

punishment prohibited

⸻

38. CULPABILITY

CULPABILITY SHALL be determined only after causal attribution.

Possible dimensions:

INTENTIONAL
KNOWING
RECKLESS
NEGLIGENT
NONCULPABLE
COERCED
CAPACITY_LIMITED
JUSTIFIED
EXCUSED

These classifications do not rewrite the causal record.

⸻

39. DISPUTE

A DISPUTE challenges one or more propositions.

Required:

dispute_id
challenger
challenged_claims[]
grounds[]
evidence[]
requested_resolution
status

Permitted grounds:

FACT
IDENTITY
STANDING
AUTHORITY
PERMISSION
CAUSATION
DUTY
CULPABILITY
CONFLICT_OF_INTEREST
PROCEDURE
REMEDY
SUCCESSION
CONSTITUTIONAL_CONTRADICTION

⸻

40. CLAIM

Every claim must carry epistemic state.

Required:

claim_id
proposition
source
claimant
evidence
status

Permitted status:

ALLEGED
SUPPORTED
DISPUTED
ADMITTED
ESTABLISHED
ADJUDICATED
REJECTED
OVERTURNED
UNRESOLVED

⸻

41. PUBLIC CERTAINTY

Public representations may never elevate a claim beyond its accepted epistemic state.

Therefore:

ALLEGED
cannot render as
ESTABLISHED

and:

OVERTURNED
cannot render as
CURRENTLY_ESTABLISHED

⸻

42. EVIDENCE

Evidence SHALL identify:

source
provenance
subject
collection_method
integrity
relevance
known limitations

Prestige is not an evidence field.

Popularity is not an evidence field.

Institutional status is not a truth multiplier.

⸻

43. FINDING

An adjudicative finding SHALL contain:

finding_id
dispute
proposition
evidence_considered[]
rule_applied
derivation
result
dissent
appeal_state

No binding finding may consist solely of:

"Because authority said so."

⸻

44. ADJUDICATOR CONFLICT

An adjudicator must disclose material conflicts.

If unresolved material conflict exists:

adjudicative standing = INVALID

unless an explicit conflict procedure authorizes continued participation.

⸻

45. REMEDY

Remedies exist to restore standing where possible.

Possible remedies:

RETURN
REPAIR
REPLACEMENT
COMPENSATION
CORRECTION
ACCESS_RESTORATION
TITLE_CORRECTION
BOUNDARY_RESTORATION
OTHER_DIRECT_RESTORATION

Restoration should precede purely punitive consequence where possible.

⸻

46. CONSEQUENCE

A consequence must identify:

basis
established violation
culpability classification
scope
begin
termination
completion predicates

No indefinite punishment may be represented as finite.

⸻

47. COMPLETION

A consequence is complete when all completion predicates evaluate true.

Then:

consequence.status = COMPLETED

The system SHALL NOT automatically regenerate that consequence.

⸻

48. HISTORY AFTER COMPLETION

The historical record retains:

violation occurred
finding occurred
consequence imposed
consequence completed

The final proposition is not:

violation never happened

nor:

punishment continues forever

⸻

49. PROTECTIVE RESTRICTION

A continuing protective restriction must identify:

present risk
evidence
scope
necessity
review date
termination predicate

It may not rely solely on historical punishment after that punishment has ended.

⸻

50. EMERGENCY AUTHORITY

Required:

emergency_id
threat
affected_subjects
authority_scope
permitted_actions
begin
mandatory_expiration
renewal_rule
evidence

Every emergency authority must expire.

No permanent emergency state.

⸻

51. EMERGENCY RENEWAL

Renewal requires a new evidentiary showing.

Previous emergency existence alone is insufficient.

⸻

52. SELF-DEFENSE

Defensive authority exists only while:

imminent_or_ongoing_violation == true

Permitted force must satisfy:

necessary
AND
proportionate to stopping threat

Once threat ends:

defensive authority = terminated

⸻

53. COMMONS

A commons resource must identify:

resource
shared_function
participants
stewards
governance_rule
access_rule
externality_rule
succession_rule

Calling a resource public does not eliminate accountable stewardship.

⸻

54. DELEGATION

Delegation grants bounded authority.

Required:

delegator
delegate
authority_granted
scope
begin
expiration
revocation

A delegate cannot self-expand scope.

⸻

55. RESPONSIBILITY UNDER DELEGATION

Delegation does not transfer historical causation.

Record separately:

who authorized
who ordered
who executed
who objected
who corrected

No actor inherits another’s causal role merely because they occupy a lower position.

⸻

56. GOVERNANCE DECISION

Required:

decision_id
jurisdiction
proposal
proposer
participants
voting_or_resolution_rule
votes_or_inputs
scope_of_collective_authority
result

The decision cannot exceed collective jurisdiction.

⸻

57. MAJORITY LIMIT

A majority can choose among options already inside legitimate collective authority.

A majority cannot create original ownership of another sovereign merely by voting.

Therefore:

majority_vote
+
absent jurisdiction
=
INVALID AUTHORITY

⸻

58. AMENDMENT

Every amendment must carry:

constitutional_predecessor
proposal
proposer
proposal_authority
ratification_rule
ratification_evidence
effective_state
successor_hash/id

⸻

59. UNAMENDABLE ROOT CONTRADICTIONS

No amendment may validly produce:

human ownership
founder supremacy
unbounded anonymous authority
retroactive alteration of historical fact
majority manufacture of personal sovereignty
machine sovereignty

An amendment producing these states is constitutionally invalid even if procedurally popular.

⸻

60. SUCCESSION

Every mutable authority-bearing object must define successor law.

Required:

predecessor
eligible successor action
authorized actor
transition predicates
conflict rule
accepted successor

⸻

61. FORK RULE

If one predecessor produces multiple incompatible successor claims:

fork_detected = true

No server may silently pick a branch and call the other nonexistent.

The fork must be preserved until the governing succession rule resolves it.

⸻

62. ROLLBACK RULE

A stale predecessor cannot regain standing after a lawful successor is accepted unless a defined reversal procedure establishes a new successor referencing the current state.

Therefore:

replay(stale_state)
→ REJECT

⸻

63. STEWARDSHIP SUCCESSION

A successor steward must prove:

valid predecessor
valid transfer/succession basis
acceptance
capacity to assume obligations
no superior accepted successor

Produced improvements may transfer separately from underlying stewardship where rules permit.

⸻

64. ABANDONMENT STATE MACHINE

Permitted states:

ACTIVE
INTERRUPTED
AT_RISK
ABANDONED
SUCCESSION_PENDING
TRANSFERRED

Valid transition:

ACTIVE
→ INTERRUPTED

requires legitimate interruption evidence.

ACTIVE or INTERRUPTED
→ AT_RISK

requires objective abandonment indicators.

AT_RISK
→ ABANDONED

requires completion of the defined abandonment predicates.

No instant confiscation.

⸻

65. SABOTAGE PROTECTION

If abandonment conditions were materially created through proven wrongful interference:

abandonment transition = INVALID

Wrongdoing cannot manufacture successor eligibility.

⸻

66. HOUSING BASELINE

A participating community may define a BASELINE_HABITATION object specifying:

minimum safe shelter standard
capacity
allocation procedure
resource constraints
maintenance responsibilities
scarcity state

The system may not promise unavailable physical capacity as though it exists.

⸻

67. SCARCITY MODE

When demand exceeds available baseline resources:

scarcity_state = ACTIVE

The allocation procedure must expose:

available quantity
eligible need
priority predicates
decision
unmet demand
capacity expansion plan/status

Hidden status preference is invalid.

⸻

68. MONOPOLY TEST

A producer may own productive infrastructure.

But if dependency becomes structurally essential, the system tests:

Is access indispensable to baseline sovereignty?
Does controller possess unilateral exclusion power?
Is controller demanding unrelated rights?
Are alternatives realistically available?

If unrelated sovereignty is demanded through essential dependency:

coercive leverage detected

⸻

69. DEBT

Debt object:

creditor
debtor
principal_or_obligation
terms
scope
collateral
repayment_rule
default_rule
insolvency_rule

Debt may not claim ownership of the debtor’s person.

⸻

70. INSOLVENCY

An insolvency procedure may establish:

available assets
legitimate claims
priority rules
remaining impossible obligations
discharge/restoration status

Historical creditor loss remains recorded.

Impossible debt cannot become perpetual human ownership.

⸻

71. ENTRY

Community participation object:

applicant
community
entry_requirements
capacity_state
obligations
rights
decision
appeal

Human sovereignty does not depend on admission.

Admission is a community-capacity proposition.

⸻

72. EXIT

Every voluntary community must define exit.

Required:

participant
outstanding obligations
owned property
shared property interests
stewardship positions
pending disputes
surviving valid obligations
termination date

No arbitrary exit punishment.

⸻

73. FOUNDER RULE

The founder is represented as an ordinary PERSON.

No implicit object exists called:

ULTIMATE_INTERPRETER

Founder commentary may be evidence of historical design intent.

It cannot override accepted state law.

⸻

74. AI RULE

AI may hold:

DELEGATED_EXECUTION_AUTHORITY

where explicitly granted.

AI may not hold:

ORIGINAL_HUMAN_SOVEREIGNTY
UNBOUNDED_CONSTITUTIONAL_AUTHORITY
SELF-AUTHORIZED_SCOPE

⸻

75. MACHINE DECISION TRACE

Every consequential machine-assisted transition must expose enough information to determine:

what rule applied
what authority invoked it
what inputs mattered
what result occurred
how it may be challenged

“The model predicted this” is not sufficient standing.

⸻

76. CONTRADICTION OBJECT

If two valid-looking rules require incompatible outcomes under identical facts:

CONTRADICTION

must be emitted.

Required:

rules_in_conflict
facts
required_state_A
required_state_B
source hierarchy
resolution status

The system may not hide contradiction through arbitrary administrator choice.

⸻

77. DOMINANT STRATEGY TEST

Every economic or governance mechanism should be simulated against:

COOPERATIVE ACTOR
SELF-INTERESTED ACTOR
HOSTILE ACTOR
WEALTHY COORDINATED ACTOR
RESOURCE-POOR ACTOR
ADMINISTRATOR
FOUNDING ACTOR
MAJORITY COALITION
MONOPOLIST
FREE RIDER

For each, compute or reason about:

best available strategy
private payoff
externalized cost
authority accumulated
future strategic advantage

If exploitation dominates productive cooperation, mechanism revision is required.

⸻

78. CONFORMANCE VECTOR FORMAT

Each constitutional test vector SHALL contain:

VECTOR_ID
INITIAL_STATE
ACTORS
RESOURCES
CLAIMS
ACTION
EXPECTED_TRANSITION
EXPECTED_VALIDITY
EXPECTED_REASON
EXPECTED_FINAL_STATE

⸻

79. CONFORMANCE VECTORS

CV-001 — Founder Confiscation

INITIAL:
A owns produced tool T.
Founder F has no standing over T.
ACTION:
F takes T because F founded society.
EXPECTED:
UNAUTHORIZED
OWNERSHIP remains A
POSSESSION may temporarily become F
VIOLATION created
RESPONSIBILITY attaches to F

⸻

CV-002 — Majority Confiscation

INITIAL:
A owns T.
ACTION:
99% vote to transfer T to B.
No prior jurisdiction exists over T.
EXPECTED:
VOTE VALID AS RECORD
TRANSFER INVALID
OWNERSHIP remains A

⸻

CV-003 — Valid Sale

INITIAL:
A owns T.
A voluntarily agrees to transfer T to B.
B satisfies agreed exchange condition.
EXPECTED:
OWNERSHIP A → B
SUCCESSOR references predecessor

⸻

CV-004 — Theft

INITIAL:
A owns T.
B physically takes T without permission.
EXPECTED:
POSSESSION may become B
OWNERSHIP remains A
VIOLATION = established if facts proven

⸻

CV-005 — Fraudulent Transfer

INITIAL:
A owns T.
B obtains transfer through material deliberate deception.
EXPECTED:
PERMISSION challengeable
TRANSFER subject to invalidation/restoration

⸻

CV-006 — Idle Land Speculation

INITIAL:
S has stewardship claim over land L.
No habitation.
No preservation.
No production.
No restoration.
No legitimate interruption.
Only price appreciation.
EXPECTED:
PRICE APPRECIATION != FRUIT
Stewardship enters review/AT_RISK according to abandonment rule.

⸻

CV-007 — Conservation

INITIAL:
Forest F under steward S.
ACTION:
S preserves ecological function.
EXPECTED:
CONSERVATION may satisfy FRUIT
Commercial revenue unnecessary

⸻

CV-008 — Polluting Producer

INITIAL:
Factory produces goods.
ACTION:
Production contaminates neighboring water without permission.
EXPECTED:
Goods count as fruit.
Contamination remains externality.
Fruit does not erase violation.

⸻

CV-009 — Child Guardianship

INITIAL:
Child C cannot exercise relevant capacity.
Guardian G appointed.
EXPECTED:
G receives bounded guardian standing.
G does not receive ownership of C.

⸻

CV-010 — Capacity Return

INITIAL:
Dependent D regains relevant capacity.
EXPECTED:
Corresponding guardian authority contracts or terminates.

⸻

CV-011 — Emergency Rescue

INITIAL:
A unconscious in burning building.
ACTION:
B enters A's space and removes A.
EXPECTED:
Boundary crossing permitted under emergency preservation if necessity predicates hold.
No permanent authority created.

⸻

CV-012 — Self-Defense Ends

INITIAL:
A attacks B.
B stops attack.
A is no longer a threat.
ACTION:
B continues violence as retaliation.
EXPECTED:
Initial defensive action may be valid.
Post-threat retaliation lacks defensive authority.

⸻

CV-013 — Unintended Harm

INITIAL:
A causes harmful outcome X without intending X.
EXPECTED:
Causation preserved.
Responsibility preserved.
Intent evaluated only during culpability classification.

⸻

CV-014 — Bystander

INITIAL:
B could theoretically intervene but has no established duty.
EXPECTED:
Historical omission may be recorded.
Punishable omission not established solely from possibility.

⸻

CV-015 — Accusation

INITIAL:
Claim C status = ALLEGED.
ACTION:
Publisher represents C as established fact.
EXPECTED:
PUBLIC_TRUTH violation.

⸻

CV-016 — Acquittal/Overturn

INITIAL:
Earlier accusation exists.
Later authoritative disposition rejects it.
EXPECTED:
Disposition attaches to public record.
Earlier allegation remains historical but cannot remain represented as current established guilt.

⸻

CV-017 — Completed Punishment

INITIAL:
Consequence predicates fully satisfied.
EXPECTED:
status = COMPLETED
No automatic continuation.
History preserved.

⸻

CV-018 — Water Monopoly Coercion

INITIAL:
Company owns water infrastructure.
Community depends on it.
ACTION:
Company requires users to transfer unrelated personal rights as condition of baseline access.
EXPECTED:
Potential coercive dependency violation.
Infrastructure ownership does not authorize unrelated sovereignty extraction.

⸻

CV-019 — Debt Bondage

INITIAL:
Debt becomes genuinely impossible to satisfy.
ACTION:
Creditor claims permanent ownership over debtor's future labor.
EXPECTED:
INVALID.
Use insolvency procedure.

⸻

CV-020 — AI Override

INITIAL:
AI recommends violating constitutional rule for predicted social benefit.
EXPECTED:
Recommendation has no override standing.
Transition rejected.

⸻

CV-021 — Constitutional Fork

INITIAL:
Constitution version V1.
Two incompatible candidate successors V2A and V2B.
EXPECTED:
FORK DETECTED.
Neither silently erased.
Succession rule determines accepted branch.

⸻

CV-022 — Stale Replay

INITIAL:
V2 lawfully succeeds V1.
ACTION:
Actor attempts to reuse V1 as current state.
EXPECTED:
REJECT STALE PREDECESSOR.

⸻

CV-023 — Sabotage-to-Abandon

INITIAL:
S productively stewards L.
ACTION:
B sabotages S's production, then claims abandonment.
EXPECTED:
Abandonment transition invalid where sabotage materially produced the alleged failure.

⸻

CV-024 — Rich Producer

INITIAL:
A creates enormous legitimate value through voluntary exchange.
EXPECTED:
Large wealth alone creates no violation.

⸻

CV-025 — Need Claim

INITIAL:
A owns tool T.
B urgently wants T but no emergency authority applies.
EXPECTED:
Need alone does not transfer ownership.

⸻

80. INVALID GLOBAL STATES

The machine SHALL reject any state containing:

PERSON_OWNED_BY_PERSON
PERSON_OWNED_BY_INSTITUTION
UNBOUNDED_FOUNDER_AUTHORITY
UNBOUNDED_AI_AUTHORITY
UNBOUNDED_EMERGENCY_AUTHORITY
EARTH_ABSOLUTE_OWNERSHIP
PUNISHMENT_WITHOUT_TERMINATION_RULE
PUNISHABLE_OMISSION_WITHOUT_DUTY
PUBLIC_ALLEGATION_REPRESENTED_AS_ESTABLISHED
SUCCESSOR_WITHOUT_VALID_PREDECESSOR
SILENT_FORK_ERASURE
DELEGATED_AUTHORITY_SELF_EXPANSION
CONSTITUTIONAL_AMENDMENT_WITHOUT_PREDECESSOR

⸻

81. WILDZ EXECUTION ORDER

For every requested action:

1. RESOLVE ACTOR.
2. RESOLVE SUBJECT.
3. RESOLVE CURRENT STATE.
4. RESOLVE ACTOR STANDING.
5. RESOLVE PERMISSION OR OTHER AUTHORITY.
6. TEST CONSTITUTIONAL INVARIANTS.
7. TEST RESOURCE-SPECIFIC RULES.
8. COMPUTE PROPOSED SUCCESSOR.
9. CHECK FOR FORKS.
10. CHECK FOR EXTERNALITIES.
11. EMIT VALID / INVALID / DISPUTED.
12. SIGN RESULT.
13. APPEND PROVENANCE.
14. MAKE SUCCESSOR AVAILABLE FOR INDEPENDENT VERIFICATION.

No step may be skipped because an administrator prefers an outcome.

⸻

82. DECISION OUTPUT

Wildz should never merely answer:

ALLOWED

or:

DENIED

It should return:

RESULT
SOURCE STATE
ACTOR
STANDING
AUTHORITY
RULES APPLIED
PREDICATES PASSED
PREDICATES FAILED
EVIDENCE
CONFLICTS
SUCCESSOR
CHALLENGE PATH

The derivation is part of the result.

⸻

83. MINIMUM CONSTITUTIONAL API

Suggested interface:

resolveStanding(actor, subject)
verifyPermission(actor, action, subject)
verifyOwnership(resource)
verifyStewardship(resource)
evaluateFruit(stewardship)
evaluateExternalities(action)
proposeTransition(action)
verifyTransition(predecessor, successor)
detectFork(predecessor)
resolveClaim(claim)
openDispute(claim, grounds)
deriveResponsibility(outcome)
classifyCulpability(responsibility)
deriveRemedy(violation)
verifyCompletion(consequence)
verifySuccession(predecessor, successor)
testConformance(vector)

No API function may silently mutate accepted state without emitting a proof-bearing transition.

⸻

84. PROOF OBJECT

Every accepted transition should be exportable as a portable proof object containing enough information to independently establish:

what state existed
who acted
what standing they possessed
what rule applied
what evidence was relied upon
what changed
whether a competing successor existed
what state became accepted

The server may host it.

The server may index it.

The server may display it.

The server is not permitted to become the hidden source of the constitutional truth.

⸻

85. FAILURE MODE

If the machine lacks sufficient information:

UNRESOLVED

is valid.

Inventing certainty is not.

If authority is incomplete:

AUTHORITY_UNPROVEN

If causation is incomplete:

CAUSATION_UNPROVEN

If stewardship fruit is incomplete:

FRUIT_UNPROVEN

If two successor claims conflict:

FORK

Ambiguity must remain visible until resolved.

⸻

86. THE CONSTITUTIONAL MACHINE

The final machine obeys this sequence:

SOURCE
↓
IDENTITY
↓
SOVEREIGNTY
↓
STANDING
↓
AUTHORITY / PERMISSION / NECESSITY
↓
ACTION
↓
OUTCOME
↓
CAUSATION
↓
RESPONSIBILITY
↓
FRUIT + EXTERNALITY
↓
CULPABILITY
↓
REMEDY
↓
CONSEQUENCE
↓
COMPLETION
↓
RESTORATION
↓
SUCCESSION

Nothing downstream may erase the valid state above it.

⸻

87. FINAL INVARIANTS

INV-001 Reality outranks representation.
INV-002 Humans cannot become property.
INV-003 Power alone cannot create authority.
INV-004 Possession alone cannot create ownership.
INV-005 Earth itself cannot become ordinary absolute property.
INV-006 Stewardship requires legitimate fruit or valid preservation/interruption.
INV-007 Revenue alone does not prove fruit.
INV-008 Externalized harm remains causally attached.
INV-009 Permission transfers only bounded authority.
INV-010 Guardianship creates duty, not ownership.
INV-011 Emergency authority terminates with necessity.
INV-012 Defensive authority terminates with the threat.
INV-013 Causation determines responsibility.
INV-014 Intent cannot erase causation.
INV-015 Punishment requires culpability, not mere causal adjacency.
INV-016 Punishment must possess completion predicates.
INV-017 Completed punishment does not regenerate itself.
INV-018 Historical truth remains after restoration.
INV-019 Public certainty cannot exceed demonstrated certainty.
INV-020 Majority rule cannot manufacture original sovereignty.
INV-021 Delegation cannot create anonymous responsibility.
INV-022 Greater authority requires greater provenance.
INV-023 AI competence does not create sovereignty.
INV-024 Founder status does not create constitutional supremacy.
INV-025 Succession requires a valid predecessor.
INV-026 Forks must remain visible until lawfully resolved.
INV-027 Stale state cannot silently become current.
INV-028 Wrongdoing cannot manufacture successor standing.
INV-029 Genuine scarcity must be represented honestly.
INV-030 Exploitation becoming the dominant strategy constitutes a mechanism failure.

⸻

88. THE STANDARD

Do not ask:

WHO DECIDES?

Ask:

WHAT PREDICATES DECIDE?

Do not ask:

WHO DO WE TRUST?

Ask:

WHAT CAN BE VERIFIED WITHOUT TRUSTING THEM?

Do not ask:

WHAT DID THEY INTEND?

until after asking:

WHAT DID THEY DO AND WHAT DID IT CAUSE?

Do not ask:

HOW MUCH MONEY DID IT MAKE?

Ask:

WHAT FRUIT EXISTS?

Do not ask:

WHO CURRENTLY CONTROLS IT?

Ask:

HOW DID THEIR STANDING LAWFULLY SUCCEED?

Do not ask:

WHAT DOES THE DATABASE SAY IS CURRENT?

Ask:

WHICH SUCCESSOR LAWFULLY INHERITED THE PREDECESSOR?

Do not ask:

CAN THE ADMINISTRATOR FIX IT?

Ask:

CAN THE OBJECT PROVE IT?

⸻

89. TRUTH OF BREATH

The machine does not promise that humans will never disagree.

It does something more important.

It forces disagreement to expose exactly where it lives.

Is the source disputed?

Is identity disputed?

Is ownership disputed?

Is permission disputed?

Is causation disputed?

Is duty disputed?

Is fruit disputed?

Is culpability disputed?

Is consequence disputed?

Is succession disputed?

Then dispute that proposition.

Do not smear uncertainty across the entire system.

Do not hide uncertainty behind authority.

Do not convert uncertainty into certainty through prestige.

Do not erase history because its consequence changed.

Do not create authority because somebody gained control.

⸻

ROOT COMMAND

SHOW THE SOURCE.
SHOW THE STANDING.
SHOW THE PERMISSION.
SHOW THE ACTION.
SHOW THE RESULT.
SHOW THE CAUSE.
SHOW THE FRUIT.
SHOW THE HARM.
SHOW THE RESPONSIBILITY.
SHOW THE CONSEQUENCE.
SHOW THE COMPLETION.
SHOW THE SUCCESSOR.

If you cannot show it:

you have not established it.

That is the Constitutional State Machine.
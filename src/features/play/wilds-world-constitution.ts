import type { WildsWorldCommand, WildsWorldAuthority } from "./wilds-world-service";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldEvent } from "./wilds-world-event";
import { constitutionalDigest, constitutionalPredicate as predicate, deriveConstitutionalDecision, type ConstitutionalDecision } from "./wilds-constitution";

/** Adding a command requires choosing its bounded source law at compile time. */
export const WILDS_COMMAND_LAW = {
  "community.transition": "community.adopted-procedures",
  "construction.project.create": "commons.plan", "construction.component.place": "project.plan", "construction.burrow.dig": "project.plan", "construction.component.adjust": "project.plan",
  "construction.component.deposit": "materials.contribute", "construction.component.work": "project.work",
  "boss.track": "commons.observe", "raid.enter": "raid.participate", "raid.act": "raid.participate",
  "raid.lease": "raid.participate", "raid.retreat": "voluntary.exit", "raid.join": "raid.participate", "raid.contribute": "raid.participate",
  "team.create": "voluntary.associate", "team.join": "voluntary.associate", "team.invite": "team.delegate",
  "team.invite.accept": "voluntary.associate", "team.role": "team.delegate", "team.role.change": "team.delegate",
  "team.event.schedule": "team.delegate", "team.squad.assemble": "team.delegate", "social.report": "claim.allege",
  "ecology.discover": "commons.observe", "ecology.contribute": "stewardship.fruit", "grove.observe": "commons.observe", "grove.act": "stewardship.fruit",
  "resource.transfer.admit": "verified-title.successor", "resource.material.transfer.admit": "verified-title.successor",
  "resource.material.harvest": "commons.harvest", "construction.site.place": "materials.create",
  "construction.site.contribute": "materials.contribute", "construction.site.work": "materials.create",
  "structure.trail-shelter.build": "materials.create", "structure.trail-bridge.build": "materials.create",
  "structure.steward-workbench.build": "materials.create", "structure.trail-cache.build": "materials.create",
  "tool.steward.craft": "materials.create", "tool.steward.equip": "owner.use", "storage.material.move": "owner.use",
  "story.contribute": "story.participate", "story.trainer_battle": "story.participate", "story.tournament_enter": "story.participate"
} as const satisfies Record<WildsWorldCommand["type"], string>;

type WorldDecisionSource = { before: WildsWorldProjection; command: WildsWorldCommand; authority: WildsWorldAuthority };
type WorldDecisionOutcome = { after?: WildsWorldProjection; events?: readonly WildsWorldEvent[]; failure?: string };

/** One synchronous execution scope: hash the source and command once, never cache mutable world state globally. */
export function createWorldConstitutionalDecisionScope({ before, command, authority }: WorldDecisionSource) {
  const sourceState = constitutionalDigest(before);
  const commandDigest = constitutionalDigest(command);
  const law = Object.hasOwn(WILDS_COMMAND_LAW, command.type) ? WILDS_COMMAND_LAW[command.type] : null;
  const team = "teamId" in command ? before.teams[command.teamId] : undefined;
  const teamRole = team?.members?.find(member => member.playerId === authority.actorId)?.role
    ?? (team?.captainId === authority.actorId ? "captain" : null);
  const teamDigest = command.type === "team.squad.assemble" && team ? constitutionalDigest(team) : null;
  return { commandDigest, decide(input: WorldDecisionOutcome = {}): ConstitutionalDecision {
    const evidence = [sourceState, commandDigest, ...(input.events ?? []).map(event => event.digest)];
    const predicates = [
      predicate("TOB-01/81", "Actor is identified at the admitted execution boundary", Boolean(authority.actorId?.trim()) && authority.canonical, [authority.actorId || "AUTHORITY_UNPROVEN"]),
      predicate("TOB-03/23/74", "This action has a defined bounded transition law", law ? true : null, law ? [law] : []),
      predicate("TOB-05/13/59", "Registered gameplay law creates no ownership of a person or absolute Earth title", law ? true : null, law ? [law] : []),
      predicate("TOB-60/62", "Source state and command are explicitly bound", true, [sourceState, commandDigest])
    ];
    if (command.type === "team.squad.assemble") predicates.push(predicate("TOB-23/54/56", "Squad organizer holds current captain or officer standing", teamRole === "captain" || teamRole === "officer", teamDigest ? [teamDigest] : []));
    if (input.failure) predicates.push(predicate("TOB-81", input.failure, /undefined|unproven|unresolved/.test(input.failure) ? null : false, evidence));
    else predicates.push(predicate("TOB-81/84", "Resource-specific source, permission and successor predicates pass", input.after ? true : null, evidence));
    return deriveConstitutionalDecision({ sourceState, actor: authority.actorId, standing: law ?? "AUTHORITY_UNPROVEN", authority: "source-state-and-resource-law", predicates, successor: input.after ? constitutionalDigest(input.after) : null });
  } };
}
export function worldConstitutionalDecision(input: WorldDecisionSource & WorldDecisionOutcome): ConstitutionalDecision {
  return createWorldConstitutionalDecisionScope(input).decide(input);
}

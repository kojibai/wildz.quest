import type { WildsCityCommand } from "./wilds-city";

export const WILDS_CIVIC_COMMAND_LAW = {
  "city.found": "city.voluntary-improvement-stewardship",
  "city.residency.request": "city.voluntary-residency",
  "city.residency.accept": "city.admitted-applicant",
  "city.residency.leave": "city.voluntary-exit",
  "city.proposal.open": "city.maintenance-priorities",
  "city.proposal.vote": "city.maintenance-priorities",
  "clan.create": "voluntary.associate",
  "clan.join": "voluntary.associate",
  "clan.leave": "voluntary.exit"
} as const satisfies Record<WildsCityCommand["type"], string>;

export function isWildsCivicCommand(command: { type: string }): command is WildsCityCommand {
  return Object.hasOwn(WILDS_CIVIC_COMMAND_LAW, command.type);
}

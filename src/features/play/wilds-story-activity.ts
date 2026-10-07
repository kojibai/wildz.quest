import type { WildsWorldEvent } from "./wilds-world-event";
import type { ConstitutionalDecision } from "./wilds-constitution";
import type { WildsActivityEntry } from "./wallet/wilds-activity-history";
import { describeWildsPoint } from "./wilds-world-geography";
import { wildsSagaFramework } from "./wilds-saga-content";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const words = (value: unknown) => text(value)?.replaceAll("-", " ").replaceAll("_", " ");
const amount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const VERBS: Record<string, string> = { travel: "travel", discover: "discovery", capture: "finding a companion", train: "training", battle: "battle", ecology: "habitat work", raid: "a raid", social: "meeting the keepers", craft: "crafting", tournament: "tournament play" };

function place(value: unknown) {
  const position = record(value);
  if (typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.z !== "number" || !Number.isFinite(position.z)) return "";
  return ` at ${describeWildsPoint({ x: position.x, z: position.z })} · X ${Math.round(position.x)} · Z ${Math.round(position.z)}`;
}

function describeEvent(event: WildsWorldEvent): { title: string; detail: string } | null {
  const payload = record(event.payload);
  const lot = record(payload.lot);
  const structure = record(payload.structure);
  const site = record(payload.site);
  switch (event.kind) {
    case "resource.material_harvested": {
      const material = words(lot.kind);
      const quantity = amount(lot.quantity);
      return material && quantity !== null ? { title: `Gathered ${material}`, detail: `Gathered ${quantity} ${material}${place(record(payload.source).position)}.` } : null;
    }
    case "structure.built":
    case "construction.site_worked": {
      const completed = Boolean(text(structure.blueprint));
      const subject = completed ? structure : site;
      const blueprint = words(subject.blueprint);
      return blueprint ? { title: completed ? "Built a place" : "Construction continued", detail: `${completed ? "Built" : "Worked on"} a ${blueprint}${place(subject.position)}.` } : null;
    }
    case "construction.site_placed":
    case "construction.site_contributed": {
      const blueprint = words(site.blueprint);
      return blueprint ? { title: event.kind === "construction.site_placed" ? "Started a building" : "Contributed building materials", detail: `${event.kind === "construction.site_placed" ? "Started" : "Contributed materials to"} a ${blueprint}${place(site.position)}.` } : null;
    }
    case "tool.crafted": {
      const tool = words(record(payload.tool).kind);
      return tool ? { title: "Crafted a tool", detail: `Crafted a ${tool}.` } : null;
    }
    case "story.chapter_opened": {
      const chapter = wildsSagaFramework().dailyChapters.find(chapter => chapter.id === record(payload.chapter).chapterId);
      return chapter ? { title: "A chapter began", detail: `“${chapter.title}” opened in ${chapter.featuredRegionId}.` } : null;
    }
    case "story.trainer_encountered": {
      // This event seeds the shared day's trainers; it does not prove that
      // the player physically met or battled one of them.
      const trainer = record(payload.trainer);
      const name = text(trainer.name);
      const location = text(trainer.locationId);
      const level = amount(trainer.challengeLevel);
      return name ? { title: "A trainer arrived", detail: `${name} is available${location ? ` at ${location}` : ""}${level !== null ? ` · level ${level}` : ""}.` } : null;
    }
    case "story.objective_contributed": {
      const objective = wildsSagaFramework().dailyChapters.flatMap(chapter => chapter.missions.flatMap(mission => mission.nodes)).find(node => node.id === payload.objectiveId);
      const verb = typeof payload.verb === "string" && Object.hasOwn(VERBS, payload.verb) ? VERBS[payload.verb] : null;
      const quantity = amount(payload.amount);
      return objective && verb && quantity !== null ? { title: "Advanced the chapter", detail: `Advanced “${objective.title}” through ${verb} · ${quantity} contribution${quantity === 1 ? "" : "s"}.` } : null;
    }
    case "story.trainer_battle_settled": {
      const trainer = text(record(payload.trainer).name);
      const xp = amount(payload.xpAward);
      if (!trainer) return null;
      const result = payload.outcome === "player_victory" ? `Won a battle against ${trainer}`
        : payload.outcome === "trainer_victory" ? `${trainer} won your battle`
          : payload.outcome === "fled" ? `Retreated from your battle with ${trainer}`
          : `Your battle with ${trainer} ended${payload.outcome === "draw" ? " in a draw" : ""}`;
      return { title: "Trainer battle remembered", detail: `${result}${xp !== null ? ` · ${xp} XP earned` : ""}.` };
    }
    case "story.achievement_granted": {
      const grant = record(payload.grant);
      const definition = wildsSagaFramework().dailyChapters.flatMap(chapter => chapter.achievements).find(achievement => achievement.id === grant.definitionId);
      return definition ? { title: "Achievement earned", detail: `Earned “${definition.title}”.` } : null;
    }
    case "story.tournament_opened":
    case "story.tournament_entered": {
      const name = text(record(payload.tournament).name);
      return name ? event.kind === "story.tournament_entered" ? { title: "Entered a tournament", detail: `Entered ${name}.` }
        : { title: "A tournament opened", detail: `${name} opened for qualified entrants.` } : null;
    }
    case "ecology.discovered":
    case "ecology.contributed": {
      const name = text(site.name);
      const quantity = amount(payload.amount);
      return name ? { title: event.kind === "ecology.discovered" ? "Discovered a habitat" : "Helped a habitat", detail: `${event.kind === "ecology.discovered" ? "Discovered" : "Contributed to"} ${name}${place(site.position)}${event.kind === "ecology.contributed" && quantity !== null ? ` · ${quantity} contributions` : ""}.` } : null;
    }
    default: return null;
  }
}

export function projectWildsStoryActivity(event: WildsWorldEvent, constitution?: ConstitutionalDecision): WildsActivityEntry {
  const description = describeEvent(event) ?? { title: event.kind.replaceAll(".", " ").replaceAll("_", " "), detail: "No additional action detail was recorded." };
  return { id: event.eventId, kind: "activity", ...description, uPulse: event.uPulse, authority: "world", constitution };
}

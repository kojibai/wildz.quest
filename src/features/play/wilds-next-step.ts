export type WildsNextStepAction = "scan" | "gather-timber" | "gather-stone" | "shelter" | "workbench" | "cache" | "explore";

export type WildsNextStep = Readonly<{
  title: string;
  reason: string;
  actionLabel: string;
  action: WildsNextStepAction;
}>;

export type WildsNextStepInput = Readonly<{
  hasCompanion: boolean;
  timber: number;
  stone: number;
  hasShelter: boolean;
  hasWorkbench: boolean;
  hasCache: boolean;
}>;

/** Guidance only: construction and harvesting still validate their actual authority. */
export function projectWildsNextStep(input: WildsNextStepInput): WildsNextStep {
  if (!input.hasCompanion) return {
    title: "Meet your first companion",
    reason: "Scan the wilds, follow a creature's signal, and invite it to travel with you.",
    actionLabel: "Scan for a companion",
    action: "scan"
  };
  const project = !input.hasShelter
    ? { title: "Make a place to return to", name: "trail shelter", timber: 2, stone: 1, action: "shelter" as const,
      reason: "A trail shelter gives your journey a home and a place to rest together." }
    : !input.hasWorkbench
      ? { title: "Give your home a purpose", name: "workbench", timber: 3, stone: 2, action: "workbench" as const,
        reason: "A workbench supports crafting for the next expedition." }
      : !input.hasCache
        ? { title: "Prepare for a longer journey", name: "material cache", timber: 2, stone: 2, action: "cache" as const,
          reason: "A cache gives your materials a place at home between expeditions." }
        : null;
  if (!project) return {
    title: "Follow an unfamiliar trail",
    reason: "Your home is ready. Look for a place you have not visited and discover it with your companion.",
    actionLabel: "Find a new discovery",
    action: "explore"
  };
  const available = (quantity: number) => Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const missingTimber = Math.max(0, project.timber - available(input.timber));
  const missingStone = Math.max(0, project.stone - available(input.stone));
  if (missingTimber || missingStone) {
    const needs = [missingTimber ? `${missingTimber} timber` : "", missingStone ? `${missingStone} stone` : ""].filter(Boolean).join(" and ");
    return {
      title: project.title,
      reason: `${project.reason} Gather ${needs} for your ${project.name}.`,
      actionLabel: missingTimber ? "Find timber" : "Find stone",
      action: missingTimber ? "gather-timber" : "gather-stone"
    };
  }
  return { title: project.title, reason: `${project.reason} You have the materials ready.`, actionLabel: `Build ${project.name}`, action: project.action };
}

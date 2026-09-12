import { nearbyWildsConstruction, constructionGeometryForCollections } from "./wilds-construction-neighborhood";
import { constructionProofDigest } from "./wilds-construction-project";
import { createWildsKaiWeatherSample, writeWildsKaiWeather } from "./wilds-kai-wind";
import type { WildsWorldProjection } from "./wilds-world-state";

/** Maintenance is settled on world ticks or explicit inspection, never in a frame.
 * At most 24 closed ten-minute windows are evaluated after an absence. */
export const WILDS_WEATHER_WINDOW = 120_000_000;
export type WildsConstructionCondition = Readonly<{
  componentId: string; componentHead: string; integrity: number; throughWindow: number;
  kaiUPulse: number; parentHead: string | null; priorHeads: readonly string[]; head: string;
}>;
type World = Pick<WildsWorldProjection, "constructionComponents" | "constructionMaterialContributions" | "constructionWorkContributions" | "constructionConditions">;
export function projectWildsConstructionWeather(world: World, id: string, kaiUPulse: number): WildsConstructionCondition | null {
  if (!Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0) throw new Error("wilds_construction_weather_kai_invalid");
  const component = world.constructionComponents[id];
  if (!component || kaiUPulse < component.kaiUPulse) throw new Error("wilds_construction_weather_component_invalid");
  const prior = world.constructionConditions?.[id];
  if (prior && kaiUPulse < prior.kaiUPulse) throw new Error("wilds_construction_weather_order_invalid");
  const throughWindow = Math.floor(kaiUPulse / WILDS_WEATHER_WINDOW) - 1;
  const firstWindow = Math.floor(component.kaiUPulse / WILDS_WEATHER_WINDOW) + 1;
  const start = Math.max(firstWindow, (prior?.throughWindow ?? firstWindow - 1) + 1, throughWindow - 23);
  if (start > throughWindow) return null;
  const geometry = constructionGeometryForCollections(world.constructionMaterialContributions, world.constructionWorkContributions);
  const progress = geometry(component);
  let integrity = prior?.integrity ?? 100;
  // Plans are not buildings; enclosed underground pieces do not receive outdoor weather.
  if (progress.stage !== "planned" && (component.evidence.spaceId ?? "wildz.space.outer.v1") === "wildz.space.outer.v1") {
    const weather = createWildsKaiWeatherSample();
    const stone = component.recipe.stages.reduce((sum, stage) => sum + stage.materials.stone, 0);
    const timber = component.recipe.stages.reduce((sum, stage) => sum + stage.materials.timber, 0);
    let protection = 1;
    if (component.kind !== "roof") {
      const position = component.transform.position;
      const neighbors = nearbyWildsConstruction(world.constructionComponents, position, 8);
      for (const roof of neighbors) {
        if (roof.kind !== "roof" || (world.constructionConditions?.[roof.componentId]?.integrity ?? 100) < 50
          || (roof.evidence.spaceId ?? "wildz.space.outer.v1") !== (component.evidence.spaceId ?? "wildz.space.outer.v1")) continue;
        const box = roof.placement.geometry;
        if (Math.abs(box.center.x - position.x) <= box.halfExtents.x && Math.abs(box.center.z - position.z) <= box.halfExtents.z
          && box.center.y > position.y && box.center.y - position.y < 8 && ["functional", "finished"].includes(geometry(roof).stage)) { protection = .2; break; }
      }
    }
    const resistance = (stone > timber ? .55 : 1) * protection;
    for (let window = start; window <= throughWindow; window++) {
      writeWildsKaiWeather(weather, window * WILDS_WEATHER_WINDOW + WILDS_WEATHER_WINDOW / 2, component.transform.position.x, component.transform.position.z);
      if (weather.storm) integrity -= Math.max(1, Math.round((2 + weather.precipitation * 3) * resistance));
    }
  }
  const basis = { componentId: id, componentHead: component.head, integrity: Math.max(25, integrity), throughWindow, kaiUPulse, parentHead: prior?.head ?? null, priorHeads: prior ? [...prior.priorHeads, prior.head].slice(-64) : [] };
  return { ...basis, head: constructionProofDigest(basis) };
}
export function repairWildsConstructionCondition(current: WildsConstructionCondition, kaiUPulse: number): WildsConstructionCondition {
  if (current.integrity >= 100 || kaiUPulse < current.kaiUPulse) throw new Error("wilds_construction_repair_unneeded");
  const basis = { ...current, integrity: Math.min(100, current.integrity + 25), kaiUPulse, parentHead: current.head, priorHeads: [...current.priorHeads, current.head].slice(-64) };
  const content = { componentId: basis.componentId, componentHead: basis.componentHead, integrity: basis.integrity, throughWindow: basis.throughWindow, kaiUPulse: basis.kaiUPulse, parentHead: basis.parentHead, priorHeads: basis.priorHeads };
  return { ...content, head: constructionProofDigest(content) };
}

export type WildsMaintenanceCommand = {
  type: "construction.component.maintain"; componentId: string; componentHead: string;
  conditionHead: string | null; actorPosition: { x: number; z: number }; lotId?: string; commandId: string;
};
export function resolveWildsMaintenance(world: WildsWorldProjection, command: WildsMaintenanceCommand, actor: string, kaiUPulse: number) {
  const component = world.constructionComponents[command.componentId];
  if (!component || component.head !== command.componentHead) throw new Error("wilds_construction_component_stale");
  if (component.ownerReceizId !== actor) throw new Error("wilds_construction_access_denied");
  if (!Number.isFinite(command.actorPosition.x) || !Number.isFinite(command.actorPosition.z)
    || Math.hypot(command.actorPosition.x - component.transform.position.x, command.actorPosition.z - component.transform.position.z) > 6) throw new Error("wilds_construction_unreachable");
  const prior = world.constructionConditions?.[component.componentId];
  if ((prior?.head ?? null) !== command.conditionHead) throw new Error("wilds_construction_condition_stale");
  const weather = projectWildsConstructionWeather(world, component.componentId, kaiUPulse);
  if (!command.lotId) return weather;
  let condition = weather ?? prior;
  if (command.lotId) {
    const lot = world.materialLots[command.lotId];
    if (!lot || !["timber", "stone"].includes(lot.kind)
      || (world.materialCustody?.[lot.lotId]?.ownerReceizId ?? lot.ownerReceizId) !== actor
      || world.consumedMaterialLots[lot.lotId] || world.reservedMaterialLots[lot.lotId] || world.storedMaterialLots[lot.lotId]) throw new Error("wilds_construction_repair_lot_unavailable");
    if (!condition) throw new Error("wilds_construction_repair_unneeded");
    const repaired = repairWildsConstructionCondition(condition, kaiUPulse);
    const content = { componentId: repaired.componentId, componentHead: repaired.componentHead, integrity: repaired.integrity, throughWindow: repaired.throughWindow, kaiUPulse, parentHead: prior?.head ?? null, priorHeads: prior ? [...prior.priorHeads, prior.head].slice(-64) : [] };
    condition = { ...content, head: constructionProofDigest(content) };
  }
  return condition ?? null;
}

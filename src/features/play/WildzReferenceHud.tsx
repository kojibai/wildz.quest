"use client";

import type { WildzHudModel } from "./wildz-gameplay-hud";
import { WildzMinimap } from "./WildzMinimap";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import type { PortableCardAsset } from "./portable-card";
import type { AdventureCardCondition } from "./adventure/card-condition";

export function WildzReferenceHud({ model, heading, activeCard, condition, onOpenMap, onOpenMission }: {
  model: WildzHudModel;
  heading: number;
  activeCard: PortableCardAsset;
  condition?: AdventureCardCondition;
  onOpenMap: () => void;
  onOpenMission: () => void;
}) {
  const vitality = condition?.life === "dead" ? 0 : Math.max(1, 100 - (condition?.fatigue ?? 0));
  return <div className="wildz-reference-hud">
    <div className="wildz-identity-home">
      <section className="wildz-companion-capsule" aria-label={`${activeCard.manifest.name}, ${vitality}% vitality`}>
        <WildsCreatureThumbnail asset={activeCard} />
        <div>
          <small>{activeCard.manifest.name} · Lv. {model.companion.level}</small>
          <strong>{model.player.displayName || model.player.username}<i>✓</i></strong>
          <span className="wildz-companion-vitality"><i style={{ width: `${vitality}%` }} /><b>{vitality}%</b></span>
        </div>
      </section>
    </div>
    <div className="wildz-mission-home">
      <button className="wildz-mission-chip" aria-label={`Open mission details · ${model.mission.progress}% progress`} onClick={onOpenMission} type="button"><span>★</span><strong>{model.mission.progress}%<small>Mission</small></strong></button>
    </div>
    <div className="wildz-map-home">
      <WildzMinimap x={model.location.x} z={model.location.z} heading={heading} onOpen={onOpenMap} />
    </div>
  </div>;
}

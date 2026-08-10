"use client";

import type { CSSProperties } from "react";
import type { WildzCharacterGenesis } from "../identity/wildz-genesis";
import { projectWildsExplorerAppearance } from "./wilds-explorer-appearance";
import type { WildzHudModel } from "./wildz-gameplay-hud";
import { WildzMinimap } from "./WildzMinimap";

export function WildzReferenceHud({ model, heading, character, onOpenMap, onOpenMission }: {
  model: WildzHudModel;
  heading: number;
  character: WildzCharacterGenesis;
  onOpenMap: () => void;
  onOpenMission: () => void;
}) {
  const appearance = projectWildsExplorerAppearance(character);
  const explorerName = model.player.displayName || model.player.username;
  return <div className="wildz-reference-hud">
    <div className="wildz-identity-home">
      <section className="wildz-explorer-capsule" aria-label={`${explorerName}, explorer level ${model.player.level}, ${model.energy.current}% energy`} data-explorer-proof={character.digest.slice(0, 16)}>
        <div
          aria-hidden="true"
          className="wildz-explorer-portrait"
          data-accessory={appearance.accessory}
          data-hair={appearance.hairProfile}
          data-outfit={appearance.outfitProfile}
          data-signature={appearance.signatureMark}
          style={{
            "--wildz-explorer-hair": appearance.hair,
            "--wildz-explorer-outfit": appearance.outfitPrimary,
            "--wildz-explorer-outfit-secondary": appearance.outfitSecondary,
            "--wildz-explorer-skin": appearance.skin
          } as CSSProperties}
        >
          <span className="wildz-explorer-portrait-head"><i /></span>
          <span className="wildz-explorer-portrait-body" />
          <b className="wildz-explorer-portrait-signature" />
        </div>
        <div>
          <small>Explorer · Lv. {model.player.level}</small>
          <strong>{explorerName}<i>✓</i></strong>
          <span aria-label={`Explorer energy ${model.energy.current}%`} aria-valuemax={model.energy.maximum} aria-valuemin={0} aria-valuenow={model.energy.current} className="wildz-explorer-energy" role="progressbar"><i style={{ width: `${model.energy.current}%` }} /><b>{model.energy.current}%</b></span>
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

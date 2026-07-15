"use client";

import Image from "next/image";
import type { WildzHudModel } from "./wildz-gameplay-hud";
import { WildzMinimap } from "./WildzMinimap";

export function WildzReferenceHud({ model, heading, onOpenMission }: {
  model: WildzHudModel;
  heading: number;
  onOpenMission: () => void;
}) {
  return <div className="wildz-reference-hud">
    <section className="wildz-player-capsule" aria-label="Player and active companion">
      <span className="wildz-player-emblem"><Image src="/brand/wildz-mark.svg" alt="" width={58} height={58} /></span>
      <div>
        <strong>{model.player.displayName || model.player.username}<i>✓</i></strong>
        <span><b className="wildz-sealcub-orb">S</b><em><i style={{ width: `${Math.min(100, model.companion.bond)}%` }} /></em></span>
        <small>Lv. {model.player.level} · {model.companion.name} L{model.companion.level}</small>
      </div>
    </section>
    <section className="wildz-status-rail" aria-label="Player status">
      <div className="wildz-energy-meter"><span>ϟ</span><strong>{model.energy.current}<small>/ {model.energy.maximum}</small></strong><b>+</b></div>
      <div className="wildz-xp-meter"><span>XP</span><strong>{model.xp.progress}%</strong><i><b style={{ width: `${model.xp.progress}%` }} /></i></div>
    </section>
    <button className="wildz-mission-chip" aria-label={`Open mission details · ${model.mission.progress}% progress`} onClick={onOpenMission} type="button"><span>★</span><strong>{model.mission.progress}%<small>Mission</small></strong></button>
    <WildzMinimap x={model.location.x} z={model.location.z} heading={heading} />
  </div>;
}

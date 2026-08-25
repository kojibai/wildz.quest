"use client";

import { useMemo, useState } from "react";
import type { useWildsWorld } from "./use-wilds-world";
import { wildsLivingWorldModeLabel } from "./wilds-living-world-status";

type LivingWorldDetail =
  | { kind: "status" }
  | { kind: "boss"; siteId: string }
  | { kind: "ecology"; siteId: string };

export function WildsLivingWorldHud({ world, player, connected, onEnterRaid }: {
  world: ReturnType<typeof useWildsWorld>;
  player: { x: number; z: number };
  connected: boolean;
  onEnterRaid: (bossId: string) => void;
}) {
  const [detail, setDetail] = useState<LivingWorldDetail | null>(null);
  const [teamName, setTeamName] = useState("");
  const nearby = useMemo(() => Object.values(world.snapshot?.sites ?? {})
    .map((site) => ({ site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null, [player.x, player.z, world.snapshot?.sites]);
  const nearbyEcology = useMemo(() => Object.values(world.snapshot?.ecologySites ?? {})
    .filter((site) => site.phase !== "historical" && site.phase !== "expired")
    .map((site) => ({ site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null, [player.x, player.z, world.snapshot?.ecologySites]);
  const selectedSite = detail?.kind === "boss" ? world.snapshot?.sites[detail.siteId] ?? null : null;
  const selectedBoss = selectedSite?.bossId ? world.snapshot?.bosses[selectedSite.bossId] ?? null : null;
  const selectedRaid = selectedBoss ? Object.values(world.snapshot?.raids ?? {}).find((item) => item.bossId === selectedBoss.id && item.phase !== "expired") ?? null : null;
  const selectedEcology = detail?.kind === "ecology" ? world.snapshot?.ecologySites[detail.siteId] ?? null : null;
  const selectedSiteDistance = selectedSite ? Math.hypot(selectedSite.position.x - player.x, selectedSite.position.z - player.z) : 0;
  const selectedEcologyDistance = selectedEcology ? Math.hypot(selectedEcology.position.x - player.x, selectedEcology.position.z - player.z) : 0;
  const closeToBoss = Boolean(selectedSite && selectedSiteDistance <= selectedSite.radius + 8);
  const modeLabel = wildsLivingWorldModeLabel(world.mode, connected);
  const worldDetail = connected && world.mode === "receiz_recovery_pending"
    ? "Connected globally · your latest admitted world change is propagating."
    : world.error;
  const activeChapter = world.snapshot?.story.activeChapter;
  const compactSiteName = nearby?.site.name.split(/\s+/).at(-1) ?? "Event";
  const bossHealthPercent = selectedBoss ? Math.max(0, Math.min(100, selectedBoss.health / selectedBoss.maxHealth * 100)) : 0;

  return <div className={`wilds-living-world-hud ${nearby || nearbyEcology ? "has-event" : ""}`} aria-label="Living world status">
    <button aria-label={modeLabel} className={`wilds-live-pill mode-${connected ? "receiz_live" : world.mode}`} onClick={() => setDetail((current) => current?.kind === "status" ? null : { kind: "status" })} title={modeLabel} type="button">
      <i aria-hidden="true" /><span>{modeLabel}</span>
    </button>
    {nearby ? <button aria-label={`${nearby.site.name} ${Math.round(nearby.distance)} meters away`} className="wilds-live-pill event" onClick={() => setDetail({ kind: "boss", siteId: nearby.site.id })} type="button">
      <span className="wilds-live-event-full">{nearby.site.phase === "memorialized" ? "Victory memorial" : nearby.site.name}</span>
      <span className="wilds-live-event-compact" aria-hidden="true">{nearby.site.phase === "memorialized" ? "Memorial" : compactSiteName}</span>
      <b>{Math.round(nearby.distance)}m</b>
    </button> : null}
    {nearbyEcology ? <button aria-label={`${nearbyEcology.site.name} ecology signal ${Math.round(nearbyEcology.distance)} meters away`} className="wilds-live-pill event ecology" onClick={() => setDetail({ kind: "ecology", siteId: nearbyEcology.site.id })} type="button"><span className="wilds-live-event-full">{nearbyEcology.site.name}</span><span className="wilds-live-event-compact" aria-hidden="true">Ecology</span><b>{Math.round(nearbyEcology.distance)}m</b></button> : null}
    {detail ? <section className="wilds-living-world-sheet" aria-label={`${detail.kind} details`}>
      <button aria-label="Close shared world details" className="wilds-living-world-close" onClick={() => setDetail(null)} type="button">×</button>
      {detail.kind === "status" ? <>
        <small>{modeLabel} · shared world status</small>
        {activeChapter ? <p><strong>Living chapter</strong> · {activeChapter.chapterId}</p> : <p>The next Kai chapter is being admitted.</p>}
        <strong>The living world is listening</strong>
        {world.snapshot?.league.standings.length ? <p>Genesis League · {world.snapshot.league.standings[0]?.score ?? 0} leading points</p> : <p>No league team has scored yet. Teams are optional; solo exploration and boss fights stay available.</p>}
        <form onSubmit={(event) => { event.preventDefault(); if (teamName.trim()) void world.createTeam(teamName.trim()).then(() => setTeamName("")); }}>
          <input aria-label="New team name" maxLength={32} onChange={(event) => setTeamName(event.target.value)} placeholder="Optional team name" value={teamName} />
          <button disabled={!teamName.trim() || Boolean(world.pendingCommand)} type="submit">Create</button>
        </form>
      </> : null}
      {detail.kind === "boss" ? selectedBoss ? <>
        <small>World boss · {String(selectedBoss.familyId ?? "unknown").replaceAll("-", " ")}</small>
        <strong>{String(selectedBoss.name ?? selectedSite?.name ?? "World boss")}</strong>
        <p>{String(selectedBoss.phase).replaceAll("_", " ")} · {Math.round(selectedSiteDistance)}m away · team not required</p>
        <div aria-label={`Health remaining ${Math.round(bossHealthPercent)} percent`} className="wilds-live-boss-meter" role="progressbar" aria-valuemin={0} aria-valuemax={selectedBoss.maxHealth} aria-valuenow={selectedBoss.health}><span style={{ width: `${bossHealthPercent}%` }} /><b>Health remaining · {Math.ceil(selectedBoss.health).toLocaleString()} / {selectedBoss.maxHealth.toLocaleString()}</b></div>
        {selectedBoss.phase === "defeated" || selectedRaid?.phase === "settled" ? <p>This boss is defeated. Its successor will appear through the living-world cycle.</p> : closeToBoss && selectedRaid ? <button disabled={Boolean(world.pendingCommand)} onClick={() => { setDetail(null); onEnterRaid(selectedBoss.id); }} type="button">Fight solo</button> : <p>Move within {Math.ceil((selectedSite?.radius ?? 0) + 8)}m of this boss to fight.</p>}
      </> : <p>This world event is no longer active.</p> : null}
      {detail.kind === "ecology" ? selectedEcology ? <>
        <small>Ecology signal · {selectedEcology.familyId.replaceAll("-", " ")}</small>
        <strong>{selectedEcology.name}</strong>
        <p>{selectedEcology.phase.replaceAll("_", " ")} · {Math.round(selectedEcologyDistance)}m away</p>
        <p>{selectedEcology.participantIds.length} verified participant{selectedEcology.participantIds.length === 1 ? "" : "s"} · {selectedEcology.contributionTotal.toLocaleString()} total contribution</p>
      </> : <p>This ecology signal is no longer active.</p> : null}
      {worldDetail ? <em role="status">{worldDetail}</em> : null}
    </section> : null}
  </div>;
}

"use client";

import { useMemo, useState } from "react";
import type { useWildsWorld } from "./use-wilds-world";

export function WildsLivingWorldHud({ world, player }: { world: ReturnType<typeof useWildsWorld>; player: { x: number; z: number } }) {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const nearby = useMemo(() => Object.values(world.snapshot?.sites ?? {})
    .map((site) => ({ site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null, [player.x, player.z, world.snapshot?.sites]);
  const nearbyEcology = useMemo(() => Object.values(world.snapshot?.ecologySites ?? {})
    .filter((site) => site.phase !== "historical" && site.phase !== "expired")
    .map((site) => ({ site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null, [player.x, player.z, world.snapshot?.ecologySites]);
  const boss = nearby?.site.bossId ? world.snapshot?.bosses[nearby.site.bossId] : null;
  const raid = boss ? Object.values(world.snapshot?.raids ?? {}).find((item) => item.bossId === boss.id) : null;
  const close = nearby && nearby.distance <= nearby.site.radius + 8;
  const modeLabel = world.mode === "receiz_live" ? "One shared world" : world.mode === "local_practice" ? "Local practice" : "World reconnecting";

  const compactSiteName = nearby?.site.name.split(/\s+/).at(-1) ?? "Event";

  return <div className={`wilds-living-world-hud ${nearby ? "has-event" : ""}`} aria-label="Living world status">
    <button aria-label={modeLabel} className={`wilds-live-pill mode-${world.mode}`} onClick={() => setOpen((value) => !value)} title={modeLabel} type="button">
      <i aria-hidden="true" /><span>{modeLabel}</span>
    </button>
    {nearby ? <button aria-label={`${nearby.site.name} ${Math.round(nearby.distance)} meters away`} className="wilds-live-pill event" onClick={() => setOpen(true)} type="button">
      <span className="wilds-live-event-full">{nearby.site.phase === "memorialized" ? "Victory memorial" : nearby.site.name}</span>
      <span className="wilds-live-event-compact" aria-hidden="true">{nearby.site.phase === "memorialized" ? "Memorial" : compactSiteName}</span>
      <b>{Math.round(nearby.distance)}m</b>
    </button> : null}
    {nearbyEcology && (!nearby || nearbyEcology.distance < nearby.distance) ? <button aria-label={`${nearbyEcology.site.name} ecology signal ${Math.round(nearbyEcology.distance)} meters away`} className="wilds-live-pill event ecology" onClick={() => setOpen(true)} type="button"><span className="wilds-live-event-full">{nearbyEcology.site.name}</span><span className="wilds-live-event-compact" aria-hidden="true">Ecology</span><b>{Math.round(nearbyEcology.distance)}m</b></button> : null}
    {open ? <section className="wilds-living-world-sheet" aria-label="Shared world event details">
      <button aria-label="Close shared world details" className="wilds-living-world-close" onClick={() => setOpen(false)} type="button">×</button>
      <small>{modeLabel} · shared world status</small>
      <strong>{boss?.phase === "defeated" ? `${boss.id} defeated for everyone` : boss ? "A shared boss has emerged" : "The living world is listening"}</strong>
      {nearbyEcology ? <p>{nearbyEcology.site.name} · {nearbyEcology.site.phase} · {Math.round(nearbyEcology.distance)}m from you</p> : null}
      {boss ? <div className="wilds-live-boss-meter"><span style={{ width: `${Math.max(0, Math.min(100, boss.health / boss.maxHealth * 100))}%` }} /><b>{Math.ceil(boss.health / boss.maxHealth * 100)}%</b></div> : null}
      {boss && raid && close && raid.phase !== "settled" ? <button disabled={Boolean(world.pendingCommand)} onClick={() => void world.joinRaid(boss.id)} type="button">Join shared raid</button> : null}
      {world.snapshot?.league.standings.length ? <p>Genesis League · {world.snapshot.league.standings[0]?.score ?? 0} leading points</p> : <p>Form a team and write the first Genesis League chapter.</p>}
      <form onSubmit={(event) => { event.preventDefault(); if (teamName.trim()) void world.createTeam(teamName.trim()).then(() => setTeamName("")); }}>
        <input aria-label="New team name" maxLength={32} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" value={teamName} />
        <button disabled={!teamName.trim() || Boolean(world.pendingCommand)} type="submit">Create</button>
      </form>
      {world.error ? <em role="status">{world.error}</em> : null}
    </section> : null}
  </div>;
}

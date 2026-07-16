"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { createWildsCivicEvent, type WildsCivicEvent, type WildsCivicProjection } from "./wilds-civic-history";
import type { WildsPresence } from "./multiplayer-core";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { applyWildsRouteIntent, createWildsRouteMemory, type WildsRouteDirection } from "./wilds-route-memory";
import { WAYFINDER_HOLLOW, type WildsSettlementDistrictId } from "./wilds-settlements";
import type { WildsSettlementWorldMode } from "./WildsSettlementEnvironment";
import type { WildsWorldProjection } from "./wilds-world-state";
import { settlementAudioCue, type WildsAudioCue } from "./wilds-audio";

const districtIcons = {
  "trail-gate": Icons.walk,
  "dawn-commons": Icons.users,
  "mosslight-atelier": Icons.sparkle,
  "cartographer-house": Icons.globe,
  "monument-walk": Icons.trophy
} as const;

export function WildsSettlementExperience({
  actorId,
  card,
  civic,
  livingWorld,
  onCivicEvent,
  onExit,
  onAudioCue,
  open,
  remotePlayers,
  worldMode
}: {
  actorId: string;
  card: PortableCardAsset | null;
  civic: WildsCivicProjection;
  livingWorld?: WildsWorldProjection | null;
  onCivicEvent: (event: WildsCivicEvent) => void;
  onExit: () => void;
  onAudioCue: (cue: WildsAudioCue) => void;
  open: boolean;
  remotePlayers: WildsPresence[];
  worldMode: WildsSettlementWorldMode;
}) {
  const [districtId, setDistrictId] = useState<WildsSettlementDistrictId>("trail-gate");
  const [route, setRoute] = useState(() => createWildsRouteMemory(`wayfinder:${actorId}`));
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const routePhase = useRef(route.phase);
  routePhase.current = route.phase;
  const verifiedCard = Boolean(card && verifyAnyWildsCard(card).ok);
  const district = WAYFINDER_HOLLOW.districts.find((item) => item.id === districtId)!;

  useEffect(() => setRoute(createWildsRouteMemory(`wayfinder:${actorId}`)), [actorId]);

  const requestExit = useCallback(() => {
    if (routePhase.current === "active" && !window.confirm("Leave the active route memory? Your current route will reset.")) return;
    onExit();
  }, [onExit]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialog.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocus.current?.focus();
    };
  }, [open, requestExit]);

  const emit = useCallback((kind: WildsCivicEvent["kind"], sourceId: string, reputation: number, cardProofDigest: string | null = null) => {
    if (civic.completedSourceIds.includes(sourceId)) return;
    onCivicEvent(createWildsCivicEvent({
      settlementId: "wayfinder-hollow",
      actorId,
      kind,
      sourceId,
      occurredAt: new Date().toISOString(),
      cardProofDigest,
      reputation
    }));
    if (kind !== "puzzle.completed") onAudioCue(settlementAudioCue("service"));
  }, [actorId, civic.completedSourceIds, onAudioCue, onCivicEvent]);

  const routeInput = useCallback((direction: WildsRouteDirection | "begin") => {
    const next = applyWildsRouteIntent(route, direction);
    setRoute(next);
    onAudioCue(settlementAudioCue(next.phase === "complete" ? "route-complete" : "route-step"));
    if (route.phase !== "complete" && next.phase === "complete") emit("puzzle.completed", `route-memory:${next.id}`, 5);
  }, [emit, onAudioCue, route]);

  const panel = districtId === "trail-gate" ? <TrailGate civic={civic} emit={emit} />
    : districtId === "dawn-commons" ? <DawnCommons remotePlayers={remotePlayers} worldMode={worldMode} />
      : districtId === "mosslight-atelier" ? <MosslightAtelier card={card} civic={civic} emit={emit} verifiedCard={verifiedCard} />
        : districtId === "cartographer-house" ? <CartographerHouse onInput={routeInput} route={route} />
          : <MonumentWalk civic={civic} emit={emit} livingWorld={livingWorld} worldMode={worldMode} />;

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <section aria-labelledby="wilds-settlement-title" aria-modal="true" className="wilds-settlement-experience" ref={dialog} role="dialog" tabIndex={-1}>
      <header className="wilds-settlement-header">
        <div><span>Permanent settlement · {civic.rank}</span><h2 id="wilds-settlement-title">Wayfinder Hollow</h2></div>
        <div className="wilds-settlement-reputation" aria-label={`${civic.reputation} settlement reputation`}><strong>{civic.reputation}</strong><small>REP</small></div>
        <button aria-label="Return to world" className="wilds-settlement-close" onClick={requestExit} type="button"><Icons.close aria-hidden="true" size={21} /></button>
      </header>

      <nav aria-label="Wayfinder Hollow districts" className="wilds-settlement-districts">
        {WAYFINDER_HOLLOW.districts.map((item) => {
          const Icon = districtIcons[item.id];
          return <button aria-current={districtId === item.id ? "page" : undefined} key={item.id} onClick={() => setDistrictId(item.id)} type="button"><Icon aria-hidden="true" size={17} /><span>{item.name}</span></button>;
        })}
      </nav>

      <main className="wilds-settlement-panel" tabIndex={0}>
        <div className="wilds-settlement-panel-heading"><span>{district.purpose}</span><h3>{district.name}</h3></div>
        {panel}
      </main>

      <footer className="wilds-settlement-footer">
        <span aria-live="polite">{civic.events.at(-1) ? `Wayfinder memory sealed · ${civic.reputation} reputation` : "Every choice here becomes part of your portable player history."}</span>
        <button onClick={requestExit} type="button"><Icons.walk aria-hidden="true" size={18} /> Return to world</button>
      </footer>
    </section>,
    document.body
  );
}

function TrailGate({ civic, emit }: { civic: WildsCivicProjection; emit: (kind: WildsCivicEvent["kind"], sourceId: string, reputation: number, digest?: string | null) => void }) {
  const met = civic.completedSourceIds.includes("resident:mira-vale");
  const oriented = civic.completedSourceIds.includes("orientation");
  return <div className="wilds-settlement-resident-layout">
    <Resident crest="MV" name="Mira Vale" title="First Wayfinder" />
    <div className="wilds-settlement-dialogue"><p>“A world becomes home when you can find your way back. Let me show you how the Hollow connects to every trail.”</p><div className="wilds-settlement-actions"><button disabled={met} onClick={() => emit("resident.met", "resident:mira-vale", 2)} type="button">{met ? "Mira remembers you" : "Meet Mira"}</button><button disabled={oriented} onClick={() => emit("service.completed", "orientation", 5)} type="button">{oriented ? "Orientation complete" : "Begin orientation"}</button></div></div>
  </div>;
}

function DawnCommons({ remotePlayers, worldMode }: { remotePlayers: WildsPresence[]; worldMode: WildsSettlementWorldMode }) {
  return <div className="wilds-commons-view"><div className={`wilds-settlement-mode ${worldMode}`}><span />{worldMode === "receiz_live" ? "Live shared commons" : worldMode === "local_practice" ? "Practice commons" : "Connecting to the commons"}</div><h4>Dawn Commons</h4><p>The same public square is open to every explorer. Players shown here occupy their actual nearby world position.</p><div className="wilds-commons-roster">{remotePlayers.length ? remotePlayers.slice(0, 12).map((player) => <div key={player.playerId}><span>{player.handle.slice(0, 2).toUpperCase()}</span><strong>{player.handle}</strong><small>{player.status} · {player.activeCard.name}</small></div>) : <div className="is-empty"><Icons.users aria-hidden="true" size={24} /><strong>The square is quiet</strong><small>Nearby explorers will appear here live.</small></div>}</div></div>;
}

function MosslightAtelier({ card, civic, emit, verifiedCard }: { card: PortableCardAsset | null; civic: WildsCivicProjection; emit: (kind: WildsCivicEvent["kind"], sourceId: string, reputation: number, digest?: string | null) => void; verifiedCard: boolean }) {
  const met = civic.completedSourceIds.includes("resident:oren-moss");
  const sourceId = card ? `card-attunement:${card.id}` : "card-attunement:none";
  const attuned = civic.completedSourceIds.includes(sourceId);
  return <div className="wilds-settlement-resident-layout">
    <Resident crest="OM" name="Oren Moss" title="Cardwright" />
    <div className="wilds-settlement-dialogue"><p>“A companion’s proof is already alive. Attunement does not rewrite it—it remembers where the two of you stood together.”</p>{card ? <div className="wilds-attunement-card"><span style={{ background: card.manifest.variant.traits.palette.primary }}>{card.manifest.name.slice(0, 2).toUpperCase()}</span><div><strong>{card.manifest.name}</strong><small>{verifiedCard ? "Offline proof verified" : "Proof verification failed"}</small><code>{card.proof.digest.slice(7, 23)}</code></div></div> : <div className="wilds-attunement-empty">Choose a verified active card before visiting the atelier.</div>}<div className="wilds-settlement-actions"><button disabled={met} onClick={() => emit("resident.met", "resident:oren-moss", 2)} type="button">{met ? "Oren remembers you" : "Meet Oren"}</button><button disabled={!verifiedCard || attuned || !card} onClick={() => card && emit("service.completed", sourceId, 5, card.proof.digest)} type="button">{attuned ? "Companion attuned" : "Attune verified card"}</button></div></div>
  </div>;
}

function CartographerHouse({ onInput, route }: { onInput: (direction: WildsRouteDirection | "begin") => void; route: ReturnType<typeof createWildsRouteMemory> }) {
  const names = { north: "North", east: "East", south: "South", west: "West" } as const;
  return <div className="wilds-route-memory"><div className="wilds-route-orbit" aria-hidden="true"><span>N</span><span>E</span><span>S</span><span>W</span><i /></div><div><span>Route memory · {route.phase}</span><h4>{route.phase === "briefing" ? "Read the three-point trail" : route.phase === "complete" ? "The route is yours" : `${route.step} of ${route.sequence.length} remembered`}</h4><p>{route.phase === "briefing" ? `Remember: ${route.sequence.map((item) => names[item]).join(" · ")}` : route.phase === "complete" ? "This route has been sealed into your civic history." : `Choose the next direction. Mistakes ${route.mistakes}/3.`}</p>{route.phase === "briefing" ? <button className="wilds-route-begin" onClick={() => onInput("begin")} type="button">Begin route</button> : <div className="wilds-route-controls">{(["north", "west", "east", "south"] as const).map((direction) => <button disabled={route.phase === "complete"} key={direction} onClick={() => onInput(direction)} type="button">{names[direction]}</button>)}</div>}</div></div>;
}

function MonumentWalk({ civic, emit, livingWorld, worldMode }: { civic: WildsCivicProjection; emit: (kind: WildsCivicEvent["kind"], sourceId: string, reputation: number, digest?: string | null) => void; livingWorld?: WildsWorldProjection | null; worldMode: WildsSettlementWorldMode }) {
  const defeatedBossIds = livingWorld?.defeatedBossIds ?? [];
  const canonical = worldMode === "receiz_live";
  const met = civic.completedSourceIds.includes("resident:sola-reed");
  const archived = civic.completedSourceIds.includes("world-archive");
  return <div className="wilds-monument-view"><div><Resident crest="SR" name="Sola Reed" title="World Archivist" /><div className="wilds-settlement-actions"><button disabled={met} onClick={() => emit("resident.met", "resident:sola-reed", 2)} type="button">{met ? "Sola remembers you" : "Meet Sola"}</button><button disabled={archived} onClick={() => emit("service.completed", "world-archive", 3)} type="button">{archived ? "Archive studied" : "Study world archive"}</button></div></div><div className={`wilds-monument-authority ${canonical ? "canonical" : "practice"}`}><Icons.receiz aria-hidden="true" size={20} /><div><strong>{canonical ? "Canonical world memory" : "Practice memory"}</strong><span>{canonical ? "Derived from the shared Receiz living-world projection" : "Local facts are isolated and never presented as shared truth"}</span></div></div><div className="wilds-monument-list">{defeatedBossIds.length ? defeatedBossIds.slice(-12).reverse().map((id, index) => <div key={id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>Shared boss defeated</strong><code>{id}</code></div></div>) : <div className="is-empty"><Icons.trophy aria-hidden="true" size={24} /><strong>The first monument is waiting</strong><small>When the shared world defeats a boss, its exact canonical ID is remembered here.</small></div>}</div></div>;
}

function Resident({ crest, name, title }: { crest: string; name: string; title: string }) {
  return <div className="wilds-settlement-resident"><span>{crest}</span><div><small>Permanent resident</small><strong>{name}</strong><em>{title}</em></div></div>;
}

"use client";

import { useMemo } from "react";
import { Icons } from "@/components/icons";
import { creatureContinuityProjection } from "./creature-continuity";
import type { WildsInput } from "./game-state";
import type { PortableCardAsset } from "./portable-card";

function relativeMoment(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function CreatureContinuityPanel({
  asset,
  disabled = false,
  onInput
}: {
  asset: PortableCardAsset;
  disabled?: boolean;
  onInput: (input: WildsInput) => void;
}) {
  const continuity = useMemo(() => creatureContinuityProjection(asset), [asset]);
  const mandate = continuity?.mandate ?? null;
  const ownerMatches = !mandate || mandate.ownerReceizId === asset.manifest.ownerReceizId;
  const active = Boolean(mandate?.status === "active" && ownerMatches && !disabled);
  const recent = continuity?.events.slice(-5).reverse() ?? [];
  const command = (type: "activate-creature-continuity" | "pause-creature-continuity" | "settle-creature-continuity") => {
    onInput({ type, assetId: asset.id, ownerReceizId: asset.manifest.ownerReceizId, at: new Date().toISOString() });
  };

  return (
    <section className={`wilds-creature-continuity${active ? " is-active" : ""}`} aria-label={`${asset.manifest.name} life while away`}>
      <header>
        <span className="wilds-continuity-orbit" aria-hidden="true"><i /><i /><i /></span>
        <div>
          <small>Living creature continuity</small>
          <strong>Life while away</strong>
          <p>{active
            ? `${asset.manifest.name} can explore, meet, bond, discover, and barter non-value keepsakes under your mandate.`
            : `${asset.manifest.name} is present and remembering, but will not act autonomously without your permission.`}</p>
        </div>
        <span className="wilds-continuity-status"><i />{active ? "Roaming" : "Resting"}</span>
      </header>

      <div className="wilds-continuity-command">
        <button
          className={`button ${active ? "button-outline" : "button-primary"}`}
          disabled={disabled}
          onClick={() => command(active ? "pause-creature-continuity" : "activate-creature-continuity")}
          type="button"
        >{active ? "Call home & pause" : mandate ? "Resume roaming" : "Awaken life while away"}</button>
        {active ? <button className="button button-outline" onClick={() => command("settle-creature-continuity")} type="button">Settle journey now</button> : null}
      </div>

      {!ownerMatches ? <p className="wilds-continuity-warning">This card changed owners. Its memories transferred, but the previous owner&apos;s mandate cannot transfer; activate a new one.</p> : null}
      {disabled ? <p className="wilds-continuity-warning">Retired creatures keep their complete lived history but cannot receive new roaming authority.</p> : null}

      <div className="wilds-continuity-vitals">
        <span><Icons.map aria-hidden="true" size={16} /><small>Now</small><strong>{(continuity?.locationId ?? "wayfinder-hollow").replaceAll("-", " ")}</strong></span>
        <span><Icons.users aria-hidden="true" size={16} /><small>Bonds</small><strong>{continuity?.relationships.length ?? 0}</strong></span>
        <span><Icons.package aria-hidden="true" size={16} /><small>Keepsakes</small><strong>{continuity?.keepsakes.length ?? 0}</strong></span>
        <span><Icons.sparkle aria-hidden="true" size={16} /><small>Discoveries</small><strong>{continuity?.discoveries.length ?? 0}</strong></span>
      </div>

      <div className="wilds-continuity-memory">
        <div><strong>Lived memory</strong><small>{continuity?.events.length ?? 0} replayable events · settled on return in v119</small></div>
        {recent.length ? recent.map((event) => (
          <article key={event.digest}>
            <span aria-hidden="true">{event.kind === "discover" ? "✦" : event.kind === "barter-keepsake" ? "⇄" : event.kind === "explore" ? "⌁" : "●"}</span>
            <p><strong>{event.kind.replaceAll("-", " ")}</strong>{event.summary}<small>{relativeMoment(event.occurredAt)} · proof {event.digest.slice(7, 17)}</small></p>
          </article>
        )) : <p className="wilds-continuity-empty">No autonomous events yet. Once awakened, the first due moment is deterministic and cannot be invented by the creature&apos;s AI voice.</p>}
      </div>

      {continuity?.relationships.length ? <div className="wilds-continuity-bonds">
        <strong>Creatures known</strong>
        {continuity.relationships.slice(-4).map((relationship) => <span key={relationship.subjectId}><i>{relationship.name.slice(0, 1)}</i><b>{relationship.name}</b><small>{relationship.meetings} meeting{relationship.meetings === 1 ? "" : "s"} · bond {relationship.affinity}</small></span>)}
      </div> : null}

      <footer><span>Owner-controlled · max 4 acts/day · 72h catch-up</span><span>{continuity?.headDigest ? `Head ${continuity.headDigest.slice(7, 18)}` : "Awaiting first event"}</span></footer>
    </section>
  );
}

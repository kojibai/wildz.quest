"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { creatureContinuityProjection } from "./creature-continuity";
import { CREATURE_CONTINUITY_ACTIONS } from "./creature-continuity";
import type { WildsInput } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import { CREATURE_CARE_COSTS, projectCreatureCare, type CreatureCareAction } from "./creature-care";
import { WILDZ_CARE_NOTIFICATIONS_READY, WILDZ_ENABLE_CARE_NOTIFICATIONS } from "../pwa/pwa-events";

function relativeMoment(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function CreatureContinuityPanel({
  asset,
  beans,
  disabled = false,
  onInput
}: {
  asset: PortableCardAsset;
  beans: number;
  disabled?: boolean;
  onInput: (input: WildsInput) => void;
}) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  useEffect(() => {
    const update = () => setNow(new Date().toISOString());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    const update = () => setNotificationsEnabled(typeof Notification !== "undefined" && Notification.permission === "granted");
    update();
    window.addEventListener(WILDZ_CARE_NOTIFICATIONS_READY, update);
    return () => window.removeEventListener(WILDZ_CARE_NOTIFICATIONS_READY, update);
  }, []);
  const continuity = useMemo(() => creatureContinuityProjection(asset), [asset]);
  const care = useMemo(() => projectCreatureCare(asset, now), [asset, now]);
  const mandate = continuity?.mandate ?? null;
  const ownerMatches = !mandate || mandate.ownerReceizId === asset.manifest.ownerReceizId;
  const active = Boolean(mandate?.status === "active" && ownerMatches && !disabled);
  const livedExperiences = continuity?.events.filter((event) => CREATURE_CONTINUITY_ACTIONS.includes(event.kind as (typeof CREATURE_CONTINUITY_ACTIONS)[number])) ?? [];
  const recent = livedExperiences.slice(-5).reverse();
  const command = (type: "activate-creature-continuity" | "pause-creature-continuity" | "settle-creature-continuity") => {
    const at = new Date().toISOString();
    setNow(at);
    onInput({ type, assetId: asset.id, ownerReceizId: asset.manifest.ownerReceizId, at });
  };
  const careFor = (action: CreatureCareAction) => {
    const at = new Date().toISOString();
    setNow(at);
    onInput({
      type: "care-for-creature",
      assetId: asset.id,
      ownerReceizId: asset.manifest.ownerReceizId,
      action,
      at
    });
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

      {!active && !disabled ? <p className="wilds-continuity-warning">Awakening roaming also begins real care: hunger and attention decline while away, untreated sickness can permanently end this exact creature&apos;s living journey, and calling it home pauses all decline.</p> : null}

      {!ownerMatches ? <p className="wilds-continuity-warning">This card changed owners. Its memories transferred, but the previous owner&apos;s mandate cannot transfer; activate a new one.</p> : null}
      {disabled ? <p className="wilds-continuity-warning">Retired creatures keep their complete lived history but cannot receive new roaming authority.</p> : null}

      <div className="wilds-continuity-vitals">
        <span><Icons.map aria-hidden="true" size={16} /><small>Now</small><strong>{(continuity?.locationId ?? "wayfinder-hollow").replaceAll("-", " ")}</strong></span>
        <span><Icons.users aria-hidden="true" size={16} /><small>Bonds</small><strong>{continuity?.relationships.length ?? 0}</strong></span>
        <span><Icons.package aria-hidden="true" size={16} /><small>Keepsakes</small><strong>{continuity?.keepsakes.length ?? 0}</strong></span>
        <span><Icons.sparkle aria-hidden="true" size={16} /><small>Discoveries</small><strong>{continuity?.discoveries.length ?? 0}</strong></span>
      </div>

      <div className={`wilds-creature-care is-${care.status}`} aria-label={`${asset.manifest.name} care needs`}>
        <header><div><small>Real-time care</small><strong>{care.status.replaceAll("-", " ")}</strong></div><b>{beans} trail beans</b></header>
        <div className="wilds-care-meters">
          {(["hunger", "attention", "wellness"] as const).map((key) => <span key={key}><small>{key}</small><progress aria-label={`${asset.manifest.name} ${key} ${care[key]}%`} max={100} value={care[key]} /><b>{care[key]}</b></span>)}
        </div>
        {care.active && care.status !== "dead" ? <div className="wilds-care-actions">
          <button disabled={disabled || beans < CREATURE_CARE_COSTS.feed} onClick={() => careFor("feed")} type="button"><strong>Feed</strong><small>3 beans</small></button>
          <button disabled={disabled} onClick={() => careFor("comfort")} type="button"><strong>Give attention</strong><small>bond care</small></button>
          <button disabled={disabled || beans < CREATURE_CARE_COSTS.treat} onClick={() => careFor("treat")} type="button"><strong>Treat</strong><small>8 beans</small></button>
        </div> : <p>{care.status === "dead" ? `${asset.manifest.name}'s living journey has ended. Its complete memory remains in the card.` : "Awaken Life while away to begin the real care cycle. Resting creatures do not decline."}</p>}
        {care.active && !notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "default" ? <button className="wilds-care-notifications" onClick={() => window.dispatchEvent(new Event(WILDZ_ENABLE_CARE_NOTIFICATIONS))} type="button">Enable device care alerts</button> : null}
        {care.active && notificationsEnabled ? <small className="wilds-care-notifications is-enabled">Device care alerts enabled</small> : null}
        {care.active ? <footer><span>Play to earn food and treatment</span><span>{care.lastCareAt ? `Last care ${relativeMoment(care.lastCareAt)}` : "Care cycle just began"}</span></footer> : null}
      </div>

      <div className="wilds-continuity-memory">
        <div><strong>Lived memory</strong><small>{livedExperiences.length} real roaming {livedExperiences.length === 1 ? "experience" : "experiences"} · proof-chained</small></div>
        {recent.length ? recent.map((event) => (
          <article key={event.digest}>
            <span aria-hidden="true">{event.kind === "discover" ? "✦" : event.kind === "barter-keepsake" ? "⇄" : event.kind === "explore" ? "⌁" : "●"}</span>
            <p><strong>{event.kind.replaceAll("-", " ")}</strong>{event.summary}<small>{relativeMoment(event.occurredAt)} · proof {event.digest.slice(7, 17)}</small></p>
          </article>
        )) : <p className="wilds-continuity-empty">No roaming experience yet. Awakening roaming seals the first real meeting immediately.</p>}
      </div>

      {continuity?.relationships.length ? <div className="wilds-continuity-bonds">
        <strong>Creatures known</strong>
        {continuity.relationships.slice(-4).map((relationship) => <span key={relationship.subjectId}><i>{relationship.name.slice(0, 1)}</i><b>{relationship.name}</b><small>{relationship.meetings} meeting{relationship.meetings === 1 ? "" : "s"} · bond {relationship.affinity}</small></span>)}
      </div> : null}

      <footer><span>You control roaming and care · up to {mandate?.maxActionsPerDay ?? 24} acts/day · 72h catch-up</span><span>{continuity?.headDigest ? `Head ${continuity.headDigest.slice(7, 18)}` : "Awaiting first event"}</span></footer>
    </section>
  );
}

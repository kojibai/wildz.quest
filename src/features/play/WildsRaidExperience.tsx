"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { WildsRaidEncounterState, WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsRaidCardRole } from "./wilds-raid-roles";
import type { WildsWorldBossProjection, WildsWorldRaidProjection } from "./wilds-world-state";
import { WildsRaidActionDock } from "./WildsRaidActionDock";

export function WildsRaidExperience({ open, boss, raid, encounter, cardName, role, placement, canonical, connected, busyIntent, error, onAction, onLease, onRetreat, onClose }: {
  open: boolean;
  boss: WildsWorldBossProjection | null;
  raid: WildsWorldRaidProjection | null;
  encounter: WildsRaidEncounterState | null;
  cardName: string;
  role: WildsRaidCardRole;
  placement: "fighter" | "support";
  canonical: boolean;
  connected: boolean;
  busyIntent?: WildsRaidIntent["type"] | null;
  error?: string | null;
  onAction: (intent: WildsRaidIntent["type"]) => void;
  onLease: (status: "connected" | "disconnected") => void;
  onRetreat: () => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const squads = useMemo(() => Array.isArray(raid?.squads) ? raid.squads as string[][] : [[], [], [], [], [], []], [raid]);
  const supportCount = Array.isArray(raid?.supportPlayerIds) ? raid.supportPlayerIds.length : 0;
  const health = encounter?.bossHealth ?? boss?.health ?? 0;
  const maximum = encounter?.bossMaxHealth ?? boss?.maxHealth ?? 1;
  const healthPercent = Math.max(0, Math.min(100, maximum > 0 ? health / maximum * 100 : 0));

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => heading.current?.focus());
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", keydown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [onClose, open]);

  if (!open || !boss || !raid || typeof document === "undefined") return null;
  return createPortal(
    <section aria-labelledby="wilds-raid-title" aria-modal="true" className={`wilds-raid-experience phase-${encounter?.phase ?? boss.phase}`} role="dialog">
      <header className="wilds-raid-header">
        <div className="wilds-raid-identity">
          <span>{canonical ? "GLOBAL · RECEIZ LIVE" : "PRACTICE TIMELINE"}</span>
          <h2 id="wilds-raid-title" ref={heading} tabIndex={-1}>{String(boss.name ?? "Global boss")}</h2>
          <small>{String(boss.familyId ?? "boss").replaceAll("-", " ")} · {encounter?.phase ?? boss.phase}</small>
        </div>
        <button aria-label="Close raid" className="wilds-raid-close" onClick={onClose} type="button">×</button>
      </header>

      <div aria-label={`Global health ${Math.round(healthPercent)} percent`} aria-live="polite" className="wilds-raid-health" role="progressbar" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.ceil(health)}>
        <div><span>Global health</span><strong>{Math.ceil(health).toLocaleString()} / {maximum.toLocaleString()}</strong></div>
        <i style={{ "--raid-health": `${healthPercent}%` } as React.CSSProperties} />
      </div>

      <main className="wilds-raid-arena">
        <div className="wilds-raid-telegraph" role="status">
          <span>Telegraph</span>
          <strong>{encounter?.hazard?.replaceAll("-", " ") ?? String(boss.modules && typeof boss.modules === "object" && "hazard" in boss.modules ? boss.modules.hazard : "Territory shift")}</strong>
        </div>
        <div aria-label={`${String(boss.name ?? "Global boss")} arena`} className="wilds-raid-boss-sigil" role="img"><i /><i /><i /><b /></div>
        <div className="wilds-raid-objective">
          <span>Support objective</span>
          <strong>{encounter?.supportObjective?.replaceAll("-", " ") ?? "Hold the formation"}</strong>
        </div>
        <div className="wilds-raid-card-pin"><span>{role}</span><strong>{cardName}</strong><small>{placement}</small></div>
      </main>

      <div aria-label="Raid squads" className="wilds-raid-squads">
        {squads.map((members, index) => <div className={members.length >= 6 ? "is-full" : ""} key={index}><span>Squad {index + 1}</span><strong>{members.length}/6</strong></div>)}
        <div className="support"><span>Support</span><strong>{supportCount}/144</strong></div>
      </div>

      <footer className="wilds-raid-footer">
        {!connected ? <button className="wilds-raid-reconnect" onClick={() => onLease("connected")} type="button">Reconnect to reserved slot</button> : null}
        {error ? <p role="alert">{error.replaceAll("_", " ")}</p> : null}
        <WildsRaidActionDock busyIntent={busyIntent} disabled={!connected || encounter?.phase === "defeated"} onAction={onAction} placement={placement} role={role} />
        <button className="wilds-raid-retreat" onClick={onRetreat} type="button">Retreat safely</button>
      </footer>
    </section>, document.body
  );
}

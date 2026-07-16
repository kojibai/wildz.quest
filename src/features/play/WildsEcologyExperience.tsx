"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { applyWildsEcologyActivityInput, createWildsEcologyActivity, type WildsEcologyActivityInput } from "./wilds-ecology-activity";
import type { WildsWorldEcologyProjection } from "./wilds-world-state";
import type { WildsSettlementWorldMode } from "./WildsSettlementEnvironment";

export function WildsEcologyExperience({ card, onExit, onSubmit, open, participantCount, site, worldMode }: {
  card: PortableCardAsset | null;
  onExit: () => void;
  onSubmit: (input: { siteId: string; amount: number; cardProofDigest: string }) => Promise<void> | void;
  open: boolean;
  participantCount: number;
  site: WildsWorldEcologyProjection | null;
  worldMode: WildsSettlementWorldMode;
}) {
  const seed = site?.seedDigest ?? "";
  const source = site ? { ...site, schema: "receiz.wilds_ecology_site.v1" as const } : null;
  const initial = useMemo(() => source ? createWildsEcologyActivity(source) : null, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activity, setActivity] = useState(initial);
  const [submission, setSubmission] = useState<"idle" | "pending" | "accepted" | "error">("idle");
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const verifiedCard = Boolean(card && verifyAnyWildsCard(card).ok);

  useEffect(() => { setActivity(initial); setSubmission("idle"); }, [initial]);
  const requestExit = useCallback(() => {
    if (activity?.phase === "active" && !window.confirm("Leave this active ecology pattern? Your local steps will reset.")) return;
    onExit();
  }, [activity?.phase, onExit]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialog.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") requestExit(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocus.current?.focus();
    };
  }, [open, requestExit]);

  if (!open || !site || !activity || typeof document === "undefined") return null;
  const act = (input: WildsEcologyActivityInput) => setActivity((current) => current ? applyWildsEcologyActivityInput(current, input) : current);
  const submit = async () => {
    if (!card || !verifiedCard || activity.phase !== "submitted") return;
    setSubmission("pending");
    try {
      await onSubmit({ siteId: site.id, amount: activity.objectives.length, cardProofDigest: card.proof.digest });
      setSubmission("accepted");
    } catch {
      setSubmission("error");
    }
  };
  const current = activity.objectives[activity.progress] ?? null;

  return createPortal(
    <section aria-labelledby="wilds-ecology-title" aria-modal="true" className={`wilds-ecology-experience family-${site.familyId}`} ref={dialog} role="dialog" tabIndex={-1}>
      <header className="wilds-ecology-header">
        <div><span>{worldMode === "receiz_live" ? "Receiz live world" : worldMode === "local_practice" ? "Local practice · cannot publish" : "Connecting to world"}</span><h2 id="wilds-ecology-title">{site.name}</h2></div>
        <div className="wilds-ecology-party"><Icons.users aria-hidden="true" size={16} /><strong>{Math.max(1, participantCount)}</strong><small>HERE</small></div>
        <button aria-label="Return to world" className="wilds-ecology-close" onClick={requestExit} type="button"><Icons.close aria-hidden="true" size={21} /></button>
      </header>

      <nav aria-label="Activity objectives" className="wilds-ecology-objectives">
        {activity.objectives.map((objective, index) => <div aria-current={index === activity.progress ? "step" : undefined} className={index < activity.progress ? "is-complete" : ""} key={objective.id}><span>{index < activity.progress ? <Icons.check size={15} /> : index + 1}</span><strong>{objective.label}</strong><small>{objective.hint}</small></div>)}
      </nav>

      <main className="wilds-ecology-arena">
        <div className="wilds-ecology-sky" aria-hidden="true"><i /><i /><i /></div>
        <div className="wilds-ecology-signal" aria-hidden="true"><span /><span /><b>{activity.progress}/{activity.objectives.length}</b></div>
        <div className="wilds-ecology-brief">
          <span>{site.activityId.replaceAll("-", " ")} · {site.phase}</span>
          <h3>{activity.title}</h3>
          <p>{activity.instruction}</p>
          <strong aria-live="polite">{activity.message}</strong>
        </div>
        <div className={`wilds-ecology-card-role${verifiedCard ? " is-verified" : ""}`}>
          <Icons.seal aria-hidden="true" size={20} />
          <div><small>{verifiedCard ? "Verified companion role" : "Contribution locked"}</small><strong>{verifiedCard ? card?.manifest.name : "Bring a verified card"}</strong>{card ? <code>{card.proof.digest.slice(7, 19)}</code> : null}</div>
        </div>
      </main>

      <footer className="wilds-ecology-footer">
        {submission === "accepted" ? <button className="wilds-ecology-action is-primary" onClick={requestExit} type="button"><Icons.globe size={18} /><span><strong>Return to world</strong><small>Contribution admitted</small></span></button>
          : activity.phase === "submitted" ? <button className="wilds-ecology-action is-primary" disabled={!verifiedCard || submission === "pending"} onClick={() => void submit()} type="button"><Icons.receiz size={18} /><span><strong>{submission === "pending" ? "Publishing…" : "Offer contribution"}</strong><small>{submission === "error" ? "World did not admit it · retry" : "Proof-bound and idempotent"}</small></span></button>
            : activity.objectives.map((objective) => <button aria-label={`${objective.label}: ${objective.hint}`} className="wilds-ecology-action" disabled={objective.input !== current?.input} key={objective.id} onClick={() => act(objective.input)} type="button"><Icons.pulse size={18} /><span><strong>{objective.label}</strong><small>{objective.hint}</small></span></button>)}
      </footer>
    </section>,
    document.body
  );
}

"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COMMUNITY_RULES_DIGEST, type WildsCommunity } from "@/features/play/wilds-community";
import { deriveKaiKlokMoment } from "@/features/play/kai-klok-moment";
import { createKaiTemporalRoot } from "@/features/play/kai-temporal-root";
import type { WildsWorldCommand } from "@/features/play/wilds-world-service";
import styles from "../../guide/reader.module.css";
import ui from "./community.module.css";

type Action = { id: string; label: string; help: string; fields: [string, string][] };
const actions: Action[] = [
  { id: "join", label: "Join this charter", help: "Accept the published procedures for this community. A participation place is requested separately.", fields: [] },
  { id: "request-place", label: "Request a participation place", help: "Places follow recorded request order. If full, your request joins the waiting list. A delegate may name their dependent.", fields: [["member", "Applicant (leave blank for yourself)"]] },
  { id: "check-in", label: "Check in / return", help: "Record your presence and cancel any inactivity notice on your place.", fields: [] },
  { id: "release-place", label: "Release my place", help: "Your place returns to the waiting list. This does not affect your assets.", fields: [] },
  { id: "notice", label: "Open an inactivity notice", help: "Requires 30 Kai days without check-in. An active dispute blocks notice. The member gets seven Kai days to return.", fields: [["member", "Member’s exact Receiz handle"]] },
  { id: "release-inactive", label: "Complete an inactivity review", help: "After seven Kai days, an unanswered, undisputed notice releases the participation place. No player account, building or card is deleted.", fields: [["member", "Member’s exact Receiz handle"]] },
  { id: "delegate", label: "Appoint a limited guardian", help: "Voluntarily delegate only requesting your participation place, for 30 Kai days. Explain the temporary need. No account access is granted.", fields: [["member", "Guardian’s exact Receiz handle"], ["reason", "Need, benefit and duties of this delegation"]] },
  { id: "revoke-delegate", label: "End my delegation", help: "Capacity has returned or you no longer need assistance. The delegation ends immediately.", fields: [] },
  { id: "open-case", label: "Open a dispute", help: "Name an independent community reviewer. Both parties and the reviewer must consent before a finding. Unresolved reviews expire after 30 Kai days without establishing a verdict. Evidence is public and remains a claim until evaluated.", fields: [["member", "Respondent’s exact Receiz handle"], ["judge", "Reviewer’s exact Receiz handle"], ["reason", "Proposition and applicable community rule"], ["evidence", "Evidence, origin, integrity and limitations"]] },
  { id: "case-reviewer", label: "Replace a conflicted reviewer", help: "Before a finding, either party may propose another independent reviewer. All consents reset; no review proceeds without fresh agreement.", fields: [["record", "Case ID"], ["judge", "New reviewer’s exact Receiz handle"]] },
  { id: "withdraw-case", label: "Withdraw my allegation", help: "The claimant can withdraw before a finding. The allegation remains in history but no longer holds an inactivity review.", fields: [["record", "Case ID"]] },
  { id: "case-consent", label: "Consent to case review", help: "Parties accept this reviewer. The reviewer must disclose no material conflict; otherwise choose another reviewer.", fields: [["record", "Case ID"], ["conflicts", "Reviewer only: type none if no material conflict"]] },
  { id: "case-evidence", label: "Respond / add evidence", help: "Add your response and the evidence considered. Do not publish private credentials or sensitive personal information.", fields: [["record", "Case ID"], ["reason", "Response"], ["evidence", "Evidence, origin, integrity and limitations"]] },
  { id: "find", label: "Record a finding", help: "The agreed reviewer must explain the rule and derivation, preserve evidence and record dissent. The only executable remedy here is cancelling the claimant’s inactivity notice.", fields: [["record", "Case ID"], ["result", "Result: supported or rejected"], ["remedy", "Remedy: none or cancel-notice"], ["reason", "Rule applied and reasoned derivation"], ["dissent", "Dissent / limitations (or none)"]] },
  { id: "appeal", label: "Appeal a finding", help: "Either party may appeal the first finding within seven Kai days. The appeal freezes the remedy and requires a different agreed reviewer.", fields: [["record", "Case ID"], ["reason", "Appeal grounds"]] },
  { id: "appeal-reviewer", label: "Nominate appeal reviewer", help: "Select a different independent member. Both parties and the new reviewer must consent again.", fields: [["record", "Case ID"], ["judge", "New reviewer’s exact Receiz handle"]] },
  { id: "remedy", label: "Apply the final remedy", help: "Either party can apply the final supported notice cancellation once the appeal window closes. The original finding stays in history.", fields: [["record", "Case ID"]] },
  { id: "offer-obligation", label: "Offer community work terms", help: "Define non-monetary work units and completion/default expectations. They become an obligation only if the other member accepts. These are not Φ, loans or wallet transfers.", fields: [["member", "Debtor’s exact Receiz handle"], ["units", "Work units"], ["terms", "Scope, work, completion and default terms"]] },
  { id: "accept-obligation", label: "Accept work terms", help: "The debtor explicitly accepts the exact recorded terms. Review the obligation below first.", fields: [["record", "Obligation ID"]] },
  { id: "acknowledge-work", label: "Acknowledge completed work", help: "The creditor records completed units. Reaching zero completes the obligation; previous terms and creditor loss remain recorded.", fields: [["record", "Obligation ID"], ["units", "Completed units"]] },
  { id: "propose-insolvency", label: "Propose obligation relief", help: "The debtor proposes the remaining work they can complete, including zero for full discharge. It takes effect only when the creditor accepts.", fields: [["record", "Obligation ID"], ["units", "Proposed remaining units"]] },
  { id: "accept-insolvency", label: "Accept obligation relief", help: "The creditor accepts the pending reduction. Discharged units remain in history as creditor loss; no assets are seized.", fields: [["record", "Obligation ID"]] },
  { id: "propose", label: "Propose capacity amendment", help: "Every current member must ratify. Allocated places cannot be removed. Membership is frozen only for the open vote, which the proposer can withdraw.", fields: [["capacity", "Participation places (1–100)"], ["capacityPlan", "Capacity, responsibilities and expansion plan"]] },
  { id: "ratify", label: "Ratify the open proposal", help: "Review the proposal below. Your approval binds that exact revision. It activates when all current members approve.", fields: [] },
  { id: "withdraw-proposal", label: "Withdraw my proposal", help: "The proposer can withdraw an unfinished vote so membership can resume.", fields: [] },
  { id: "leave", label: "Leave this charter", help: "Release membership and your participation place after resolving open charter obligations, cases and votes. You can always leave the game itself.", fields: [] }
];
const adopt: Action = { id: "adopt", label: "Adopt a community charter", help: "Create a voluntary community under all seven published procedures. You are its first consenting member, with no override over later members. Capacity means community participation places, not a promise of physical shelter.", fields: [["name", "Community name"], ["capacity", "Participation places (1–100)"], ["capacityPlan", "Responsibilities, capacity limits and expansion plan"]] };
type Pending = { actor: string; command: WildsWorldCommand };
const pendingKey = "wildz:community:pending:v1";
export function CommunityConsole() {
  const [communities, setCommunities] = useState<Record<string, WildsCommunity>>({});
  const [actor, setActor] = useState<string | null>(null), [selected, setSelected] = useState("");
  const [actionId, setAction] = useState("join"), [status, setStatus] = useState("Loading community records…");
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<Pending | null>(null);
  const lock = useRef(false);
  const community = communities[selected]; const action = community ? actions.find(a => a.id === actionId)! : adopt;
  async function load() {
    const response = await fetch("/api/wilds/community", { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const body = await response.json(); if (!response.ok || body.ok !== true) throw new Error(body.error || "Community records are unavailable.");
    setCommunities(body.communities); setActor(body.actor); return body;
  }
  useEffect(() => { let active = true; void load().then(() => { if (active) setStatus(""); }).catch(e => { if (active) setStatus(e.message); });
    try { const saved = JSON.parse(localStorage.getItem(pendingKey) || "null"); if (saved?.command?.type === "community.transition") setPending(saved); } catch { /* A malformed recovery entry is not executable. */ }
    return () => { active = false; };
  }, []);
  async function send(entry: Pending) {
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      if (!actor || entry.actor !== actor) throw new Error("Restore the same account before retrying its pending action.");
      localStorage.setItem(pendingKey, JSON.stringify(entry)); setPending(entry); setStatus("Checking the action and recording its result…");
      const response = await fetch("/api/wilds/world/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: entry.command }), signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (body.zeroWrite === true || body.constitution?.result === "INVALID" || body.constitution?.result === "UNRESOLVED") { localStorage.removeItem(pendingKey); setPending(null); }
        throw new Error((body.error || "The action could not be confirmed.").replace(/^wilds_community:/, ""));
      }
      setCommunities(body.projection.communities ?? {});
      if (entry.command.type === "community.transition") {
        setSelected(entry.command.request.communityId);
        if (["adopt", "join"].includes(entry.command.request.action)) setAction("request-place");
        else if (entry.command.request.action === "request-place") setAction("check-in");
      }
      if (body.publication?.required === "identity_proof") {
        setStatus("Action accepted. Confirming its signed publication…");
        const { publishActiveWildsWorldWithIdentityProof } = await import("@/lib/receiz/wilds-world-identity-publication");
        await publishActiveWildsWorldWithIdentityProof(body.publication.draft);
      } else if (body.publication?.published !== true || body.constitution?.publicationStatus === "DISPUTED" || body.constitutionalFork) {
        throw new Error("Action accepted locally, but publication is not confirmed. Retry this same action to check its status.");
      }
      localStorage.removeItem(pendingKey); setPending(null); setStatus("Action accepted and publication confirmed.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "The result is unknown. Retry the same action before submitting another."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className={styles.page}><div className={ui.console}>
    <nav><Link prefetch={false} href="/laws">← World law</Link><Link prefetch={false} href="/">Return to Wildz</Link></nav>
    <header><p className={styles.eyebrow}>THE COMMUNITY RECORD</p><h1>Rules become practice.</h1><p>Explicit adoption. Bounded authority. A recorded path from proposal to completion.</p></header>
    <p className={ui.status} role="status">{status || (actor ? `Acting as ${actor}` : "Restore your Identity Seal in Wildz to act. Public records remain readable.")}</p>
    <button type="button" disabled={busy} onClick={() => { void load().then(() => setStatus("Records refreshed.")).catch(e => setStatus(e.message)); }}>Refresh records</button>
    {pending && <aside className={ui.notice}><p>A previous action still needs confirmation. Retrying preserves its exact command ID.</p><button disabled={busy || pending.actor !== actor} onClick={() => void send(pending)}>Retry pending action</button></aside>}
    <section><h2>Choose a community</h2><label>Community<select aria-label="Community" value={selected} onChange={e => { const id = e.target.value; setSelected(id); setAction(actor && communities[id]?.members[actor] ? communities[id].allocations[actor] ? "check-in" : "request-place" : "join"); }}><option value="">Create a new charter</option>{Object.values(communities).map(c => <option key={c.id} value={c.id}>{c.name} · revision {c.revision}</option>)}</select></label>
      {community && <><p>{Object.keys(community.members).length} members · {Object.values(community.allocations).filter(a => a.status === "allocated").length}/{community.capacity} places allocated · {Object.values(community.allocations).filter(a => a.status === "waiting").length} waiting</p><p>{community.capacityPlan}</p></>}
    </section>
    <section><h2>{community ? "Take a defined action" : "Adopt the procedures"}</h2>
      {community && <label>Action<select aria-label="Action" value={actionId} onChange={e => setAction(e.target.value)}>{actions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}
      <p>{action.help}</p>
      <form key={`${selected}:${action.id}`} onSubmit={e => { e.preventDefault(); if (pending || busy || !actor) return; const form = new FormData(e.currentTarget); const fields = Object.fromEntries(form.entries()) as Record<string,string>; const communityId = community?.id || fields.communityId; delete fields.communityId; fields.rulesDigest = COMMUNITY_RULES_DIGEST;
        void send({ actor, command: { type: "community.transition", commandId: `community:${crypto.randomUUID()}`, request: { expectedActor: actor, action: action.id, communityId, expectedRevision: community?.revision ?? 0, fields }, kai: createKaiTemporalRoot(deriveKaiKlokMoment({ occurredAt: new Date().toISOString(), authority: "world" })) } });
      }}>
        {!community && <label>Community ID<input name="communityId" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9_-]{2,63}" placeholder="your-community" /></label>}
        {action.fields.map(([name,label]) => <label key={name}>{label}{["reason","evidence","terms","capacityPlan","dissent"].includes(name) ? <textarea name={name} required maxLength={2000} rows={3} /> : <input name={name} required={!label.includes("leave blank") && name !== "conflicts"} maxLength={220} />}</label>)}
        <label className={ui.consent}><input type="checkbox" name="consent" value="yes" required /> I have reviewed this action and consent to its stated scope. Submitted records are public.</label>
        <button disabled={busy || !actor || Boolean(pending)} type="submit">{busy ? "Recording…" : action.label}</button>
      </form>
    </section>
    {community && <section><h2>The current record</h2>
      <details open><summary>Members, allocations and notices</summary>{Object.entries(community.members).map(([id]) => <article key={id}><strong>{id}</strong><p>{community.allocations[id]?.status ?? "No participation place"}{community.allocations[id]?.noticeAt != null ? " · inactivity notice open" : ""}</p>{community.guardians[id] && <p>Delegate: {community.guardians[id].guardian} · expires at Kai {community.guardians[id].expires}</p>}</article>)}</details>
      <details><summary>Cases and findings ({Object.keys(community.disputes).length})</summary>{Object.values(community.disputes).map(d => <article key={d.id}><code>{d.id}</code><p>{d.claimant} → {d.respondent} · reviewer: {d.judge || "awaiting nomination"}</p><p>{d.proposition}</p><p>Consented: {d.consents.join(", ")} · {d.withdrawn ? "withdrawn" : d.appealed ? "appeal open" : d.findings.length ? "finding recorded" : "open (30-Kai-day review limit)"}</p>{d.evidence.map((v,i) => <p key={i}>{v}</p>)}{d.responses.map((v,i) => <p key={i}>{v}</p>)}{d.findings.map((v,i) => <p key={i}>{v.result}: {v.reasoning} · dissent: {v.dissent} · remedy: {v.remedy}</p>)}<p>{d.appealReason}{d.remedyApplied ? " · remedy completed" : ""}</p></article>)}</details>
      <details><summary>Work obligations ({Object.keys(community.obligations).length})</summary>{Object.values(community.obligations).map(o => <article key={o.id}><code>{o.id}</code><p>{o.debtor} owes {o.creditor}: {o.remaining}/{o.units} work units · {o.completed ? "completed" : o.accepted ? "accepted" : "awaiting acceptance"}</p><p>{o.terms}</p><p>Relief proposed: {o.offer ?? "none"} · historical discharge: {o.discharged}</p></article>)}</details>
      <details><summary>Adoption and amendments</summary><p>Version 1 · {community.rulesDigest}</p>{community.proposal && <p>Proposed capacity: {community.proposal.capacity}. {community.proposal.plan} · approvals: {community.proposal.approvals.join(", ")}</p>}{community.adoptions.map((a,i) => <p key={i}>Adoption {i+1} · Kai {a.at} · capacity {a.capacity} · agreed by {a.members.join(", ")}</p>)}</details>
    </section>}
    <footer><Link prefetch={false} href="/laws">Read the rules and source constitution</Link></footer>
  </div></main>;
}

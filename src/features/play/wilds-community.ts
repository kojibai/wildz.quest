import { constitutionalDigest, WILDS_CONSTITUTION } from "./wilds-constitution";
import { KAI_N_DAY_MICRO } from "./kai-klok-moment";

export const COMMUNITY_RULES = Object.freeze({ version: 1, constitution: WILDS_CONSTITUTION.sourceDigest,
  inactivityDays: 30, noticeDays: 7, appealDays: 7, guardianDays: 30,
  allocation: "first-request-first-served", ratification: "unanimous-current-members",
  scope: "voluntary-community-participation-and-work-obligations" });
export const COMMUNITY_RULES_DIGEST = constitutionalDigest(COMMUNITY_RULES);
export type CommunityRequest = { expectedActor: string; action: string; communityId: string; expectedRevision: number; fields: Record<string, string> };
type Member = { joinedAt: number; lastActive: number };
type Allocation = { requestedAt: number; sequence: number; status: "waiting" | "allocated"; noticeAt: number | null };
type Guardian = { guardian: string; expires: number; reason: string };
type Finding = { judge: string; result: "supported" | "rejected"; reasoning: string; evidence: string[]; at: number; remedy: "none" | "cancel-notice"; dissent: string };
type Dispute = { withdrawn: boolean; openedAt: number; id: string; claimant: string; respondent: string; proposition: string; evidence: string[]; responses: string[]; judge: string; consents: string[]; findings: Finding[]; appealed: boolean; appealReason: string; remedyApplied: boolean };
type Obligation = { id: string; creditor: string; debtor: string; terms: string; units: number; remaining: number; accepted: boolean; offer: number | null; discharged: number; completed: boolean };
export type WildsCommunity = { id: string; name: string; revision: number; rulesDigest: string; lastKai: number; members: Record<string, Member>; capacity: number; capacityPlan: string; allocations: Record<string, Allocation>; guardians: Record<string, Guardian>; disputes: Record<string, Dispute>; obligations: Record<string, Obligation>; proposal: { capacity: number; plan: string; approvals: string[]; electorate: string[] } | null; adoptions: { at: number; members: string[]; capacity: number; rulesDigest: string }[] };
const fail = (message: string): never => { throw new Error(`wilds_community:${message}`); };
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) fail(message); }
const own = <T>(object: Record<string, T>, key: string): T | undefined => Object.hasOwn(object, key) ? object[key] : undefined;
const text = (fields: Record<string, string>, key: string, max = 1000) => { const value = fields[key]; requireRule(typeof value === "string" && value.trim().length > 0 && value.length <= max, `Enter ${key}.`); return value.trim(); };
const number = (fields: Record<string, string>, key: string, max = 1000) => { const raw = text(fields, key, 10); const value = Number(raw); requireRule(/^\d+$/.test(raw) && Number.isSafeInteger(value) && value >= 0 && value <= max, `${key} must be a whole number from 0 to ${max}.`); return value; };
function refill(c: WildsCommunity) {
  let free = c.capacity - Object.values(c.allocations).filter(a => a.status === "allocated").length;
  for (const [, allocation] of Object.entries(c.allocations).filter(([, a]) => a.status === "waiting").sort((a,b) => a[1].sequence - b[1].sequence)) {
    if (free-- <= 0) break;
    allocation.status = "allocated";
  }
}
export function transitionCommunity(previous: WildsCommunity | undefined, request: CommunityRequest, actor: string, at: number, eventId: string): WildsCommunity {
  requireRule(typeof actor === "string" && actor.length > 0 && !["__proto__", "constructor", "prototype"].includes(actor), "An identified player is required.");
  requireRule(Number.isSafeInteger(at) && at >= 0 && Number.isSafeInteger(at + 30 * Number(KAI_N_DAY_MICRO)), "A valid Kai time is required.");
  requireRule(request && typeof request === "object" && typeof request.communityId === "string" && /^[a-z0-9][a-z0-9_-]{2,63}$/.test(request.communityId), "Use a community ID of 3–64 letters, numbers, dashes or underscores.");
  requireRule(request.expectedActor === actor, "The active account changed. Refresh before acting.");
  requireRule(request.fields && typeof request.fields === "object" && !Array.isArray(request.fields) && Object.keys(request.fields).length <= 12 && Object.values(request.fields).every(v => typeof v === "string" && v.length <= 4000), "Invalid form fields.");
  const f = request.fields;
  if (request.action === "adopt") {
    requireRule(!previous && request.expectedRevision === 0, "This community already exists.");
    requireRule(f.rulesDigest === COMMUNITY_RULES_DIGEST && f.consent === "yes", "Review and accept the exact community procedures.");
    const capacity = number(f, "capacity", 100); requireRule(capacity > 0, "Capacity must be at least one participation place.");
    return { id: request.communityId, name: text(f, "name", 100), revision: 1, lastKai: at, rulesDigest: COMMUNITY_RULES_DIGEST, capacity, capacityPlan: text(f, "capacityPlan"), members: { [actor]: { joinedAt: at, lastActive: at } }, allocations: {}, guardians: {}, disputes: {}, obligations: {}, proposal: null, adoptions: [{ at, members: [actor], capacity, rulesDigest: COMMUNITY_RULES_DIGEST }] };
  }
  requireRule(previous && previous.revision === request.expectedRevision, "The community changed. Refresh before acting.");
  requireRule(previous.rulesDigest === COMMUNITY_RULES_DIGEST && at >= previous.lastKai, "The rules or Kai source changed.");
  const c: WildsCommunity = structuredClone(previous); c.revision++; c.lastKai = at;
  const member = own(c.members, actor);
  const activeCase = (player: string) => Object.values(c.disputes).some(d => !d.withdrawn && (d.claimant === player || d.respondent === player) && ((!d.findings.length || d.appealed) ? at < d.openedAt + 30 * Number(KAI_N_DAY_MICRO) : at < d.findings.at(-1)!.at + COMMUNITY_RULES.appealDays * Number(KAI_N_DAY_MICRO) || (d.findings.at(-1)!.remedy === "cancel-notice" && !d.remedyApplied)));
  if (request.action === "join") {
    requireRule(!member && Object.keys(c.members).length < 32 && !c.proposal, "Already joined, membership is full, or a vote is open.");
    requireRule(f.consent === "yes" && f.rulesDigest === c.rulesDigest, "Accept this community’s procedures before joining.");
    c.members[actor] = { joinedAt: at, lastActive: at };
  } else {
    requireRule(member, "Join this community before acting.");
    switch (request.action) {
      case "leave":
        requireRule(!c.proposal && !activeCase(actor) && !Object.values(c.obligations).some(o => o.accepted && !o.completed && (o.creditor === actor || o.debtor === actor)), "Resolve the open vote, case or accepted obligation before leaving this charter. This does not restrict leaving the game.");
        delete c.members[actor]; delete c.allocations[actor]; delete c.guardians[actor];
        for (const [dependent, grant] of Object.entries(c.guardians)) if (grant.guardian === actor) delete c.guardians[dependent];
        break;
      case "request-place": {
        const target = f.member || actor;
        requireRule(own(c.members, target), "The applicant must be a current member.");
        requireRule(target === actor || (own(c.guardians, target)?.guardian === actor && c.guardians[target].expires > at), "Only the applicant or their current delegate can request a place.");
        requireRule(!own(c.allocations, target), "This member already has a place or a waiting-list entry.");
        c.allocations[target] = { requestedAt: at, sequence: c.revision, status: "waiting", noticeAt: null }; break;
      }
      case "release-place":
        requireRule(own(c.allocations, actor), "You have no allocation to release."); delete c.allocations[actor]; break;
      case "check-in":
        member.lastActive = at; if (own(c.allocations, actor)) c.allocations[actor].noticeAt = null; break;
      case "notice": {
        const target = text(f, "member", 180), subject = own(c.members, target), allocation = own(c.allocations, target);
        requireRule(subject && allocation?.status === "allocated" && allocation.noticeAt === null && at - subject.lastActive >= COMMUNITY_RULES.inactivityDays * Number(KAI_N_DAY_MICRO) && !activeCase(target), "A place needs 30 Kai days of inactivity and no active dispute before notice.");
        allocation.noticeAt = at; break;
      }
      case "release-inactive": {
        const target = text(f, "member", 180), allocation = own(c.allocations, target);
        requireRule(allocation?.noticeAt !== null && allocation?.noticeAt !== undefined && at - allocation.noticeAt >= COMMUNITY_RULES.noticeDays * Number(KAI_N_DAY_MICRO) && !activeCase(target), "The seven-Kai-day notice must expire without a check-in or active dispute.");
        delete c.allocations[target]; break;
      }
      case "delegate": {
        const guardian = text(f, "member", 180); requireRule(guardian !== actor && own(c.members, guardian), "Choose another current member.");
        c.guardians[actor] = { guardian, reason: text(f, "reason"), expires: at + COMMUNITY_RULES.guardianDays * Number(KAI_N_DAY_MICRO) }; break;
      }
      case "revoke-delegate": delete c.guardians[actor]; break;
      case "open-case": {
        requireRule(Object.keys(c.disputes).length < 32, "This community’s case capacity is reached.");
        const respondent = text(f, "member", 180), judge = text(f, "judge", 180);
        requireRule(respondent !== actor && judge !== actor && judge !== respondent && own(c.members, respondent) && own(c.members, judge), "Choose a respondent and an independent reviewer from current members.");
        c.disputes[eventId] = { withdrawn: false, openedAt: at, id: eventId, claimant: actor, respondent, judge, proposition: text(f, "reason"), evidence: [text(f, "evidence", 2000)], responses: [], consents: [actor], findings: [], appealed: false, appealReason: "", remedyApplied: false }; break;
      }
      case "case-reviewer": case "withdraw-case": case "case-consent": case "case-evidence": case "find": case "appeal": case "appeal-reviewer": case "remedy": {
        const d = own(c.disputes, text(f, "record", 220)); requireRule(d, "Choose an existing case.");
        requireRule(!d.withdrawn, "This case was withdrawn without a finding.");
        const party = actor === d.claimant || actor === d.respondent;
        requireRule(d.findings.length > 0 && !d.appealed || at < d.openedAt + 30 * Number(KAI_N_DAY_MICRO), "This unresolved review has expired; no finding or remedy was established.");
        if (request.action === "withdraw-case") {
          requireRule(actor === d.claimant && d.findings.length === 0, "Only the claimant may withdraw before a finding."); d.withdrawn = true;
        } else if (request.action === "case-reviewer") {
          requireRule(party && d.findings.length === 0, "Only a party in the initial review may nominate a replacement.");
          const judge = text(f, "judge", 180); requireRule(own(c.members, judge) && judge !== d.claimant && judge !== d.respondent && judge !== d.judge, "Choose a different independent current member.");
          d.judge = judge; d.consents = [actor];
        } else if (request.action === "case-consent") {
          requireRule(party || actor === d.judge, "Only the parties and selected reviewer can consent.");
          requireRule(!d.findings.length || d.appealed, "The finding is already recorded.");
          requireRule(f.consent === "yes", "Explicit consent and conflict disclosure are required.");
          if (actor === d.judge) requireRule(f.conflicts === "none", "A reviewer with a material conflict cannot decide this case.");
          if (!d.consents.includes(actor)) d.consents.push(actor);
        } else if (request.action === "case-evidence") {
          requireRule(party && (!d.findings.length || d.appealed) && d.evidence.length < 8, "Only a party in an open case can add evidence.");
          d.evidence.push(`${actor}: ${text(f, "evidence", 2000)}`); d.responses.push(`${actor}: ${text(f, "reason")}`);
        } else if (request.action === "find") {
          requireRule(actor === d.judge && [d.claimant, d.respondent, d.judge].every(p => d.consents.includes(p)) && (!d.findings.length || d.appealed), "The independent reviewer needs both parties’ consent and an open review.");
          requireRule(f.result === "supported" || f.result === "rejected", "Choose a supported or rejected finding.");
          requireRule(f.remedy === "none" || f.remedy === "cancel-notice", "Only a notice cancellation or no remedy is available.");
          requireRule(f.result === "supported" || f.remedy === "none", "A rejected claim cannot authorize a remedy.");
          d.findings.push({ judge: actor, result: f.result, reasoning: text(f, "reason", 2000), evidence: [...d.evidence], at, remedy: f.remedy, dissent: text(f, "dissent") }); d.appealed = false;
        } else if (request.action === "appeal") {
          const finding = d.findings.at(-1); requireRule(party && finding && !d.appealed && !d.remedyApplied && d.findings.length === 1 && at < finding.at + COMMUNITY_RULES.appealDays * Number(KAI_N_DAY_MICRO), "Appeal the first finding within seven Kai days, before remedy execution.");
          d.appealed = true; d.openedAt = at; d.appealReason = text(f, "reason"); d.consents = []; d.judge = "";
        } else if (request.action === "appeal-reviewer") {
          requireRule(party && d.appealed && !d.judge, "A party must nominate the appeal reviewer.");
          const judge = text(f, "judge", 180); requireRule(own(c.members, judge) && judge !== d.claimant && judge !== d.respondent && !d.findings.some(v => v.judge === judge), "The appeal needs a different independent member.");
          d.judge = judge; d.consents = [actor];
        } else {
          const finding = d.findings.at(-1); requireRule(party && finding && !d.appealed && !d.remedyApplied && at >= finding.at + COMMUNITY_RULES.appealDays * Number(KAI_N_DAY_MICRO), "Wait for a final finding and the appeal window before applying its remedy.");
          requireRule(finding.result === "supported" && finding.remedy === "cancel-notice", "This finding authorizes no notice cancellation.");
          const allocation = own(c.allocations, d.claimant); requireRule(allocation, "The claimant has no allocation to restore."); allocation.noticeAt = null; c.members[d.claimant].lastActive = at; d.remedyApplied = true;
        }
        break;
      }
      case "offer-obligation": {
        requireRule(Object.keys(c.obligations).length < 32, "This community’s obligation capacity is reached.");
        const debtor = text(f, "member", 180), units = number(f, "units", 10000); requireRule(debtor !== actor && own(c.members, debtor) && units > 0, "Choose another member and a positive work-unit amount.");
        c.obligations[eventId] = { id: eventId, creditor: actor, debtor, units, remaining: units, terms: text(f, "terms", 2000), accepted: false, offer: null, discharged: 0, completed: false }; break;
      }
      case "accept-obligation": case "acknowledge-work": case "propose-insolvency": case "accept-insolvency": {
        const o = own(c.obligations, text(f, "record", 220)); requireRule(o && !o.completed, "Choose an open obligation.");
        if (request.action === "accept-obligation") { requireRule(actor === o.debtor && !o.accepted && f.consent === "yes", "Only the debtor can accept these work terms."); o.accepted = true; }
        else { requireRule(o.accepted, "The obligation has not been accepted.");
          if (request.action === "acknowledge-work") { const units = number(f, "units", 10000); requireRule(actor === o.creditor && units > 0 && units <= o.remaining, "The creditor can acknowledge only remaining work."); o.remaining -= units; o.offer = null; o.completed = o.remaining === 0; }
          else if (request.action === "propose-insolvency") { const units = number(f, "units", 10000); requireRule(actor === o.debtor && units < o.remaining, "The debtor can propose a reduced remaining obligation."); o.offer = units; }
          else { requireRule(actor === o.creditor && o.offer !== null && f.consent === "yes", "The creditor must explicitly accept the pending reduction."); o.discharged += o.remaining - o.offer; o.remaining = o.offer; o.offer = null; o.completed = o.remaining === 0; }
        } break;
      }
      case "propose": {
        requireRule(!c.proposal, "Finish or withdraw the open proposal first.");
        const capacity = number(f, "capacity", 100); requireRule(capacity >= Object.values(c.allocations).filter(a => a.status === "allocated").length && capacity > 0, "Capacity cannot remove allocated places.");
        c.proposal = { capacity, plan: text(f, "capacityPlan"), approvals: [actor], electorate: Object.keys(c.members).sort() }; break;
      }
      case "ratify": requireRule(c.proposal && c.proposal.electorate.includes(actor) && f.consent === "yes", "Explicit consent from a current voter is required."); if (!c.proposal.approvals.includes(actor)) c.proposal.approvals.push(actor); break;
      case "withdraw-proposal": requireRule(c.proposal?.approvals[0] === actor, "Only the proposer can withdraw the proposal."); c.proposal = null; break;
      default: fail("This community action is not defined.");
    }
  }
  if (c.proposal && c.proposal.electorate.every(p => c.proposal!.approvals.includes(p))) {
    c.capacity = c.proposal.capacity; c.capacityPlan = c.proposal.plan;
    c.adoptions.push({ at, members: [...c.proposal.electorate], capacity: c.capacity, rulesDigest: c.rulesDigest }); c.proposal = null;
  }
  refill(c); return c;
}

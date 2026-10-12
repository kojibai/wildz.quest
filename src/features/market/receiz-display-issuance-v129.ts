/** Vendored Receiz public display policy. Numerical code is unchanged.
 * Source: kojibai/receiz app/utils/phi-issuance.ts
 * Source revision: 941039f966ada6a39913937a393e27fa5ce96aa2
 * SHA-256 of exact upstream file: 69622c017e955734525e121a7b27bdaa42066932657b145e02be493792de9c74
 * Only its valuation import uses the published @receiz/sdk/valuation bridge.
 * Read-only display use; never use this as a purchase or Settlement quote.
 */
// phi-issuance.ts — Deterministic $→Φ issuance layered on valuation.ts (no engine edits)
//
// Everything is deterministic, monotone in adoption, and φ-anchored.
// No RNG, no hidden levers. All boosts are tiny, transparent, and math-backed.

import type { SigilMetadataLite } from "@receiz/sdk/valuation";
import { computeIntrinsicUnsigned } from "@receiz/sdk/valuation";

/* ---------------------------- constants & helpers --------------------------- */

const PHI = (1 + Math.sqrt(5)) / 2;
const PULSES_PER_DAY_EXACT = 17491.270421;
const PULSES_PER_STEP = 11; // keep local (valuation exports internal only)

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const q = (x: number, d = 9) => Math.round(x * 10 ** d) / 10 ** d;


function stepIndexFromPulse(p: number, stepsPerBeat: number) {
  const n = Math.trunc(Math.max(0, p));
  return Math.floor(n / PULSES_PER_STEP) % Math.max(1, stepsPerBeat);
}
function breathResid(p: number) {
  return Math.trunc(Math.max(0, p)) % PULSES_PER_STEP; // 0..10
}
function circSim01(a: number, b: number, period: number) {
  const da = ((a - b) % period + period) % period;
  return 0.5 * (1 + Math.cos((2 * Math.PI * da) / period));
}

// φ-transition integers s_n = ceil(φ^n), n ≥ 1
function phiTransitionIndexFromPulse(pulse: number): number | null {
  if (!Number.isFinite(pulse) || pulse < 1) return null;
  const N = Math.trunc(pulse);
  const n0 = Math.floor(Math.log(N) / Math.log(PHI));
  for (let n = Math.max(1, n0 - 2); n <= n0 + 6; n++) {
    const s = Math.ceil(Math.pow(PHI, n));
    if (s === N) return n;
  }
  return null;
}

/* ---------------------------------- policy ---------------------------------- */

export type IssuancePolicy = {
  /** α: base Φ per $ at genesis (adoption≈0), premium-neutral */
  basePhiPerUsd: number;

  /** Early participation: M_adoption = exp(-λ * adoptionNow) */
  adoptionLambda: number; // suggested ≈ 1/φ

  /** Premium coupling (inverse, tiny): M_premium = (1/premium)^γ */
  premiumGamma: number;   // suggested ≈ 1/φ^2

  /** Moment quality: M_moment = 1 + momentBoostMax * rarityScore (0..1) */
  momentBoostMax: number; // tiny, e.g. 1/φ^2

  /** Single-transaction size booster (log-shaped, capped) + optional whale taper */
  sizeScaleUsd: number;   // scale for log1p
  sizeMu: number;         // slope (≈ 1/φ^3)
  sizeCap: number;        // hard cap on size boost (e.g. 1 + 1/φ^2)
  whaleTaper?: { k: number }; // optional: 1/√(1 + k·usd)

  /** Streak booster (per consecutive Kai-day): 1 + s·(1 − φ^(−N)) */
  streakMaxBoost: number;

  /** Lifetime tiers (sum of prior + current usd) → +boost */
  lifetimeTiers?: Array<{ thresholdUsd: number; boost: number }>;

  /** Hold bonus (Φ that vests later if held): addPhi * η * (1 − e^(−ρ·beats)), capped */
  holdBonus?: { eta: number; rho: number; capMultiple: number };

  /** Choir resonance (coordination in a small Kai window) */
  choir?: {
    windowPulses: number;     // half-width window
    maxBoost: number;         // e.g., 1/φ^3
    wStep: number;            // weight for step-index alignment (0..1)
    wBreath: number;          // weight for breath-residue alignment (0..1); wStep + wBreath = 1
  };

  /** Breath-sync alignment (user taps their breath phase 0..1) */
  breath?: {
    maxBoost: number; // e.g., 1/φ^4
  };

  /** Festival windows (deterministic, no RNG) */
  festival?: {
    mode: "phiTransition" | "beatEvery";
    interval: number;      // every N transitions or beats
    widthBeats: number;    // window half-width in beats
    bonus: number;         // extra multiplier within the window
  };

  /** Milestones: deterministic step-downs of Φ/$ as adoption or time advances */
  milestones?: {
    /** Step-downs keyed by adoption index in [0..1] */
    adoption?: Array<{ atAdoption: number; multiplier: number }>;
    /** Step-downs keyed by absolute pulse number */
    pulse?: Array<{ atPulse: number; multiplier: number }>;
    /** Step-downs keyed by beat number */
    beat?: Array<{ atBeat: number; multiplier: number }>;
    /** Step-downs on φ-transition index n (where s_n = ceil(φ^n)) */
    phiTransition?: Array<{ atN: number; multiplier: number }>;
    /** How to combine if multiple schedules apply at once */
    combine?: "min" | "product" | "max"; // default "min" (most conservative)
    /** Interpolation between steps (default "step"—right-continuous) */
    interpolation?: "step" | "linear";
  };

  /** Vow lock: early unlock penalty directs unvested bonus to Stewardship Pool */
  vow?: {
    earlyUnlockPenalty: number; // fraction of *unvested* bonus lost if broken early
    stewardEpochBeats: number;  // distribution cadence in beats
    stewardSpreadBeats: number; // spread stream over this span
  };
};

export const DEFAULT_ISSUANCE_POLICY: IssuancePolicy = {
  basePhiPerUsd: 0.10,          // tune α to your economics
  adoptionLambda: 1 / PHI,      // ≈ 0.618
  premiumGamma: 1 / (PHI**2),   // ≈ 0.382
  momentBoostMax: 1 / (PHI**2), // up to +38.2% at rarityScore=1
  sizeScaleUsd: 100,
  sizeMu: 1 / (PHI**3),         // ≈ 0.236
  sizeCap: 1 + 1 / (PHI**2),    // ≈ +38.2% max size boost
  whaleTaper: { k: 1 / (PHI**4) }, // gentle diminishing returns on huge single tx
  streakMaxBoost: 1 / (PHI**3), // up to ~+23.6% with long streak
  lifetimeTiers: [
    { thresholdUsd: 200,  boost: 0.05 },
    { thresholdUsd: 1000, boost: 0.10 },
    { thresholdUsd: 3000, boost: 0.16 },
  ],
  holdBonus: { eta: 1 / (PHI**2), rho: 1 / (PHI**3), capMultiple: 1 / PHI }, // cap ≈ +61.8% of addPhi

  choir: { windowPulses: 242, maxBoost: 1/(PHI**3), wStep: 0.6, wBreath: 0.4 }, // ~half-beat window
  breath: { maxBoost: 1/(PHI**4) },
  festival: { mode: "beatEvery", interval: 13, widthBeats: 1, bonus: 1/(PHI**4) },

  // Example milestone schedule: conservative, φ-flavored step-downs over adoption + time
  milestones: {
    adoption: [
      { atAdoption: 0.10, multiplier: 0.95 },
      { atAdoption: 0.25, multiplier: 0.90 },
      { atAdoption: 0.50, multiplier: 1 / PHI },       // ≈ 0.618
      { atAdoption: 0.75, multiplier: 1 / (PHI**1.25) } // gentle glide
    ],
    // Optional pulse-based caps (e.g., step-downs at φ-transitions converted to pulses)
    phiTransition: [
      { atN: 18, multiplier: 0.92 },
      { atN: 21, multiplier: 0.88 },
      { atN: 25, multiplier: 0.82 }
    ],
    combine: "min",
    interpolation: "step"
  },

  vow: { earlyUnlockPenalty: 0.5, stewardEpochBeats: 55, stewardSpreadBeats: 21 }
};

/* ---------------------------------- context --------------------------------- */

export type IssuanceContext = {
  meta: SigilMetadataLite;
  nowPulse: number;
  usd: number;

  /** Engagement state (optional, deterministic from your backend) */
  currentStreakDays?: number; // consecutive Kai-days with contribution
  lifetimeUsdSoFar?: number;  // prior total before this tx
  plannedHoldBeats?: number;  // if buyer commits to hold; else omit

  /** Choir info (neighbors contributing near nowPulse) */
  choirNearby?: Array<{ pulse: number }>;

  /** User breath phase in [0..1], if supplied by UI */
  breathPhase01?: number;
};

/* --------------------------- milestone multipliers -------------------------- */

type MilestoneCombine = NonNullable<IssuancePolicy["milestones"]>["combine"];

function stepInterp(
  x: number,
  entries: Array<{ at: number; multiplier: number }>
): number {
  // right-continuous step: use last multiplier whose "at" <= x
  let m = 1;
  for (const e of entries) if (x >= e.at) m = e.multiplier;
  return m;
}
function linearInterp(
  x: number,
  entries: Array<{ at: number; multiplier: number }>
): number {
  if (!entries.length) return 1;
  if (x <= entries[0].at) return entries[0].multiplier;
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1], b = entries[i];
    if (x <= b.at) {
      const t = (x - a.at) / Math.max(1e-12, b.at - a.at);
      return a.multiplier + t * (b.multiplier - a.multiplier);
    }
  }
  return entries[entries.length - 1].multiplier;
}
function combineMilestones(values: number[], how: MilestoneCombine = "min"): number {
  if (!values.length) return 1;
  if (how === "min") return Math.min(...values);
  if (how === "max") return Math.max(...values);
  // "product"
  return values.reduce((s, v) => s * v, 1);
}

// next milestone helper for UI
export type NextMilestone =
  | { kind: "adoption"; at: number; multiplier: number }
  | { kind: "pulse"; at: number; multiplier: number }
  | { kind: "beat"; at: number; multiplier: number }
  | { kind: "phiTransition"; at: number; multiplier: number }
  | null;

function computeMilestoneMultiplier(
  policy: IssuancePolicy,
  nowPulse: number,
  adoptionNow01: number,
  pulsesPerBeat: number
): { M_milestone: number; next: NextMilestone } {
  const M: number[] = [];
  let next: NextMilestone = null;
  const ms = policy.milestones;
  if (!ms) return { M_milestone: 1, next };

  const interp = ms.interpolation ?? "step";

  // Adoption milestones
  if (ms.adoption?.length) {
    const arr = ms.adoption.slice().sort((a, b) => a.atAdoption - b.atAdoption)
      .map(e => ({ at: clamp(e.atAdoption, 0, 1), multiplier: e.multiplier }));
    const m = interp === "linear" ? linearInterp(adoptionNow01, arr) : stepInterp(adoptionNow01, arr);
    M.push(m);
    const nxt = arr.find(e => e.at > adoptionNow01);
    if (nxt) next = next ?? { kind: "adoption", at: nxt.at, multiplier: nxt.multiplier };
  }

  // Pulse milestones
  if (ms.pulse?.length) {
    const arr = ms.pulse.slice().sort((a, b) => a.atPulse - b.atPulse)
      .map(e => ({ at: Math.max(0, Math.trunc(e.atPulse)), multiplier: e.multiplier }));
    const m = interp === "linear" ? linearInterp(nowPulse, arr) : stepInterp(nowPulse, arr);
    M.push(m);
    const nxt = arr.find(e => e.at > nowPulse);
    if (nxt && !next) next = { kind: "pulse", at: nxt.at, multiplier: nxt.multiplier };
  }

  // Beat milestones
  if (ms.beat?.length) {
    const beat = Math.floor(nowPulse / pulsesPerBeat);
    const arr = ms.beat.slice().sort((a, b) => a.atBeat - b.atBeat)
      .map(e => ({ at: Math.max(0, Math.trunc(e.atBeat)), multiplier: e.multiplier }));
    const m = interp === "linear" ? linearInterp(beat, arr) : stepInterp(beat, arr);
    M.push(m);
    const nxt = arr.find(e => e.at > beat);
    if (nxt && !next) next = { kind: "beat", at: nxt.at, multiplier: nxt.multiplier };
  }

  // φ-transition milestones
  if (ms.phiTransition?.length) {
    // Estimate current n from pulse
    const nApprox = Math.floor(Math.log(Math.max(1, nowPulse)) / Math.log(PHI));
    const arr = ms.phiTransition.slice().sort((a, b) => a.atN - b.atN)
      .map(e => ({ at: Math.max(1, Math.trunc(e.atN)), multiplier: e.multiplier }));
    const m = interp === "linear" ? linearInterp(nApprox, arr) : stepInterp(nApprox, arr);
    M.push(m);
    const nxt = arr.find(e => e.at > nApprox);
    if (nxt && !next) next = { kind: "phiTransition", at: nxt.at, multiplier: nxt.multiplier };
  }

  const M_milestone = q(combineMilestones(M, ms.combine ?? "min"));
  return { M_milestone, next };
}

/* ----------------------- experience multipliers (new) ----------------------- */

function choirMultiplierForPulse(
  nowPulse: number,
  stepsPerBeat: number,
  neighbors: Array<{ pulse: number }>,
  cfg?: IssuancePolicy["choir"]
) {
  if (!cfg || !neighbors?.length) return 1;
  const windowP = Math.max(1, cfg.windowPulses);
  const left = nowPulse - windowP, right = nowPulse + windowP;
  const choir = neighbors.filter(n => n.pulse >= left && n.pulse <= right);
  if (!choir.length) return 1;

  const meStep = stepIndexFromPulse(nowPulse, stepsPerBeat);
  const meResid = breathResid(nowPulse);
  let sum = 0;
  for (const n of choir) {
    const s = stepIndexFromPulse(n.pulse, stepsPerBeat);
    const r = breathResid(n.pulse);
    const stepSim   = circSim01(meStep, s, stepsPerBeat);
    const breathSim = circSim01(meResid, r, PULSES_PER_STEP);
    const pairSim = (cfg.wStep ?? 0.5) * stepSim + (cfg.wBreath ?? 0.5) * breathSim;
    sum += pairSim;
  }
  const avgSim = sum / choir.length; // 0..1
  const gain = cfg.maxBoost ?? 0;
  return q(1 + gain * (2 * avgSim - 1));
}

function breathAlignmentMultiplier(
  nowPulse: number,
  breathPhase01?: number,
  cfg?: IssuancePolicy["breath"]
) {
  if (!cfg || breathPhase01 == null) return 1;
  const resid = breathResid(nowPulse) / PULSES_PER_STEP; // 0..1
  const sim = 1 - Math.abs(((breathPhase01 - resid + 1) % 1) - 0.5) * 2; // 0..1
  return q(1 + (cfg.maxBoost ?? 0) * (2 * sim - 1));
}

function festivalMultiplier(
  nowPulse: number,
  pulsesPerBeat: number,
  cfg?: IssuancePolicy["festival"]
) {
  if (!cfg) return 1;
  const beat = Math.floor(nowPulse / pulsesPerBeat);
  if (cfg.mode === "beatEvery") {
    const k = Math.max(1, Math.trunc(cfg.interval));
    const half = Math.max(0, Math.trunc(cfg.widthBeats));
    const near = (beat % k === 0) || (Math.abs(beat % k) <= half) || (Math.abs((beat % k) - k) <= half);
    return q(near ? 1 + (cfg.bonus || 0) : 1);
  }
  // φ-transition mode
  const nApprox = Math.floor(Math.log(Math.max(1, nowPulse)) / Math.log(PHI));
  const sN = Math.ceil(Math.pow(PHI, nApprox));
  const k = Math.max(1, Math.trunc(cfg.interval));
  const isEvent = (nApprox % k) === 0;
  const half = Math.max(0, Math.trunc(cfg.widthBeats));
  const eventBeat = Math.floor(sN / pulsesPerBeat);
  const near = Math.abs(beat - eventBeat) <= half;
  return q(isEvent && near ? 1 + (cfg.bonus || 0) : 1);
}

/* --------------------------------- quoting ---------------------------------- */

export type Quote = ReturnType<typeof quotePhiForUsd>;

export function quotePhiForUsd(
  ctx: IssuanceContext,
  policy: IssuancePolicy = DEFAULT_ISSUANCE_POLICY
) {
  const { unsigned } = computeIntrinsicUnsigned(ctx.meta, ctx.nowPulse);
  const { premium, inputs } = unsigned;
  const adoption = inputs.adoptionNow;        // 0..1
  const rarityScore = inputs.rarityScore01;   // 0..1
  const pulsesPerBeat = inputs.pulsesPerBeat;

  const usd = Math.max(0, ctx.usd || 0);

  // (1) base
  const base = policy.basePhiPerUsd;

  // (2) early participation (decays with adoption)
  const M_adoption = q(Math.exp(-policy.adoptionLambda * adoption));

  // (3) inverse premium (tiny, caps extreme timing advantages)
  const M_premium = q(Math.pow(1 / Math.max(premium, 1e-9), policy.premiumGamma));

  // (4) moment quality (tiny, deterministic)
  const M_moment = q(1 + policy.momentBoostMax * rarityScore);

  // (5) contribution size booster (log, capped) + optional whale taper
  const rawSize = 1 + policy.sizeMu * Math.log1p(usd / Math.max(policy.sizeScaleUsd, 1));
  const M_size = Math.min(rawSize, policy.sizeCap);
  const M_taper = policy.whaleTaper ? 1 / Math.sqrt(1 + policy.whaleTaper.k * usd) : 1;
  const sizeMultiplier = q(M_size * M_taper);

  // (6) streak booster across consecutive Kai-days
  const N = Math.max(0, ctx.currentStreakDays || 0);
  const M_streak = q(1 + policy.streakMaxBoost * (1 - Math.pow(PHI, -N)));

  // (7) lifetime volume tier
  const L = Math.max(0, (ctx.lifetimeUsdSoFar || 0) + usd);
  const tierBoost = (policy.lifetimeTiers || []).reduce(
    (acc, t) => (L >= t.thresholdUsd ? Math.max(acc, t.boost) : acc),
    0
  );
  const M_tier = q(1 + tierBoost);

  // (8) choir resonance
  const M_choir = q(choirMultiplierForPulse(
    ctx.nowPulse,
    pulsesPerBeat / PULSES_PER_STEP,
    ctx.choirNearby ?? [],
    policy.choir
  ));

  // (9) breath-sync alignment
  const M_breath = q(breathAlignmentMultiplier(ctx.nowPulse, ctx.breathPhase01, policy.breath));

  // (10) festival window
  const M_festival = q(festivalMultiplier(ctx.nowPulse, pulsesPerBeat, policy.festival));

  // (11) milestone step-downs (adoption / pulse / beat / φ-transition)
  const { M_milestone, next: nextMilestone } =
    computeMilestoneMultiplier(policy, ctx.nowPulse, adoption, pulsesPerBeat);

  // Combined, fully deterministic multiplier
  const issuanceMultiplier = q(
    M_adoption * M_premium * M_moment * sizeMultiplier * M_streak * M_tier *
    M_choir * M_breath * M_festival * M_milestone
  );

  // Φ per $ and Φ added now as IP
  const phiPerUsd = q(base * issuanceMultiplier);
  const addPhiNow = q(usd * phiPerUsd);

  // Optional: hold bonus vests later (as IP cashflow at a future pulse)
  let vestAtPulse: number | null = null;
  let bonusPhiAtVest = 0;
  let bonusNowPV = 0;

  if (policy.holdBonus && (ctx.plannedHoldBeats || 0) > 0) {
    const beats = Math.max(0, ctx.plannedHoldBeats!);
    const vestPulse = ctx.nowPulse + beats * pulsesPerBeat;
    vestAtPulse = Math.trunc(vestPulse);

    const rawBonus = addPhiNow * policy.holdBonus.eta * (1 - Math.exp(-policy.holdBonus.rho * beats));
    bonusPhiAtVest = Math.min(rawBonus, addPhiNow * policy.holdBonus.capMultiple);

    // Present value using the same Kai-local discount
    const disc = 1 / (1 + Math.max(0, vestAtPulse - ctx.nowPulse) / PULSES_PER_DAY_EXACT);
    bonusNowPV = q(bonusPhiAtVest * disc);
  }

  const valuePhiBefore = q(1 * premium + inputs.pv_phi);
  const valuePhiAfterPV = q(valuePhiBefore + addPhiNow + bonusNowPV);

  // Vow lock (deterministic narrative; actual accounting in backend)
  const vow = policy.vow && vestAtPulse
    ? {
        earlyUnlockPenalty: policy.vow.earlyUnlockPenalty,
        stewardEpochBeats: policy.vow.stewardEpochBeats,
        stewardSpreadBeats: policy.vow.stewardSpreadBeats
      }
    : null;

  return {
    // headline
    phiPerUsd,
    usdPerPhi: phiPerUsd > 0 ? q(1 / phiPerUsd) : Infinity,
    addPhiNow,

    // state for UI / logs
    issuanceMultiplier,
    multipliers: {
      M_adoption, M_premium, M_moment, sizeMultiplier, M_streak, M_tier,
      M_choir, M_breath, M_festival, M_milestone, M_taper
    },

    // holding
    hold: vestAtPulse ? { vestAtPulse, bonusPhiAtVest: q(bonusPhiAtVest), bonusNowPV } : null,
    vow,

    // valuation context (read-only)
    premium,
    rarityFloor: inputs.rarityFloor,
    adoption,
    rarityScore,
    pulsesPerBeat,

    // milestone lookahead
    nextMilestone,

    // value snapshots
    valuePhiBefore,
    valuePhiAfterPV,

    // ledger entries you can append to meta.ip.expectedCashflowPhi
    ipEntries: [
      { atPulse: ctx.nowPulse, amountPhi: addPhiNow },
      ...(vestAtPulse ? [{ atPulse: vestAtPulse, amountPhi: q(bonusPhiAtVest) }] : [])
    ],
  };
}

/* -------------------------------- explainers -------------------------------- */

export function explainIssuance(qt: ReturnType<typeof quotePhiForUsd>) {
  const f = (x: number) => x.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
  const chip = (k: string, v: number) => `${k} ×${f(v)}`;
  const next =
    qt.nextMilestone
      ? `Next milestone: ${qt.nextMilestone.kind} @ ${qt.nextMilestone.at} → ×${f(qt.nextMilestone.multiplier)}`
      : `Next milestone: none`;

  const holdLine = qt.hold
    ? `Hold bonus (vest @ pulse ${qt.hold.vestAtPulse}): +${f(qt.hold.bonusPhiAtVest)} Φ  (PV now ${f(qt.hold.bonusNowPV)} Φ)`
    : `Hold bonus: none`;

  const vowLine = qt.vow
    ? `Vow lock: early unlock burns ${Math.round(qt.vow.earlyUnlockPenalty * 100)}% of *unvested* bonus to Steward Pool.`
    : `Vow lock: none`;

  return [
    `Φ per $: ${f(qt.phiPerUsd)}  (≈ $/Φ ${f(qt.usdPerPhi)})  • multiplier=${f(qt.issuanceMultiplier)}`,
    chip("adoption", qt.multipliers.M_adoption),
    chip("premium", qt.multipliers.M_premium),
    chip("moment",  qt.multipliers.M_moment),
    chip("size",    qt.multipliers.sizeMultiplier),
    chip("streak",  qt.multipliers.M_streak),
    chip("tier",    qt.multipliers.M_tier),
    chip("choir",   qt.multipliers.M_choir),
    chip("breath",  qt.multipliers.M_breath),
    chip("festival",qt.multipliers.M_festival),
    chip("milestone",qt.multipliers.M_milestone),
    `Inhale now: +${f(qt.addPhiNow)} Φ (as IP)`,
    holdLine,
    vowLine,
    `Value before: ${f(qt.valuePhiBefore)} Φ → after (PV): ${f(qt.valuePhiAfterPV)} Φ`,
    next
  ].join("\n");
}

/* ----------------------------- live time series ----------------------------- */

export function buildExchangeSeries(
  baseCtx: Omit<IssuanceContext, "nowPulse" | "usd"> & { usdSample?: number },
  policy: IssuancePolicy,
  startPulse: number,
  endPulse: number,
  step: number
) {
  const usdSample = Math.max(1, baseCtx.usdSample ?? 100);
  const pts: Array<{
    pulse: number;
    phiPerUsd: number;
    usdPerPhi: number;
    milestone?: NextMilestone; // if a milestone is hit at this pulse
    choirActive?: boolean;
    festivalActive?: boolean;
  }> = [];

  const stepSize = Math.max(1, Math.trunc(step));
  for (let p = Math.trunc(startPulse); p <= Math.trunc(endPulse); p += stepSize) {
    const q = quotePhiForUsd({ ...baseCtx, nowPulse: p, usd: usdSample }, policy);
    const atMilestone =
      (policy.milestones?.pulse?.some(m => m.atPulse === p)) ||
      (phiTransitionIndexFromPulse(p) !== null &&
        policy.milestones?.phiTransition?.some(m => {
          const n = phiTransitionIndexFromPulse(p);
          return n != null && m.atN === n;
        }));

    pts.push({
      pulse: p,
      phiPerUsd: q.phiPerUsd,
      usdPerPhi: q.usdPerPhi,
      milestone: atMilestone ? q.nextMilestone : undefined,
      choirActive: (q.multipliers.M_choir > 1.0),
      festivalActive: (q.multipliers.M_festival > 1.0)
    });
  }
  return pts;
}

/* ---------------------------- compact UI summaries -------------------------- */

export function composeHud(qt: Quote) {
  // Minimal, UI-friendly snapshot for a live HUD
  return {
    price: { phiPerUsd: qt.phiPerUsd, usdPerPhi: qt.usdPerPhi },
    chips: {
      adoption: qt.multipliers.M_adoption,
      premium: qt.multipliers.M_premium,
      moment:  qt.multipliers.M_moment,
      size:    qt.multipliers.sizeMultiplier,
      streak:  qt.multipliers.M_streak,
      tier:    qt.multipliers.M_tier,
      choir:   qt.multipliers.M_choir,
      breath:  qt.multipliers.M_breath,
      festival:qt.multipliers.M_festival,
      milestone: qt.multipliers.M_milestone
    },
    vow: qt.vow,
    hold: qt.hold,
    nextMilestone: qt.nextMilestone,
    context: {
      premium: qt.premium,
      adoption: qt.adoption,
      rarityScore: qt.rarityScore
    }
  };
}

/* ------------------------------- simple badges ------------------------------ */

export type EarnedBadge =
  | "FIB-CLAIM"
  | "PAL-TX"
  | "CHOIR-5"
  | "VOW-FULFILLED"
  | "STEWARD-STAR";

export function deriveBadges(
  claimPulse: number,
  choirCountInWindow: number,
  medianHoldBeats: number,
  vowFulfilled: boolean
): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  // Fibonacci claim?
  if (isFibonacciExact(claimPulse)) out.push("FIB-CLAIM");
  // Palindrome claim?
  const s = Math.abs(Math.trunc(claimPulse)).toString();
  if (s.length > 1 && s === s.split("").reverse().join("")) out.push("PAL-TX");
  if (choirCountInWindow >= 5) out.push("CHOIR-5");
  if (vowFulfilled) out.push("VOW-FULFILLED");
  if (medianHoldBeats >= 34) out.push("STEWARD-STAR");
  return out;
}

// exact Fibonacci test (copy kept local for badges)
function isFibonacciExact(pulse: number): boolean {
  if (!Number.isFinite(pulse) || pulse < 0) return false;
  const n = BigInt(Math.trunc(Math.abs(pulse)));
  const a = 5n * n * n + 4n;
  const b = 5n * n * n - 4n;
  return isPerfectSquareBig(a) || isPerfectSquareBig(b);
}
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n, x1 = (n >> 1n) + 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}
function isPerfectSquareBig(n: bigint): boolean {
  if (n < 0n) return false;
  const r = bigintSqrt(n);
  return r * r === n;
}

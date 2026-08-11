export const ARENA_RATING_POLICY = Object.freeze({
  id: "wilds.arena.rating.glicko2.v1",
  scale: 173.7178,
  systemRating: 1500,
  initialDeviation: 350,
  minimumRating: 100,
  maximumRating: 3000,
  minimumDeviation: 30,
  maximumDeviation: 350,
  defaultVolatility: 0.06,
  minimumVolatility: 0.03,
  maximumVolatility: 0.12,
  tau: 0.5,
  convergence: 0.000001,
  periodUPulses: 10_000_000,
} as const);

export type ArenaRatingProfile = Readonly<{
  schema: "receiz.wilds.arena_rating_profile.v1";
  policyId: typeof ARENA_RATING_POLICY.id;
  playerId: string;
  rating: number;
  deviation: number;
  volatility: number;
  lastSettledUPulse: number;
  settlementDigests: readonly string[];
}>;

export type ArenaRatingSettlement = Readonly<{
  schema: "receiz.wilds.arena_rating_settlement.v1";
  mode: "ranked";
  authority: "global";
  publication: "published";
  publicationRevision: number;
  receiptDigest: string;
  definitionDigest: string;
  rulesetDigest: string;
  playerId: string;
  opponentId: string;
  opponentRating: number;
  opponentDeviation: number;
  playerScore: 0 | 0.5 | 1;
  settledUPulse: number;
}>;

export type ArenaRatingSettlementVerifier = (settlement: ArenaRatingSettlement) => boolean;
export type ArenaDivisionId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "legend";
export type ArenaDivision = Readonly<{ id: ArenaDivisionId; division: 1 | 2 | 3; points: number }>;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ID_PATTERN = /^[a-z0-9:._-]{1,160}$/i;
const SCORE_VALUES: readonly number[] = [0, 0.5, 1];

function round(value: number) {
  return Number(value.toFixed(6));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeUPulse(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function createArenaRatingProfile(
  playerId: string,
  initial: Partial<Pick<ArenaRatingProfile, "rating" | "deviation" | "volatility" | "lastSettledUPulse">> = {},
): ArenaRatingProfile {
  const rating = initial.rating ?? ARENA_RATING_POLICY.systemRating;
  const deviation = initial.deviation ?? ARENA_RATING_POLICY.initialDeviation;
  const volatility = initial.volatility ?? ARENA_RATING_POLICY.defaultVolatility;
  const lastSettledUPulse = initial.lastSettledUPulse ?? 0;
  if (!ID_PATTERN.test(playerId)
    || !Number.isFinite(rating) || rating < ARENA_RATING_POLICY.minimumRating || rating > ARENA_RATING_POLICY.maximumRating
    || !Number.isFinite(deviation) || deviation < ARENA_RATING_POLICY.minimumDeviation || deviation > ARENA_RATING_POLICY.maximumDeviation
    || !Number.isFinite(volatility) || volatility < ARENA_RATING_POLICY.minimumVolatility || volatility > ARENA_RATING_POLICY.maximumVolatility
    || !safeUPulse(lastSettledUPulse)) {
    throw new Error("arena_rating_profile_invalid");
  }
  return {
    schema: "receiz.wilds.arena_rating_profile.v1",
    policyId: ARENA_RATING_POLICY.id,
    playerId,
    rating: round(rating),
    deviation: round(deviation),
    volatility: round(volatility),
    lastSettledUPulse,
    settlementDigests: [],
  };
}

function validateProfile(profile: ArenaRatingProfile) {
  if (profile.schema !== "receiz.wilds.arena_rating_profile.v1" || profile.policyId !== ARENA_RATING_POLICY.id
    || !ID_PATTERN.test(profile.playerId) || !safeUPulse(profile.lastSettledUPulse)
    || !Number.isFinite(profile.rating) || profile.rating < ARENA_RATING_POLICY.minimumRating || profile.rating > ARENA_RATING_POLICY.maximumRating
    || !Number.isFinite(profile.deviation) || profile.deviation < ARENA_RATING_POLICY.minimumDeviation || profile.deviation > ARENA_RATING_POLICY.maximumDeviation
    || !Number.isFinite(profile.volatility) || profile.volatility < ARENA_RATING_POLICY.minimumVolatility || profile.volatility > ARENA_RATING_POLICY.maximumVolatility
    || profile.settlementDigests.some((value) => !DIGEST_PATTERN.test(value))) {
    throw new Error("arena_rating_profile_invalid");
  }
}

function validateSettlement(profile: ArenaRatingProfile, settlement: ArenaRatingSettlement, verifier: ArenaRatingSettlementVerifier, currentUPulse: number) {
  if (settlement.schema !== "receiz.wilds.arena_rating_settlement.v1" || settlement.mode !== "ranked"
    || settlement.authority !== "global" || settlement.publication !== "published"
    || !Number.isSafeInteger(settlement.publicationRevision) || settlement.publicationRevision < 1
    || !DIGEST_PATTERN.test(settlement.receiptDigest) || !DIGEST_PATTERN.test(settlement.definitionDigest) || !DIGEST_PATTERN.test(settlement.rulesetDigest)
    || settlement.playerId !== profile.playerId || !ID_PATTERN.test(settlement.opponentId) || settlement.opponentId === settlement.playerId
    || !Number.isFinite(settlement.opponentRating) || settlement.opponentRating < ARENA_RATING_POLICY.minimumRating || settlement.opponentRating > ARENA_RATING_POLICY.maximumRating
    || !Number.isFinite(settlement.opponentDeviation) || settlement.opponentDeviation < ARENA_RATING_POLICY.minimumDeviation || settlement.opponentDeviation > ARENA_RATING_POLICY.maximumDeviation
    || !SCORE_VALUES.includes(settlement.playerScore) || !safeUPulse(settlement.settledUPulse)) {
    throw new Error("arena_rating_settlement_invalid");
  }
  if (settlement.settledUPulse < profile.lastSettledUPulse) throw new Error("arena_rating_settlement_stale");
  if (settlement.settledUPulse > currentUPulse) throw new Error("arena_rating_settlement_future");
  if (!verifier(settlement)) throw new Error("arena_rating_settlement_unverified");
}

function g(phi: number) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, opponentMu: number, opponentPhi: number) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function nextVolatility(phi: number, delta: number, variance: number, volatility: number) {
  const tauSquared = ARENA_RATING_POLICY.tau ** 2;
  const alpha = Math.log(volatility ** 2);
  const f = (x: number) => {
    const exponential = Math.exp(x);
    return (exponential * (delta ** 2 - phi ** 2 - variance - exponential))
      / (2 * (phi ** 2 + variance + exponential) ** 2) - (x - alpha) / tauSquared;
  };
  let lower = alpha;
  let upper: number;
  if (delta ** 2 > phi ** 2 + variance) {
    upper = Math.log(delta ** 2 - phi ** 2 - variance);
  } else {
    let k = 1;
    while (f(alpha - k * ARENA_RATING_POLICY.tau) < 0) k += 1;
    upper = alpha - k * ARENA_RATING_POLICY.tau;
  }
  let fLower = f(lower);
  let fUpper = f(upper);
  while (Math.abs(upper - lower) > ARENA_RATING_POLICY.convergence) {
    const candidate = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fCandidate = f(candidate);
    if (fCandidate * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = candidate;
    fUpper = fCandidate;
  }
  return clamp(Math.exp(lower / 2), ARENA_RATING_POLICY.minimumVolatility, ARENA_RATING_POLICY.maximumVolatility);
}

function inactivityDeviation(profile: ArenaRatingProfile, currentUPulse: number) {
  const periods = Math.max(1, Math.floor((currentUPulse - profile.lastSettledUPulse) / ARENA_RATING_POLICY.periodUPulses));
  const phi = profile.deviation / ARENA_RATING_POLICY.scale;
  return clamp(
    Math.sqrt(phi * phi + profile.volatility * profile.volatility * periods) * ARENA_RATING_POLICY.scale,
    ARENA_RATING_POLICY.minimumDeviation,
    ARENA_RATING_POLICY.maximumDeviation,
  );
}

export function applyArenaRatingPeriod(
  profile: ArenaRatingProfile,
  settlements: readonly ArenaRatingSettlement[],
  verifySettlement: ArenaRatingSettlementVerifier,
  currentUPulse = settlements.reduce((latest, value) => Math.max(latest, value.settledUPulse), profile.lastSettledUPulse),
): ArenaRatingProfile {
  validateProfile(profile);
  if (!safeUPulse(currentUPulse) || currentUPulse < profile.lastSettledUPulse) throw new Error("arena_rating_period_invalid");
  for (const settlement of settlements) validateSettlement(profile, settlement, verifySettlement, currentUPulse);
  const existing = new Set(profile.settlementDigests);
  const unseen = settlements.filter((value) => !existing.has(value.receiptDigest))
    .sort((left, right) => left.settledUPulse - right.settledUPulse || (left.receiptDigest < right.receiptDigest ? -1 : left.receiptDigest > right.receiptDigest ? 1 : 0));
  if (unseen.length === 0 && settlements.length > 0) return profile;
  if (unseen.length === 0 && currentUPulse - profile.lastSettledUPulse < ARENA_RATING_POLICY.periodUPulses) return profile;
  const periodDigests = new Set<string>();
  for (const settlement of unseen) {
    if (periodDigests.has(settlement.receiptDigest)) throw new Error("arena_rating_settlement_duplicate");
    periodDigests.add(settlement.receiptDigest);
  }
  const expandedDeviation = inactivityDeviation(profile, currentUPulse);
  if (unseen.length === 0) {
    return { ...profile, deviation: round(expandedDeviation), lastSettledUPulse: currentUPulse };
  }

  const mu = (profile.rating - ARENA_RATING_POLICY.systemRating) / ARENA_RATING_POLICY.scale;
  const phi = profile.deviation / ARENA_RATING_POLICY.scale;
  let varianceDenominator = 0;
  let outcomeSum = 0;
  for (const result of unseen) {
    const opponentMu = (result.opponentRating - ARENA_RATING_POLICY.systemRating) / ARENA_RATING_POLICY.scale;
    const opponentPhi = result.opponentDeviation / ARENA_RATING_POLICY.scale;
    const impact = g(opponentPhi);
    const expectation = expected(mu, opponentMu, opponentPhi);
    varianceDenominator += impact * impact * expectation * (1 - expectation);
    outcomeSum += impact * (result.playerScore - expectation);
  }
  const variance = 1 / varianceDenominator;
  const delta = variance * outcomeSum;
  const volatility = nextVolatility(phi, delta, variance, profile.volatility);
  const inactivityPeriods = Math.max(1, Math.floor((currentUPulse - profile.lastSettledUPulse) / ARENA_RATING_POLICY.periodUPulses));
  const phiStar = Math.sqrt(phi * phi + volatility * volatility * inactivityPeriods);
  const nextPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  const nextMu = mu + nextPhi * nextPhi * outcomeSum;
  const settlementDigests = [...profile.settlementDigests, ...unseen.map((value) => value.receiptDigest)];
  return {
    ...profile,
    rating: round(clamp(ARENA_RATING_POLICY.systemRating + ARENA_RATING_POLICY.scale * nextMu, ARENA_RATING_POLICY.minimumRating, ARENA_RATING_POLICY.maximumRating)),
    deviation: round(clamp(ARENA_RATING_POLICY.scale * nextPhi, ARENA_RATING_POLICY.minimumDeviation, ARENA_RATING_POLICY.maximumDeviation)),
    volatility: round(volatility),
    lastSettledUPulse: currentUPulse,
    settlementDigests,
  };
}

const DIVISION_THRESHOLDS: readonly Readonly<{ id: ArenaDivisionId; minimum: number; step: number }>[] = [
  { id: "legend", minimum: 2500, step: 1 },
  { id: "master", minimum: 2200, step: 100 },
  { id: "diamond", minimum: 1900, step: 100 },
  { id: "platinum", minimum: 1600, step: 100 },
  { id: "gold", minimum: 1300, step: 100 },
  { id: "silver", minimum: 1000, step: 100 },
  { id: "bronze", minimum: 0, step: 400 },
];

export function projectArenaDivision(skill: Readonly<{ rating: number; deviation: number }>): ArenaDivision {
  if (!Number.isFinite(skill.rating) || !Number.isFinite(skill.deviation) || skill.deviation < 0) throw new Error("arena_rating_projection_invalid");
  const points = Math.round(clamp(skill.rating - 2 * skill.deviation, 0, ARENA_RATING_POLICY.maximumRating));
  const tier = DIVISION_THRESHOLDS.find((value) => points >= value.minimum)!;
  const division = tier.id === "legend" ? 1 : clamp(3 - Math.floor((points - tier.minimum) / tier.step), 1, 3) as 1 | 2 | 3;
  return { id: tier.id, division, points };
}

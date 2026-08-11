import type { KaiKlokMoment, KaiMomentAuthority } from "./kai-klok-moment";

export type KaiTemporalRoot = Readonly<{
  schema: "receiz.wildz.kai_temporal_root.v1";
  authority: KaiMomentAuthority;
  /** Exact integer Kai micro-pulse since Genesis. This is the primary time axis. */
  uPulse: number;
  /** Coarse Kai pulse retained for display and compatibility. */
  pulse: number;
  /** Causal ordering for multiple admitted appends inside one uPulse. */
  sequence: number;
  coordinate: string;
  /** Descriptive interoperability metadata. Never used for authoritative ordering. */
  observedAt?: string;
}>;

function assertSafeWhole(value: number, code: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function canonicalIso(value: string) {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

const KAI_AUTHORITIES = new Set<KaiMomentAuthority>(["admitted", "world", "local"]);

export function verifyKaiTemporalRoot(value: KaiTemporalRoot) {
  if (value.schema !== "receiz.wildz.kai_temporal_root.v1") throw new Error("wilds_kai_temporal_schema_invalid");
  if (!KAI_AUTHORITIES.has(value.authority)) throw new Error("wilds_kai_temporal_authority_invalid");
  assertSafeWhole(value.uPulse, "wilds_kai_temporal_upulse_invalid");
  assertSafeWhole(value.pulse, "wilds_kai_temporal_pulse_invalid");
  if (value.pulse !== Math.floor(value.uPulse / 1_000_000)) throw new Error("wilds_kai_temporal_pulse_invalid");
  assertSafeWhole(value.sequence, "wilds_kai_temporal_sequence_invalid");
  if (!value.coordinate || value.coordinate.length > 160) throw new Error("wilds_kai_temporal_coordinate_invalid");
  if (value.observedAt !== undefined && !canonicalIso(value.observedAt)) throw new Error("wilds_kai_temporal_observed_at_invalid");
  return value;
}

export function createKaiTemporalRoot(
  moment: Pick<KaiKlokMoment, "authority" | "uPulse" | "pulse" | "coordinate">,
  options: { sequence?: number; observedAt?: string } = {}
): KaiTemporalRoot {
  return verifyKaiTemporalRoot({
    schema: "receiz.wildz.kai_temporal_root.v1",
    authority: moment.authority,
    uPulse: moment.uPulse,
    pulse: moment.pulse,
    sequence: options.sequence ?? 0,
    coordinate: moment.coordinate,
    ...(options.observedAt === undefined ? {} : { observedAt: options.observedAt })
  });
}

export function assertCanonicalKaiTemporalRoot(root: KaiTemporalRoot) {
  verifyKaiTemporalRoot(root);
  if (root.authority === "local") throw new Error("wilds_kai_temporal_authority_invalid");
  return root;
}

export function compareKaiTemporalRoots(left: KaiTemporalRoot, right: KaiTemporalRoot): -1 | 0 | 1 {
  verifyKaiTemporalRoot(left);
  verifyKaiTemporalRoot(right);
  if (left.uPulse !== right.uPulse) return left.uPulse < right.uPulse ? -1 : 1;
  if (left.sequence !== right.sequence) return left.sequence < right.sequence ? -1 : 1;
  return 0;
}

export function latestKaiTemporalRoot(left: KaiTemporalRoot, right: KaiTemporalRoot) {
  const order = compareKaiTemporalRoots(left, right);
  if (order < 0) return right;
  if (order > 0) return left;
  if (left.authority !== right.authority || left.pulse !== right.pulse || left.coordinate !== right.coordinate) {
    throw new Error("wilds_kai_temporal_slot_conflict");
  }
  return left;
}

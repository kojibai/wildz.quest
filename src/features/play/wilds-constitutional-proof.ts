import { WildsWorldService, type WildsWorldAuthority, type WildsWorldCommand } from "./wilds-world-service";
import { checkpointWildsWorld, type WildsWorldProjection, type WildsWorldCheckpoint } from "./wilds-world-state";
import { constitutionalDigest, WILDS_CONSTITUTION, type ConstitutionalDecision } from "./wilds-constitution";
import type { WildsWorldEvent } from "./wilds-world-event";

export type WildsConstitutionalProof = Readonly<{
  schema: "wildz.constitutional-transition-proof.v1";
  constitution: typeof WILDS_CONSTITUTION;
  source: WildsWorldCheckpoint;
  command: WildsWorldCommand;
  executionContext: WildsWorldAuthority;
  events: readonly WildsWorldEvent[];
  decision: ConstitutionalDecision;
}>;
/** Source authentication is deliberately separate from deterministic replay and digest integrity. */
export function exportWildsConstitutionalProof(source: WildsWorldProjection, command: WildsWorldCommand, authority: WildsWorldAuthority): WildsConstitutionalProof {
  const checkpoint = checkpointWildsWorld(source);
  const result = new WildsWorldService({ checkpoint }).execute(command, authority);
  return { schema: "wildz.constitutional-transition-proof.v1", constitution: WILDS_CONSTITUTION, source: checkpoint, command, executionContext: authority, events: result.events, decision: result.constitution };
}
export function verifyWildsConstitutionalProof(proof: WildsConstitutionalProof, acceptedSource: WildsWorldCheckpoint) {
  try {
    if (proof.schema !== "wildz.constitutional-transition-proof.v1" || constitutionalDigest(proof.constitution) !== constitutionalDigest(WILDS_CONSTITUTION)) return { valid: false, reason: "CONSTITUTION_MISMATCH" };
    if (constitutionalDigest(proof.source) !== constitutionalDigest(acceptedSource)) return { valid: false, reason: "SOURCE_AUTHORITY_UNPROVEN" };
    const replay = new WildsWorldService({ checkpoint: acceptedSource }).execute(proof.command, proof.executionContext);
    if (constitutionalDigest(replay.events) !== constitutionalDigest(proof.events) || constitutionalDigest(replay.constitution) !== constitutionalDigest(proof.decision)) return { valid: false, reason: "DERIVATION_MISMATCH" };
    return { valid: true, reason: "SOURCE_RELATIVE_TRANSITION_VERIFIED", successor: replay.projection };
  } catch (error) { return { valid: false, reason: error instanceof Error ? error.message : "UNRESOLVED" }; }
}

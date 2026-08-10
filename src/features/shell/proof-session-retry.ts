export type ProofSessionRetryInput = {
  attempt: number;
  online: boolean;
  code: string;
};

export type ProofSessionRetryDecision =
  | { retry: true; delayMs: number }
  | { retry: false; delayMs: null };

export function proofSessionRetryDecision(input: ProofSessionRetryInput): ProofSessionRetryDecision {
  if (!input.online || input.code === "wildz_proof_admission_failed") {
    return { retry: false, delayMs: null };
  }
  return {
    retry: true,
    delayMs: Math.min(60_000, 5_000 * 2 ** Math.max(0, input.attempt))
  };
}

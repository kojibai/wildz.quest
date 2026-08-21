export type ProofSessionRetryInput = {
  attempt: number;
  online: boolean;
  code: string;
};

export type ProofSessionRetryDecision =
  | { retry: true; delayMs: number }
  | { retry: false; delayMs: null };

export function proofSessionRetryDecision(input: ProofSessionRetryInput): ProofSessionRetryDecision {
  void input;
  return { retry: false, delayMs: null };
}

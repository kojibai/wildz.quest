import { ReceizHttpError } from "@receiz/sdk";

const SAFE_RECEIZ_CODE = /^[A-Z][A-Z0-9_]{2,80}$/;

function safeCode(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return SAFE_RECEIZ_CODE.test(normalized) ? normalized : undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["code", "error", "message"]) {
    const direct = safeCode(record[key]);
    if (direct) return direct;
  }
  return undefined;
}

export function receizHttpFailureCode(cause: unknown) {
  if (!(cause instanceof ReceizHttpError)) return undefined;
  return safeCode(cause.payload);
}

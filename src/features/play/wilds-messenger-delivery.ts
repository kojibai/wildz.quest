export class WildsMessageZeroWriteError extends Error {
  readonly writesOnFailure = 0;
}

export function wildsMessageRequestFailure(value: unknown): Error {
  const result = value && typeof value === "object" ? value as { error?: unknown; writesOnFailure?: unknown } : null;
  const code = typeof result?.error === "string" ? result.error : "wilds_message_request_failed";
  const message = code === "receiz_recipient_binding_unavailable"
    ? "The verified recipient identity is unavailable. No creature offer was issued."
    : code === "wilds_recipient_binding_invalid"
      ? "The recipient's verified identity does not match this username. No creature offer was issued."
      : code;
  return result?.writesOnFailure === 0 ? new WildsMessageZeroWriteError(message) : Error(message);
}

export function assertWildsPrivateMessagePublished(value: unknown) {
  const result = value && typeof value === "object" ? value as { published?: unknown; mode?: unknown } : null;
  if (result?.published !== true || result.mode !== "receiz_synced") throw Error("wilds_private_delivery_pending");
}

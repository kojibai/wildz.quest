import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identityPort(adapter: unknown) {
  return record(adapter) && record(adapter.wildzWorld) ? adapter.wildzWorld
    : record(adapter) && record(adapter.client) && record(adapter.client.wildzWorld) ? adapter.client.wildzWorld : null;
}

export function hasWildsVerifiedRecipientIdentityResolver(adapter: unknown) {
  return typeof identityPort(adapter)?.resolveRecipientIdentity === "function";
}

/** The source rail must authenticate the account behind a handle. A handle is never a native actor ID. */
export async function resolveWildsVerifiedRecipientIdentity(
  adapter: unknown,
  profileHandle: string,
  codes = { unavailable: "receiz_recipient_binding_unavailable", invalid: "wilds_recipient_binding_invalid" }
): Promise<string> {
  const target = parseWildzPlayerCoordinate(profileHandle);
  if (!target) throw Error(codes.invalid);
  const port = identityPort(adapter);
  if (!port || typeof port.resolveRecipientIdentity !== "function") throw Error(codes.unavailable);
  const result: unknown = await port.resolveRecipientIdentity.call(port, { profileHandle: target.profileHandle });
  if (!record(result) || result.verified !== true || typeof result.receizActorId !== "string" || !result.receizActorId
    || typeof result.profileHandle !== "string" || !sameWildzPlayerCoordinate(result.profileHandle, target.profileHandle)) throw Error(codes.invalid);
  return result.receizActorId;
}

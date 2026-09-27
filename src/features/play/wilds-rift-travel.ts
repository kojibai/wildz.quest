import { parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

const WILDS_WORLD_COORDINATE_LIMIT = 1_000_000;

export type RiftTravelRequest = {
  idempotencyKey: string;
  source: { x: number; z: number };
  destination: { x: number; z: number };
};

export type RiftTravelGrant = {
  grantId: string;
  playerId: string;
  destination: { x: number; z: number };
  kaiPulse: string;
  kaiKlok: `kai:${string}`;
  state: "authorized";
};

export type RiftTravelAuthority = {
  playerId: string;
  coordinationPulse: string;
  locked: boolean;
};

type RiftTravelError =
  | "wilds_rift_activity_locked"
  | "wilds_rift_actor_mismatch"
  | "wilds_rift_grant_invalid"
  | "wilds_rift_idempotency_invalid"
  | "wilds_rift_position_invalid";

function validCoordinate(position: { x: number; z: number }) {
  return [position.x, position.z].every((coordinate) => (
    Number.isFinite(coordinate) && Math.abs(coordinate) <= WILDS_WORLD_COORDINATE_LIMIT
  ));
}

export function bossTerritoryApproachPoint(boss: { position: { x: number; z: number }; territoryRadius: number; seedDigest: string }) {
  const digest = sha256PortableBasis(`${boss.seedDigest}:rift-approach`);
  const angle = (Number.parseInt(digest.slice(7, 15), 16) / 0xffffffff) * Math.PI * 2;
  const distance = Math.max(1, boss.territoryRadius) + 8;
  return { x: boss.position.x + Math.cos(angle) * distance, z: boss.position.z + Math.sin(angle) * distance };
}

export function authorizeRiftTravel(
  request: RiftTravelRequest,
  authority: RiftTravelAuthority
): { ok: true; grant: RiftTravelGrant } | { ok: false; error: RiftTravelError } {
  if (authority.locked) return { ok: false, error: "wilds_rift_activity_locked" };
  if (!/^[a-z0-9:-]{6,96}$/i.test(request.idempotencyKey)) {
    return { ok: false, error: "wilds_rift_idempotency_invalid" };
  }
  if (!validCoordinate(request.source) || !validCoordinate(request.destination)) {
    return { ok: false, error: "wilds_rift_position_invalid" };
  }
  if (!/^[a-z0-9:._-]{1,128}$/i.test(authority.coordinationPulse)) return { ok: false, error: "wilds_rift_grant_invalid" };
  const digest = sha256PortableBasis(canonicalPortableCardJson({
    playerId: authority.playerId,
    idempotencyKey: request.idempotencyKey,
    source: request.source,
    destination: request.destination,
    coordinationPulse: authority.coordinationPulse,
    transition: "authorized"
  }));
  const kaiPulse = BigInt(`0x${digest.slice(7, 23)}`).toString(10);
  return {
    ok: true,
    grant: {
      grantId: `rift:${digest.slice(7, 39)}`,
      playerId: authority.playerId,
      destination: { ...request.destination },
      kaiPulse,
      kaiKlok: `kai:${kaiPulse}`,
      state: "authorized"
    }
  };
}

export function validateRiftGrant(
  grant: RiftTravelGrant,
  authority: { playerId: string }
): { ok: true } | { ok: false; error: RiftTravelError } {
  if (!grant || !/^rift:[a-f0-9]{32}$/.test(grant.grantId) || !validCoordinate(grant.destination)
    || !/^\d{1,32}$/.test(grant.kaiPulse) || grant.kaiKlok !== `kai:${grant.kaiPulse}` || grant.state !== "authorized") {
    return { ok: false, error: "wilds_rift_grant_invalid" };
  }
  if (grant.playerId !== authority.playerId) return { ok: false, error: "wilds_rift_actor_mismatch" };
  return { ok: true };
}

export type RiftTravelRequestV11 = Readonly<{
  idempotencyKey: string;
  source: WildsWorldAddress;
  destination: WildsWorldAddress;
}>;

export type RiftTravelGrantV11 = Readonly<{
  version: 11;
  grantId: string;
  playerId: string;
  destination: WildsWorldAddress;
  kaiPulse: string;
  kaiKlok: `kai:${string}`;
  state: "authorized";
}>;

/** A v11 Rift names both exact endpoints; ordinary movement stays speed-limited. */
export function authorizeRiftTravelV11(
  request: RiftTravelRequestV11,
  authority: RiftTravelAuthority
): { ok: true; grant: RiftTravelGrantV11 } | { ok: false; error: RiftTravelError } {
  if (authority.locked) return { ok: false, error: "wilds_rift_activity_locked" };
  if (!/^[a-z0-9:-]{6,96}$/i.test(request.idempotencyKey)) return { ok: false, error: "wilds_rift_idempotency_invalid" };
  let source: WildsWorldAddress;
  let destination: WildsWorldAddress;
  try {
    source = parseWildsWorldAddress(request.source);
    destination = parseWildsWorldAddress(request.destination);
  } catch {
    return { ok: false, error: "wilds_rift_position_invalid" };
  }
  if (!/^[a-z0-9:._-]{1,128}$/i.test(authority.coordinationPulse)) return { ok: false, error: "wilds_rift_grant_invalid" };
  const digest = sha256PortableBasis(canonicalPortableCardJson({
    version: 11,
    playerId: authority.playerId,
    idempotencyKey: request.idempotencyKey,
    source,
    destination,
    coordinationPulse: authority.coordinationPulse,
    transition: "authorized"
  }));
  const kaiPulse = BigInt(`0x${digest.slice(7, 23)}`).toString(10);
  return { ok: true, grant: {
    version: 11,
    grantId: `rift:${digest.slice(7, 39)}`,
    playerId: authority.playerId,
    destination,
    kaiPulse,
    kaiKlok: `kai:${kaiPulse}`,
    state: "authorized"
  } };
}

export function validateRiftGrantV11(
  grant: RiftTravelGrantV11,
  authority: { playerId: string }
): { ok: true } | { ok: false; error: RiftTravelError } {
  if (!grant || grant.version !== 11 || !/^rift:[a-f0-9]{32}$/.test(grant.grantId)
    || !/^\d{1,32}$/.test(grant.kaiPulse) || grant.kaiKlok !== `kai:${grant.kaiPulse}` || grant.state !== "authorized") {
    return { ok: false, error: "wilds_rift_grant_invalid" };
  }
  try { parseWildsWorldAddress(grant.destination); }
  catch { return { ok: false, error: "wilds_rift_grant_invalid" }; }
  if (grant.playerId !== authority.playerId) return { ok: false, error: "wilds_rift_actor_mismatch" };
  return { ok: true };
}

/** Temporary local transport boundary until cross-region admission is verified. */
export function isLocallyAdmittedRiftDestinationV11(sourceValue: WildsWorldAddress, destinationValue: WildsWorldAddress): boolean {
  const source = parseWildsWorldAddress(sourceValue);
  const destination = parseWildsWorldAddress(destinationValue);
  return source.regionX === destination.regionX && source.regionZ === destination.regionZ;
}

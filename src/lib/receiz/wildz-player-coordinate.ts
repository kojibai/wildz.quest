export type WildzPlayerCoordinate = {
  actorId: string;
  profileHandle: string;
};

const RECEIZ_PROFILE_SUFFIX = ".receiz.id";
const RECEIZ_PROFILE_USERNAME = /^[a-z0-9_]{3,30}$/;

export function parseWildzPlayerCoordinate(value: string): WildzPlayerCoordinate | null {
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!normalized) return null;
  const actorId = normalized.endsWith(RECEIZ_PROFILE_SUFFIX)
    ? normalized.slice(0, -RECEIZ_PROFILE_SUFFIX.length)
    : normalized;
  if (!RECEIZ_PROFILE_USERNAME.test(actorId)) return null;
  return { actorId, profileHandle: `${actorId}${RECEIZ_PROFILE_SUFFIX}` };
}

export function sameWildzPlayerCoordinate(left: string, right: string) {
  const leftCoordinate = parseWildzPlayerCoordinate(left);
  const rightCoordinate = parseWildzPlayerCoordinate(right);
  return Boolean(leftCoordinate && rightCoordinate && leftCoordinate.actorId === rightCoordinate.actorId);
}

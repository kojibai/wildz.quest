import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyWildsMaterialLot, type WildsMaterialLotV1 } from "./wilds-steward-construction";
import { verifyWildsResourceLot, type WildsResourceLotV1 } from "./wilds-resource-lot";
import { restoreWildsNourishmentState, type WildsFoodItem, type WildsNourishmentState } from "./wilds-nourishment";

/** Source history stays with the originating gatherer. Native custody is a separate successor. */
export type WildsResourcePackageMember =
  | Readonly<{ kind: "material"; id: string; materialLot: WildsMaterialLotV1 }>
  | Readonly<{ kind: "resource"; id: string; resourceLot: WildsResourceLotV1 }>
  | Readonly<{ kind: "food"; id: string; foodItem: WildsFoodItem; nourishment: WildsNourishmentState }>;

export type WildsResourcePackageV1 = Readonly<{
  schema: "wildz.resource-package.v1";
  packageId: string;
  ownerReceizId: string;
  createdKaiUPulse: number;
  commandId: string;
  members: readonly WildsResourcePackageMember[];
  /** This source digest alone conveys no authenticated title or sealing authority. */
  authority: "gameplay-source-records";
  head: string;
}>;

export type WildsResourcePackageInput = Readonly<{
  ownerReceizId: string;
  createdKaiUPulse: number;
  commandId: string;
  members: readonly WildsResourcePackageMember[];
}>;

export const WILDS_RESOURCE_PACKAGE_MAX_MEMBERS = 64;
export const WILDS_RESOURCE_PACKAGE_MAX_BYTES = 512 * 1024;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function verifyWildsResourcePackageMember(value: unknown): value is WildsResourcePackageMember {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const member = value as WildsResourcePackageMember;
  if (typeof member.id !== "string" || !member.id || member.id.length > 800) return false;
  if (member.kind === "material") return Object.keys(member).sort().join() === "id,kind,materialLot" && verifyWildsMaterialLot(member.materialLot) && member.id === member.materialLot.lotId;
  if (member.kind === "resource") return Object.keys(member).sort().join() === "id,kind,resourceLot" && verifyWildsResourceLot(member.resourceLot) && member.id === member.resourceLot.lotId;
  if (member.kind !== "food" || Object.keys(member).sort().join() !== "foodItem,id,kind,nourishment") return false;
  const food = member.foodItem;
  if (!food || member.id !== food.itemId || food.consumedKaiUPulse !== undefined) return false;
  const restored = restoreWildsNourishmentState(member.nourishment, food.ownerReceizId);
  return Boolean(restored && restored.items[food.itemId]
    && canonicalPortableCardJson(restored.items[food.itemId]) === canonicalPortableCardJson(food)
    && canonicalPortableCardJson(restored) === canonicalPortableCardJson(member.nourishment));
}

export function createWildsResourcePackage(input: WildsResourcePackageInput): WildsResourcePackageV1 {
  if (typeof input.ownerReceizId !== "string" || !input.ownerReceizId.trim() || input.ownerReceizId.length > 512
    || input.ownerReceizId !== input.ownerReceizId.trim() || !Number.isSafeInteger(input.createdKaiUPulse) || input.createdKaiUPulse < 0
    || typeof input.commandId !== "string" || !input.commandId || input.commandId.length > 160
    || !Array.isArray(input.members) || !input.members.length || input.members.length > WILDS_RESOURCE_PACKAGE_MAX_MEMBERS) throw Error("wilds_resource_package_invalid");
  if (new Set(input.members.map(member => member.id)).size !== input.members.length) throw Error("wilds_resource_package_duplicate");
  if (!input.members.every(verifyWildsResourcePackageMember)) throw Error("wilds_resource_package_member_invalid");
  const members = input.members.map(member => JSON.parse(canonicalPortableCardJson(member)) as WildsResourcePackageMember).sort((a,b) => a.id.localeCompare(b.id));
  const identity = sha256PortableBasis(canonicalPortableCardJson({ownerReceizId:input.ownerReceizId,commandId:input.commandId})).slice(7);
  const basis = {schema:"wildz.resource-package.v1" as const,packageId:`wildz:package:${identity}`,ownerReceizId:input.ownerReceizId,
    createdKaiUPulse:input.createdKaiUPulse,commandId:input.commandId,members,authority:"gameplay-source-records" as const};
  const result = {...basis,head:sha256PortableBasis(canonicalPortableCardJson(basis))};
  if (new TextEncoder().encode(canonicalPortableCardJson(result)).byteLength > WILDS_RESOURCE_PACKAGE_MAX_BYTES) throw Error("wilds_resource_package_too_large");
  return deepFreeze(result);
}

export function verifyWildsResourcePackage(value: unknown): value is WildsResourcePackageV1 {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as WildsResourcePackageV1;
    return canonicalPortableCardJson(createWildsResourcePackage(item)) === canonicalPortableCardJson(item);
  } catch { return false; }
}

export function wildsResourcePackageTitle(packageProof: WildsResourcePackageV1) {
  if (packageProof.members.length !== 1) return `Resource package · ${packageProof.members.length} units`;
  const member = packageProof.members[0]!;
  if (member.kind === "material") return member.materialLot.kind === "timber" ? "Timber" : member.materialLot.kind === "hay" ? "Hay" : "Stone";
  if (member.kind === "resource") return "Living Honey";
  return ({"orchard-fruit":"Wild fruit","wild-berries":"Wild berries","wild-vegetable":"Wild vegetables","wild-eggs":"Wild eggs","wild-milk":"Wild milk","wild-meat":"Wild meat"} as const)[member.foodItem.foodKind];
}

/** A source-carrying file becomes spendable only after native custody admission. */
export function serializeWildsResourcePackage(packageProof: WildsResourcePackageV1) {
  if (!verifyWildsResourcePackage(packageProof)) throw Error("wilds_resource_package_invalid");
  return canonicalPortableCardJson(packageProof);
}

export function parseWildsResourcePackage(source: string) {
  if (new TextEncoder().encode(source).byteLength > WILDS_RESOURCE_PACKAGE_MAX_BYTES) throw Error("wilds_resource_package_too_large");
  let value: unknown; try { value = JSON.parse(source); } catch { throw Error("wilds_resource_package_invalid"); }
  if (!verifyWildsResourcePackage(value)) throw Error("wilds_resource_package_invalid");
  return createWildsResourcePackage(value);
}

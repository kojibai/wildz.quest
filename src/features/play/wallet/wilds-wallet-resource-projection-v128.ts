import type { ExchangeCard } from "../WildsResourceExchange";
import type { WildsFoodKind } from "../wilds-nourishment";
import type { WildsResourcePackageMember, WildsResourcePackageV1 } from "../wilds-resource-package";
import type { WildsMaterialLotV1 } from "../wilds-steward-construction";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";

/** Compact presentation only. Native current-source admission is required to
 * use a member; neither this row nor its local signature conveys custody. */
export type WildsWalletResourceMemberRefV128 = Readonly<{
  id: string; kind: WildsResourcePackageMember["kind"];
  resourceKind: "hay" | "timber" | "stone" | "living-honey" | WildsFoodKind;
  quantity: number;
  /** Immutable source metadata for local display/selection. These records are
   * never SDK custody, and do not alter the genesis owner after a transfer. */
  materialLot?: WildsMaterialLotV1;
  resourceLot?: WildsResourceLotV1;
}>;
export type WildsWalletResourceProjectionRowV128 = Readonly<{
  schema: "wildz.wallet.resource-projection.v128";
  ownerHandle: string; keyId: string; packageId: string; packageHead: string;
  genesisOwnerHandle: string; currentOwnerHandle: string; recipientHandle: string;
  kind: "reserved" | "received" | "unpacked" | "sent";
  memberRefs: readonly WildsWalletResourceMemberRefV128[]; availableMemberIds: readonly string[];
  sourceArtifactSha256: string; sourcePayloadSha256: string;
  proofDigest: string; detailDigest: string; currentHead: string;
  custodyAppendId: string; custodySealKai: string;
}>;
export type WildsWalletResourceProjectionCardV128 = ExchangeCard & Readonly<{
  packageId: string; package: Readonly<Pick<WildsResourcePackageV1, "packageId" | "head">>;
  members: readonly WildsWalletResourceMemberRefV128[];
  ownerHandle: string; kind: WildsWalletResourceProjectionRowV128["kind"];
}>;

const labels = { hay: "Hay", timber: "Timber", stone: "Stone", "living-honey": "Living Honey", "orchard-fruit": "Wild fruit", "wild-berries": "Wild berries", "wild-vegetable": "Wild vegetables", "wild-eggs": "Wild eggs", "wild-milk": "Wild milk", "wild-meat": "Wild meat" };

export function wildsWalletResourceMemberRefV128(member: WildsResourcePackageMember): WildsWalletResourceMemberRefV128 {
  const source = member.kind === "material" ? { materialLot: immutableCopy(member.materialLot) } : member.kind === "resource" ? { resourceLot: immutableCopy(member.resourceLot) } : {};
  return Object.freeze({ id: member.id, kind: member.kind, resourceKind: member.kind === "food" ? member.foodItem.foodKind : member.kind === "material" ? member.materialLot.kind : member.resourceLot.kind, quantity: member.kind === "food" ? 1 : member.kind === "material" ? member.materialLot.quantity : member.resourceLot.quantity, ...source });
}

function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown) => { if (!item || typeof item !== "object") return; Object.freeze(item); for (const child of Object.values(item)) freeze(child); };
  freeze(copy); return copy;
}

/** No source opening or effects. This intentionally does not credit PlayState
 * or convert source custody into legacy living-world subject custody. */
export function projectWildsWalletResourceProjectionsV128(rows: readonly WildsWalletResourceProjectionRowV128[]) {
  const cards: WildsWalletResourceProjectionCardV128[] = [], lockedMemberIds = new Set<string>();
  const available = new Map<string, WildsWalletResourceMemberRefV128>(), owned = new Map<string, WildsWalletResourceMemberRefV128>();
  const availableHeads = new Map<string, string>(), observedHeads = new Map<string, Set<string>>();
  const resourceUnitCounts: Record<string, number> = {};
  for (const row of rows) {
    const own = row.currentOwnerHandle === row.ownerHandle && row.kind !== "sent";
    const summary = row.memberRefs.map(member => `${labels[member.resourceKind]} × ${member.quantity}`).join(" · ");
    cards.push(Object.freeze({ id: row.packageId, packageId: row.packageId, package: { packageId: row.packageId, head: row.packageHead }, members: row.memberRefs, ownerHandle: row.currentOwnerHandle, kind: row.kind,
      title: row.memberRefs.length === 1 ? labels[row.memberRefs[0]!.resourceKind] : `Resource package · ${row.memberRefs.length} units`, summary,
      status: row.kind === "reserved" ? "Reserved · awaiting recipient" : row.kind === "received" ? "Received · ready to unpack" : row.kind === "unpacked" ? "Contents unpacked" : "Sent",
      transferable: own && row.kind === "received", unpackable: own && (row.kind === "received" || row.kind === "unpacked"), cancellable: false,
      resourceUnits: own && (row.kind === "reserved" || row.kind === "received") ? row.memberRefs.reduce((total, member) => total + member.quantity, 0) : 0,
      unpackLabel: row.kind === "unpacked" ? "Refresh contents" : "Use contents" }));
    for (const member of row.memberRefs) {
      const coordinate = `${row.ownerHandle}:${row.currentHead}`, heads = observedHeads.get(member.id) ?? new Set<string>();
      heads.add(coordinate); observedHeads.set(member.id, heads);
      if (own && (row.kind !== "unpacked" || row.availableMemberIds.includes(member.id))) owned.set(member.id, member);
      if (own && row.kind === "unpacked" && row.availableMemberIds.includes(member.id)) { available.set(member.id, member); availableHeads.set(member.id, coordinate); }
      else lockedMemberIds.add(member.id);
    }
  }
  // Returning units can occur in several historical packages. Only a common
  // current-source coordinate can clear their old locks; conflicting cached
  // snapshots remain unavailable until explicit source qualification.
  for (const id of lockedMemberIds) {
    const heads = observedHeads.get(id)!;
    if (available.has(id) && heads.size === 1 && heads.has(availableHeads.get(id)!)) lockedMemberIds.delete(id);
    else available.delete(id);
  }
  for (const member of owned.values()) resourceUnitCounts[member.resourceKind] = (resourceUnitCounts[member.resourceKind] ?? 0) + member.quantity;
  return { cards, lockedMemberIds, resourceUnitCounts, availableMembers: [...available.values()] };
}

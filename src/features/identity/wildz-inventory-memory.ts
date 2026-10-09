import { admitLocallySealedWildsInventory, isAdmittedWildsCard } from "../play/admitted-inventory";
import type { PortableCardAsset } from "../play/portable-card";
import type { WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";

const SCHEMA = "receiz.wildz.inventory_memory.v1";
// Bump when canonical card admission rules change. Old memories then take the full verifier path once.
const VERIFIER = "wildz.card-admission.v1";
const KEY = "receiz.wildz.inventory_memory_key.v1";
type Owner = { keyId: string; actorId: string };
type Memory = Owner & { schema: typeof SCHEMA; verifier: typeof VERIFIER; kind: string; coordinates: readonly string[]; digest: string; signature: Uint8Array };
const cardDigests = new WeakMap<PortableCardAsset, Promise<string>>();
const authenticatedHeads = new WeakSet<Memory>();

export function wildzInventoryMemoryKey(owner: Owner, kind = "inventory") {
  return `${SCHEMA}:${kind}:${encodeURIComponent(owner.keyId)}:${encodeURIComponent(owner.actorId)}`;
}

function bytes(value: string) { return new TextEncoder().encode(value).buffer; }
function head(memory: Omit<Memory, "signature">) {
  return bytes(JSON.stringify([memory.schema, memory.verifier, memory.kind, memory.coordinates, memory.keyId, memory.actorId, memory.digest]));
}
function isKey(value: unknown): value is CryptoKey {
  const key = value as Partial<CryptoKey> | null;
  const algorithm = key?.algorithm as Partial<HmacKeyAlgorithm> | undefined;
  return key?.type === "secret" && key.extractable === false && algorithm?.name === "HMAC"
    && algorithm.hash?.name === "SHA-256" && algorithm.length === 256
    && key.usages?.length === 2 && key.usages.includes("sign") && key.usages.includes("verify");
}
function freeze(value: unknown, seen = new WeakSet<object>()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  Object.freeze(value);
}
function digest(value: string) {
  return crypto.subtle.digest("SHA-256", bytes(value)).then(buffer =>
    Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join(""));
}
async function inventoryDigest(inventory: readonly PortableCardAsset[]) {
  // Storage clones retain JSON field order. Reordered or changed bytes simply
  // miss this local memory and return to canonical admission, never gain authority.
  const roots = await Promise.all(inventory.map(card => {
    let pending = cardDigests.get(card);
    if (!pending) {
      pending = digest(JSON.stringify(card));
      cardDigests.set(card, pending);
      const captured = pending;
      void pending.catch(() => { if (cardDigests.get(card) === captured) cardDigests.delete(card); });
    }
    return pending;
  }));
  // Only immutable proof objects carry a cached content hash. A new/reordered
  // array recomputes its small root; movement saves never encode the archive again.
  return digest(JSON.stringify(roots));
}

/** Retain only an inventory already admitted by the actual card verifier.
 * This device-held authenticated head is an optimization, never portable authority.
 * Its bytes and key remain durable, independently of service-worker caches. */
export async function retainWildzInventoryMemory(database: WildzContinuityDatabase, owner: Owner,
  inventory: readonly PortableCardAsset[], options: { kind: "crew-custody"; coordinates: readonly string[] } | undefined = undefined) {
  if (!Array.isArray(inventory) || !inventory.every(isAdmittedWildsCard)) throw Error("wildz_inventory_memory_unadmitted");
  const captured = Object.freeze([...inventory]);
  let key = await database.read<unknown>("wrappingKeys", KEY);
  if (key === null) {
    const generated = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]);
    key = await database.transaction(["wrappingKeys"], "readwrite", async tx => {
      const current = await tx.get<unknown>("wrappingKeys", KEY);
      if (current !== null) return current;
      await tx.put("wrappingKeys", generated, KEY);
      return generated;
    });
  }
  if (!isKey(key)) throw Error("wildz_inventory_memory_key_invalid");
  const contentDigest = await inventoryDigest(captured);
  const basis = { schema: SCHEMA, verifier: VERIFIER, kind: options?.kind ?? "inventory", coordinates: [...(options?.coordinates ?? [])],
    keyId: owner.keyId, actorId: owner.actorId, digest: contentDigest } as const;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, head(basis)));
  await database.transaction(["meta"], "readwrite", tx => tx.put("meta", { ...basis, signature }, wildzInventoryMemoryKey(owner, basis.kind)));
}

export async function readWildzInventoryMemoryHead(database: WildzContinuityDatabase, owner: Owner, kind = "inventory") {
  try {
    const source = await database.read<Memory>("meta", wildzInventoryMemoryKey(owner, kind));
    if (!source || source.schema !== SCHEMA || source.verifier !== VERIFIER || source.kind !== kind || source.keyId !== owner.keyId
      || source.actorId !== owner.actorId || !/^[a-f0-9]{64}$/.test(source.digest) || !Array.isArray(source.coordinates)
      || source.coordinates.length > 1000 || source.coordinates.some(value => typeof value !== "string" || value.length > 512)
      || !(source.signature instanceof Uint8Array) || source.signature.length !== 32) return null;
    const memory = Object.freeze({ ...source, coordinates: Object.freeze([...source.coordinates]) });
    const key = await database.read<unknown>("wrappingKeys", KEY);
    if (!isKey(key) || !await crypto.subtle.verify("HMAC", key, new Uint8Array(memory.signature).buffer, head(memory))) return null;
    authenticatedHeads.add(memory);
    return memory;
  } catch { return null; }
}

export async function matchesWildzInventoryMemoryHead(memory: Memory, inventory: readonly PortableCardAsset[]) {
  if (!authenticatedHeads.has(memory)) return false;
  return await inventoryDigest(inventory) === memory.digest;
}

/** Authenticate the small previously admitted head and match the actual bytes.
 * A claimed digest/verified flag cannot replace either check. Nothing is cleared on a miss. */
export async function restoreWildzInventoryMemory(database: WildzContinuityDatabase, owner: Owner,
  inventory: PortableCardAsset[]): Promise<PortableCardAsset[] | null> {
  try {
    const memory = await readWildzInventoryMemoryHead(database, owner);
    if (!memory) return null;
    // Pin the exact bytes before asynchronous hashing; another turn cannot mutate a verified source.
    const captured = [...inventory];
    freeze(captured);
    if (!await matchesWildzInventoryMemoryHead(memory, captured)) return null;
    // Brand the cards, not the source array: normal legacy migration, causal
    // convergence and discovered-family recovery must still run below.
    admitLocallySealedWildsInventory([...captured]);
    return [...captured];
  } catch { return null; }
}

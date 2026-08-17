import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { recallStandaloneWildzCard } from "../../features/play/standalone-card-handoff";
import {
  createWildzIdentityRepository,
  wildzOwnerScope,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "./wildz-identity-repository";
import {
  createWildzContinuityDatabase,
  type WildzContinuityDatabase
} from "../storage/wildz-indexed-db";

type LocalOwnerCards = { playState: { inventory: PortableCardAsset[] } };

const localCardDatabase = createWildzContinuityDatabase();
const localCardIdentityRepository = createWildzIdentityRepository({ database: localCardDatabase });

async function readLocalOwnerCards(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
}): Promise<LocalOwnerCards | null> {
  const stored = await input.database.read<unknown>(
    "ownerStates",
    wildzOwnerScope(input.session.keyId, input.session.actorId)
  );
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const record = stored as Record<string, unknown>;
  if (record.keyId !== input.session.keyId || record.actorId !== input.session.actorId) return null;
  const playState = record.playState;
  if (!playState || typeof playState !== "object" || Array.isArray(playState)) return null;
  const inventory = (playState as Record<string, unknown>).inventory;
  return Array.isArray(inventory)
    ? { playState: { inventory: inventory as PortableCardAsset[] } }
    : null;
}

export async function resolveLocalWildzCard(
  assetId: string,
  dependencies: {
    database?: WildzContinuityDatabase;
    repository?: Pick<WildzIdentityRepository, "active">;
    loadOwnerState?: (input: {
      database: WildzContinuityDatabase;
      session: WildzIdentitySession;
    }) => Promise<LocalOwnerCards | null>;
  } = {}
): Promise<PortableCardAsset | null> {
  const handedOff = recallStandaloneWildzCard(assetId);
  if (handedOff) return handedOff;
  const database = dependencies.database ?? localCardDatabase;
  const repository = dependencies.repository ?? localCardIdentityRepository;
  const session = await repository.active();
  if (!session) return null;
  const ownerState = await (dependencies.loadOwnerState ?? readLocalOwnerCards)({ database, session });
  const asset = ownerState?.playState.inventory.find((candidate) => candidate.id === assetId) ?? null;
  if (!asset) return null;
  try {
    return verifyAnyWildsCard(asset).ok ? structuredClone(asset) : null;
  } catch {
    return null;
  }
}

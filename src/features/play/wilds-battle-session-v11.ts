import { applyBattleAction, startWildBattle, type BattleAction, type BattleState } from "./battle-engine";
import { isAdmittedWildsCard } from "./admitted-inventory";
import { resolveCardForm, projectVerifiedBirthFormV11 } from "./wilds-card-form-resolution";
import { verifyWildsV11Birth, type WildsV11CreatureCard } from "./wilds-card-proof-v11";
import { sealLocalWildsV11Card, type WildsV11LocalCard } from "./wilds-portable-card-v11";
import type { PortableCardAsset } from "./portable-card";

export type WildsV11BattleSession = Readonly<{
  birth: WildsV11CreatureCard;
  ownerId: string;
  playerAssetId: string;
  battle: BattleState;
}>;

const admittedSessions = new WeakSet<object>();

function freezeGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeGraph(child, seen);
  return Object.freeze(value);
}

/** Birth signature verification happens once at entry, off the frame loop. */
export async function startWildsV11BattleSession(input: {
  birth: WildsV11CreatureCard;
  player: PortableCardAsset;
  ownerId: string;
  pinnedKeys: Readonly<Record<string, string>>;
}): Promise<WildsV11BattleSession> {
  if (!isAdmittedWildsCard(input.player) || input.player.manifest.ownerReceizId !== input.ownerId
    || input.birth.encounter.input.actorId !== input.ownerId
    || !await verifyWildsV11Birth(input.birth, input.pinnedKeys)) {
    throw new Error("wilds_v11_battle_proof_required");
  }
  const playerForm = resolveCardForm(input.player);
  if (!playerForm) throw new Error("wilds_v11_battle_player_form_missing");
  const birth = structuredClone(input.birth);
  const wildForm = projectVerifiedBirthFormV11(birth.birth, birth.proofDigest);
  const battle = startWildBattle({
    encounterSeed: birth.proofDigest,
    player: { assetId: input.player.id, name: input.player.manifest.name,
      element: playerForm.element, ...input.player.manifest.stats,
      health: input.player.manifest.stats.health * 2 },
    wild: { formId: wildForm.id, name: wildForm.name, element: wildForm.element, ...wildForm.stats }
  });
  const session = freezeGraph({ birth, ownerId: input.ownerId, playerAssetId: input.player.id, battle });
  admittedSessions.add(session);
  return session;
}

/** Pure battle step. The admitted immutable session cannot be fabricated from saved JSON. */
export function advanceWildsV11BattleSession(session: WildsV11BattleSession, action: BattleAction): WildsV11BattleSession {
  if (!admittedSessions.has(session)) throw new Error("wilds_v11_battle_session_unadmitted");
  // Switching needs a separate admitted-roster projection; caller-supplied stats are never authority.
  if (action.type === "switch" || !(["ability", "guard", "focus", "capture"] as string[]).includes(action.type)
    || (action.type === "ability" && action.slot !== 0 && action.slot !== 1)) {
    throw new Error("wilds_v11_battle_action_unadmitted");
  }
  const battle = applyBattleAction(session.battle, action);
  if (battle === session.battle) return session;
  const next = freezeGraph({ ...session, battle });
  admittedSessions.add(next);
  return next;
}

/** A captured local card preserves birth proof; its capture and custody remain local claims. */
export async function sealCapturedWildsV11BattleSession(session: WildsV11BattleSession, capturedAt: string,
  pinnedKeys: Readonly<Record<string, string>>): Promise<WildsV11LocalCard> {
  if (!admittedSessions.has(session) || session.battle.phase !== "captured"
    || session.battle.transcript.at(-1)?.action !== "capture") {
    throw new Error("wilds_v11_battle_capture_required");
  }
  return sealLocalWildsV11Card(session.birth, session.ownerId, capturedAt, pinnedKeys);
}

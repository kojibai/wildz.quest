import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import type { WildsWorldCommand } from "./wilds-world-service";
import { verifyKaiTemporalRoot, type KaiTemporalRoot } from "./kai-temporal-root";

export type KaiRootedWildsWorldCommand = WildsWorldCommand & { kai: KaiTemporalRoot };

export function withWildsWorldCommandKai<T extends WildsWorldCommand>(command: T, kai: KaiTemporalRoot): T & { kai: KaiTemporalRoot } {
  return { ...command, kai: verifyKaiTemporalRoot(kai) };
}

export function verifyWildsWorldCommandKai(command: WildsWorldCommand): KaiTemporalRoot {
  if (!command.kai) throw new Error("wilds_world_kai_root_required");
  return verifyKaiTemporalRoot(command.kai);
}

export function worldCommandRequiresCard(command: WildsWorldCommand) {
  return command.type === "raid.act"
    || command.type === "raid.contribute"
    || command.type === "ecology.contribute"
    || command.type === "story.trainer_battle"
    || command.type === "story.tournament_enter"
    || (command.type === "story.contribute" && Boolean(command.cardProofDigest));
}

export function verifyWildsWorldCommandCard(input: {
  command: WildsWorldCommand;
  card: PortableCardAsset | undefined;
}) {
  if (!worldCommandRequiresCard(input.command)) return input.card;
  let verified = false;
  try {
    verified = Boolean(input.card && verifyAnyWildsCard(input.card).ok);
  } catch {
    verified = false;
  }
  if (!input.card || !verified) throw new Error("wilds_world_verified_card_required");
  if ("cardProofDigest" in input.command && input.command.cardProofDigest !== input.card.proof.digest) {
    throw new Error("wilds_world_card_proof_invalid");
  }
  return input.card;
}

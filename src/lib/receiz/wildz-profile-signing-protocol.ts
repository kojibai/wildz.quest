import type { PortableCardAsset } from "../../features/play/portable-card";
import { signWildzProfilePublication, type WildzProfileSigningInput } from "./wildz-profile-signing";

export type WildzProfileSigningRequest =
  | { input: WildzProfileSigningInput; admittedCards: boolean; cardCount?: number }
  | { card: PortableCardAsset };
type Reply = { ok: true; result: Awaited<ReturnType<typeof signWildzProfilePublication>> } | { ok: false; error: string };

/** Receive admitted public cards individually so the gameplay thread never
 * clones the entire Vault or account archive in one blocking worker message. */
export function createWildzProfileSigningReceiver(reply: (value: Reply) => void) {
  let pending: { input: WildzProfileSigningInput; cards: PortableCardAsset[]; count: number } | null = null;
  const sign = (input: WildzProfileSigningInput, admitted: boolean) => {
    void signWildzProfilePublication(input, admitted).then(result => reply({ ok: true, result }), cause => reply({ ok: false, error: cause instanceof Error ? cause.message : "wildz_profile_signing_failed" }));
  };
  return (request: WildzProfileSigningRequest) => {
    try {
      if ("input" in request) {
        if (pending) throw Error("wildz_profile_signing_already_started");
        if (request.cardCount === undefined) { sign(request.input, request.admittedCards); return; }
        if (!request.admittedCards || !Number.isSafeInteger(request.cardCount) || request.cardCount < 0 || request.cardCount > 1000
          || request.cardCount !== request.input.profile.vault.length || request.input.assets !== undefined) throw Error("wildz_public_profile_card_unverified");
        pending = { input: request.input, count: request.cardCount, cards: [] };
      } else {
        const expected = pending?.input.profile.vault[pending.cards.length];
        if (!pending || !expected || request.card.id !== expected.id || request.card.proof.digest !== expected.proofDigest) throw Error("wildz_public_profile_card_unverified");
        pending.cards.push(request.card);
      }
      if (pending && pending.cards.length === pending.count) {
        const complete = pending; pending = null;
        sign({ ...complete.input, assets: complete.cards }, true);
      }
    } catch (cause) {
      pending = null;
      reply({ ok: false, error: cause instanceof Error ? cause.message : "wildz_profile_signing_failed" });
    }
  };
}

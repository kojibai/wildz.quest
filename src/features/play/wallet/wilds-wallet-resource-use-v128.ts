"use client";

import { canonicalPortableCardJson } from "../portable-card";
import type { WildsResourceGameplayCommandV128 } from "../../../lib/receiz/wilds-resource-gameplay-v128";
import type { WildsResourceExchangeBrowserRuntimeV128 } from "./wilds-wallet-resource-source-controller-v128";

type Request = Readonly<{attemptId: string; memberIds: readonly string[]; command: WildsResourceGameplayCommandV128}>;
type Saved = Request & Readonly<{schema: "wildz.wallet.resource-use-attempt.v128"; ownerHandle: string; keyId: string}>;

/** Checkpoints retain retry coordinates. Only the actual SDK-opened source
 * replay and current domain CAS can admit a finite resource effect. */
export function createWildsWalletResourceUsePortV128(input: Readonly<{
  keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{keyId: string; ownerHandle: string}>;
  openRuntime(): Promise<WildsResourceExchangeBrowserRuntimeV128>;
}>) {
  const current = () => { const actual = input.currentIdentity(); if (actual.keyId !== input.keyId || actual.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen the same resource action."); };
  const validateMembers = (memberIds: readonly string[], command?: WildsResourceGameplayCommandV128) => {
    if (new Set(memberIds).size !== memberIds.length || !memberIds.length && command && command.kind !== "world") throw Error("Choose exact source members to use.");
    if (command?.kind === "food.consume" && (memberIds.length !== 1 || memberIds[0] !== command.itemId)) throw Error("The food action changed its exact portion.");
  };
  const keyFor = (attemptId: string) => JSON.stringify(["wildz.wallet.resource-use-attempt.v128", input.keyId, input.ownerHandle, attemptId]);
  const runtimeFor = async () => {
    const runtime = await input.openRuntime(); current();
    if (runtime.keyId !== input.keyId || runtime.ownerReceizId !== input.ownerHandle) throw Error("The source session belongs to another Explorer.");
    return runtime;
  };
  const validateSaved = (saved: Saved, request: Readonly<{attemptId: string; memberIds: readonly string[]; command?: WildsResourceGameplayCommandV128}>) => {
    if (saved.schema !== "wildz.wallet.resource-use-attempt.v128" || saved.keyId !== input.keyId || saved.ownerHandle !== input.ownerHandle
      || saved.attemptId !== request.attemptId || canonicalPortableCardJson(saved.memberIds) !== canonicalPortableCardJson([...request.memberIds].sort())
      || request.command && canonicalPortableCardJson(saved.command) !== canonicalPortableCardJson(request.command)) throw Error("The saved action belongs to different source members or a changed command.");
    validateMembers(saved.memberIds, saved.command);
  };
  const verifyOutcome = (admitted: Awaited<ReturnType<WildsResourceExchangeBrowserRuntimeV128["exchange"]["use"]>>, saved: Saved) => {
    current();
    const canonicalCommand = admitted.command;
    // Original resolution may add only these carried SDK inputs. Body, Kai,
    // actor and economic fields must still match the first durable command.
    const compared = saved.command.kind === "world" && canonicalCommand.kind === "world"
      ? { ...saved.command,
          ...(!saved.command.cardOriginal && canonicalCommand.cardOriginal ? { cardOriginal: canonicalCommand.cardOriginal } : {}),
          ...(!saved.command.workerOriginals && canonicalCommand.workerOriginals ? { workerOriginals: canonicalCommand.workerOriginals } : {}) }
      : saved.command;
    if (canonicalPortableCardJson(canonicalCommand) !== canonicalPortableCardJson(compared)) throw Error("The canonical accepted command differs from this saved action.");
    if (canonicalPortableCardJson([...(admitted.effectMemberIds ?? admitted.usedMemberIds)].sort()) !== canonicalPortableCardJson(saved.memberIds)
      || admitted.usedMemberIds.some(id => !saved.memberIds.includes(id) || !admitted.state.spentMembers[id])) throw Error("The actual current source did not admit these exact resource effects.");
    return {...admitted, command: saved.command};
  };
  const dispatch = async (runtime: WildsResourceExchangeBrowserRuntimeV128, saved: Saved, beforeCommit?: () => Promise<void>) =>
    verifyOutcome(await runtime.exchange.use({attemptId: saved.attemptId, command: saved.command}, beforeCommit), saved);
  const lock = <T>(attemptId: string, action: () => Promise<T>) => {
    current(); if (!navigator.locks) throw Error("This browser cannot safely lock the same resource action.");
    return navigator.locks.request(`wildz:resource-use:${input.keyId}:${input.ownerHandle}:${attemptId}`, action);
  };
  return {
    /** Read canonical acceptance without retrying a possibly unsubmitted append. */
    observe(request: Readonly<{attemptId: string; memberIds: readonly string[]}>) {
      validateMembers(request.memberIds);
      return lock(request.attemptId, async () => {
        const runtime = await runtimeFor(), saved = await runtime.database.read<Saved>("meta", keyFor(request.attemptId)); current();
        if (!saved) return null;
        validateSaved(saved, request);
        const admitted = await runtime.exchange.observeUse(request.attemptId); current();
        return admitted ? verifyOutcome(admitted, saved) : null;
      });
    },
    /** Recover before observing a fresh body/clock. This never replaces the first command. */
    recover(request: Readonly<{attemptId: string; memberIds: readonly string[]}>, beforeCommit?: () => Promise<void>) {
      validateMembers(request.memberIds);
      return lock(request.attemptId, async () => {
        const runtime = await runtimeFor(), saved = await runtime.database.read<Saved>("meta", keyFor(request.attemptId)); current();
        if (!saved) return null;
        validateSaved(saved, request); return dispatch(runtime, saved, beforeCommit);
      });
    },
    use(request: Request, beforeCommit?: () => Promise<void>) {
      validateMembers(request.memberIds, request.command);
      return lock(request.attemptId, async () => {
        const runtime = await runtimeFor(), key = keyFor(request.attemptId);
        let saved = await runtime.database.read<Saved>("meta", key); current();
        if (!saved) {
          saved = {schema: "wildz.wallet.resource-use-attempt.v128", keyId: input.keyId, ownerHandle: input.ownerHandle,
            attemptId: request.attemptId, memberIds: [...request.memberIds].sort(), command: structuredClone(request.command)};
          await runtime.database.transaction(["meta"], "readwrite", tx => tx.put("meta", saved!, key)); current();
          if (canonicalPortableCardJson(await runtime.database.read("meta", key)) !== canonicalPortableCardJson(saved)) throw Error("This exact resource action could not be saved. No source spend was started.");
        }
        validateSaved(saved, request); return dispatch(runtime, saved, beforeCommit);
      });
    }
  };
}

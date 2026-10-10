'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { creditWildsImportedPackageFood, createWildsNourishmentState, reconcileWildsNourishmentCustody, recoverWildsUnpackedPackageFood, type WildsNourishmentState } from './wilds-nourishment';
import type { useWildsWorld } from './use-wilds-world';
import type { useWildsMessenger } from './use-wilds-messenger';
import type { ResourceExchangeActions, ExchangeClaim, ExchangeAvailability } from './WildsResourceExchange';
import { projectResourceExchangeInventory, visibleExchangeNourishment } from './wilds-resource-exchange-inventory';
import type { WildsWorldProjection } from './wilds-world-state';

async function request(url: string, body?: unknown, idempotencyKey?: string, method: 'POST' | 'DELETE' = 'POST') {
  const response = await fetch(url, { method: body ? method : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw Error(result?.message ?? result?.error ?? 'Resource service is reconnecting. Please try again.');
  return result;
}

export function useWildsResourceExchange(input: {
  owner: string; nourishment?: WildsNourishmentState; world: ReturnType<typeof useWildsWorld>; messenger: ReturnType<typeof useWildsMessenger>;
  authorize: () => Promise<void>; readKai: () => number;
  nativeSourceEnabled?: boolean;
  credit: (update: (state: WildsNourishmentState | undefined) => WildsNourishmentState) => void;
  feedback: (message: string) => void;
}) {
  const live = useRef(input); live.current = input;
  const [capability, setCapability] = useState<{ owner: string; value: ExchangeAvailability } | null>(null);
  const capabilityRequest = useRef<{ owner: string; promise: Promise<ExchangeAvailability> } | null>(null);
  const readAvailability = useCallback(async (): Promise<ExchangeAvailability> => {
    const owner = live.current.owner;
    if (capabilityRequest.current?.owner === owner) return capabilityRequest.current.promise;
    const promise = (async () => {
      let value: ExchangeAvailability;
      try {
        if (live.current.nativeSourceEnabled) {
          const { createWildsWalletNativeSdkClient } = await import('./wallet/wilds-wallet-native-sdk-client');
          const source = await createWildsWalletNativeSdkClient().nativeWorld.readLatest();
          value = source ? { status: 'available', foodAvailable: true, marketAvailable: false, message: 'Pack and unpack admitted resources here. Send them from Wallet · Assets.' }
            : { status: 'unavailable', message: 'Your native world source is connecting. Your saved inventory remains visible.' };
        } else {
        const result = await request('/api/wilds/resources/packages');
        value = result.resourceTransfer === 'available'
          ? { status: 'available', foodAvailable: result.foodSource === 'available', marketAvailable: result.resourceMarket === 'available', message: result.foodSource === 'available' ? '' : 'Food cards are waiting for the food exchange service. You can still pack materials and other gathered resources.' }
          : { status: 'unavailable', message: 'Resource exchange is waiting for the shared inventory service. Your gathered items remain usable in your Satchel.' };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : '';
        value = /authority_required|unauthorized|sign_in|session_required|guest_identity_required/.test(reason)
          ? { status: 'locked', message: 'Unlock your Explorer to check resource exchange.' }
          : /application_required|conditional_resource_custody_unavailable|admitted_food_source_unavailable/.test(reason)
          ? { status: 'unavailable', message: 'Resource exchange is waiting for the shared inventory service to be configured. Your gathered items remain usable in your Satchel.' }
          : { status: 'unavailable', message: 'Resource exchange is reconnecting. Your gathered items remain in your Satchel.' };
      }
      if (live.current.owner === owner) setCapability({ owner, value });
      return value;
    })();
    capabilityRequest.current = { owner, promise };
    try { return await promise; }
    finally { if (capabilityRequest.current?.promise === promise) capabilityRequest.current = null; }
  }, []);
  const checkAvailability = useCallback(async () => { await readAvailability(); }, [readAvailability]);
  const requireAvailability = useCallback(async () => {
    await live.current.authorize();
    const result = await readAvailability();
    if (result.status !== 'available') throw Error(result.message);
  }, [readAvailability]);
  const createAttempt = useRef<{ basis: string; commands: string[] } | null>(null);
  const listingAttempts = useRef(new Map<string, string>());
  const admitWorld = useCallback((result: { world?: { projection?: WildsWorldProjection } }) => {
    if (result.world?.projection) return live.current.world.adoptServerWorld(result.world.projection);
  }, []);
  const unpack = useCallback(async (id: string) => {
    if (live.current.nativeSourceEnabled) {
      await live.current.authorize();
      const owner = live.current.owner;
      const { createActiveWildsNativeWorldContext } = await import('./wilds-native-world-source-client');
      const { unpackWildsNativeResourcePackage } = await import('./wilds-native-resource-source-client');
      const context = await createActiveWildsNativeWorldContext({ action: 'unpack-native-resource', packageId: id });
      const accepted = await unpackWildsNativeResourcePackage(id, context, `native-unpack:${id}`);
      if (live.current.owner !== owner) throw Error('Reopen the unpacking account to recover this package.');
      const world = live.current.world.adoptServerWorld(accepted.record.checkpoint.projection);
      live.current.credit(current => recoverWildsUnpackedPackageFood(reconcileWildsNourishmentCustody(current, world, owner) ?? createWildsNourishmentState(owner), world, live.current.readKai()));
      return;
    }
    await requireAvailability();
    const owner = live.current.owner;
    const record = live.current.world.currentSource()?.resourcePackages?.[id];
    const source = live.current.world.currentSource();
    const before = reconcileWildsNourishmentCustody(live.current.nourishment, source, owner) ?? createWildsNourishmentState(owner);
    if (record) creditWildsImportedPackageFood(before, record.package.members, { packageId: id, receiptId: record.receiptId ?? 'source-admission' }, Math.max(live.current.readKai(), before.lastKaiUPulse));
    const result = await request('/api/wilds/resources/packages/use', { packageId: id });
    if (live.current.owner !== owner) throw Error('The signed-in explorer changed. Reopen the resource card.');
    admitWorld(result);
    if (!result.package || !Array.isArray(result.members) || typeof result.receiptId !== 'string') throw Error('Resource contents are still syncing. Reopen your Satchel.');
    const world = live.current.world.currentSource();
    live.current.credit(current => {
      const base = reconcileWildsNourishmentCustody(current, world, owner) ?? createWildsNourishmentState(owner);
      // Canonical unpacked members remain recoverable if the local pack filled
      // while this request was in flight. Recover only the portions that fit.
      return world ? recoverWildsUnpackedPackageFood(base, world, Math.max(live.current.readKai(), base.lastKaiUPulse)) : base;
    });
  }, [admitWorld, requireAvailability]);
  const claim = useCallback(async (proof: string) => {
    await requireAvailability();
    const result = await request('/api/wilds/claims', { proof });
    if (result.status !== 'committed') throw Error('This resource card was not admitted. Try receiving it again.');
    admitWorld(result);
    if (result.admission?.package?.packageId) await unpack(result.admission.package.packageId);
    else await live.current.world.refresh();
  }, [admitWorld, unpack, requireAvailability]);
  const actions = useMemo<ResourceExchangeActions>(() => ({
    async connect() { await live.current.authorize(); await readAvailability(); },
    async create(ids, individual) {
      await requireAvailability();
      await live.current.world.refresh();
      const basis = JSON.stringify({ owner: live.current.owner, ids: [...ids].sort(), individual });
      if (createAttempt.current?.basis !== basis) createAttempt.current = { basis, commands: Array.from({ length: individual ? ids.length : 1 }, () => `resource:package:${crypto.randomUUID()}`) };
      const groups = individual ? ids.map(id => [id]) : [ids];
      for (let index = 0; index < groups.length; index++) {
        const world = live.current.world.snapshot;
        const selected = groups[index];
        if (live.current.nativeSourceEnabled) {
          const { createActiveWildsNativeWorldContext } = await import('./wilds-native-world-source-client');
          const { prepareWildsNativeResourceSource } = await import('./wilds-native-resource-source-client');
          const asset = { kind: 'inventory' as const, materialLotIds: selected.filter(id => Boolean(world?.materialLots[id])), resourceLotIds: selected.filter(id => Boolean(world?.resourceLots[id])), foodItemIds: selected.filter(id => !world?.materialLots[id] && !world?.resourceLots[id]) };
          const context = await createActiveWildsNativeWorldContext({ action: 'pack-native-resource', asset, commandId: createAttempt.current.commands[index] });
          await prepareWildsNativeResourceSource({ asset, commandId: createAttempt.current.commands[index], context });
          await live.current.world.refresh();
          continue;
        }
        const result = await request('/api/wilds/resources/packages', {
          commandId: createAttempt.current.commands[index],
          materialLotIds: selected.filter(id => Boolean(world?.materialLots[id])),
          resourceLotIds: selected.filter(id => Boolean(world?.resourceLots[id])),
          foodItemIds: selected.filter(id => !world?.materialLots[id] && !world?.resourceLots[id]),
          nourishment: live.current.nourishment
        });
        admitWorld(result);
      }
      createAttempt.current = null;
    },
    async transfer(id, recipient) {
      await requireAvailability();
      const result = await request('/api/wilds/resources/packages/transfers', { packageId: id, targetHandle: recipient });
      admitWorld(result);
      if (typeof result.claimProof !== 'string' || typeof result.claimId !== 'string' || typeof result.claimUrl !== 'string') throw Error('Transfer proof is still syncing. Try exporting again.');
      return result as ExchangeClaim;
    },
    unpack, claim,
    async recover(id) {
      await requireAvailability();
      const recipient = live.current.world.currentSource()?.resourcePackages?.[id]?.transferTargetHandle ?? null;
      admitWorld(await request('/api/wilds/resources/packages/transfers', { packageId: id, targetHandle: recipient }));
    },
    async cancel(id) {
      await requireAvailability();
      try {
        const record = live.current.world.currentSource()?.resourcePackages?.[id];
        if (record?.listingId && ['listed', 'reserved'].includes(record.status)) {
          const market = await request('/api/market/resource-packages');
          if (!market.head) throw Error('Market cancellation is waiting for the shared inventory service.');
          const result = await request('/api/market/resource-packages', { listingId: record.listingId, expectedRevision: market.head.revision, expectedAppendAnchorId: market.head.appendAnchorId }, `pack-unlist:${record.listingId}`, 'DELETE');
          if (result.status === 'recovery_pending') throw Error('Cancellation is still syncing. Retry to finish returning the card to your Satchel.');
          if (!['admitted', 'replayed'].includes(result.status)) throw Error('Market cancellation changed. Refresh your Satchel and try again.');
          await live.current.world.refresh();
        } else {
          admitWorld(await request('/api/wilds/resources/packages/cancel', { packageId: id }));
        }
      } catch (error) {
        void live.current.world.refresh();
        throw error;
      }
    },
    async list(id, priceCents) {
      await requireAvailability();
      const market = await request('/api/market/resource-packages');
      if (!market.head) throw Error('Resource market is reconnecting.');
      const key = listingAttempts.current.get(id) ?? `resource:list:${crypto.randomUUID()}`;
      listingAttempts.current.set(id, key);
      await request('/api/market/resource-packages', { packageId: id, priceCents, expectedRevision: market.head.revision, expectedAppendAnchorId: market.head.appendAnchorId }, key);
      listingAttempts.current.delete(id);
      await live.current.world.refresh();
    },
    async message(peer, offer) { await live.current.messenger.sendResourceClaim(peer, offer.claimProof); }
  }), [admitWorld, unpack, claim, requireAvailability, readAvailability]);
  useEffect(() => {
    const settled = (event: Event) => {
      const id = (event as CustomEvent<{ packageId?: unknown }>).detail?.packageId;
      if (typeof id !== 'string') return;
      void unpack(id).then(() => live.current.feedback('Purchased resources are ready in your Satchel.')).catch(() => live.current.feedback('Your purchased card is saved. Open the Satchel to unpack its contents.'));
    };
    window.addEventListener('wildz:resource-package-settled', settled);
    return () => window.removeEventListener('wildz:resource-package-settled', settled);
  }, [unpack]);
  const inventory = useMemo(() => projectResourceExchangeInventory(input.world.snapshot, input.nourishment, input.owner), [input.world.snapshot, input.nourishment, input.owner]);
  const cards = input.nativeSourceEnabled ? inventory.cards.map(card => ({ ...card, transferable: false })) : inventory.cards;
  const nourishment = useMemo(() => visibleExchangeNourishment(input.nourishment, input.world.snapshot, input.owner), [input.nourishment, input.world.snapshot, input.owner]);
  const consume = useCallback(async (itemId: string) => {
    const result = await request('/api/wilds/resources/food/consume', { itemId });
    const world = admitWorld(result);
    if (!world) throw Error('Your food use is still syncing. Its saved energy will recover when the world reconnects.');
    return world;
  }, [admitWorld]);
  const availability: ExchangeAvailability = capability?.owner === input.owner ? capability.value : { status: 'checking', message: 'Checking resource exchange…' };
  return { ...inventory, cards, nourishment, actions, consume, availability, checkAvailability };
}

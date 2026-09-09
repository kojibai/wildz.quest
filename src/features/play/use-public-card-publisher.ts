"use client";

import { useEffect, useRef } from "react";
import { wildzJsonSerializer } from "../../lib/performance/wildz-json-serializer";
import { wildzGameplayBackground } from "../../lib/performance/wildz-gameplay-background";
import { attemptPublicWildsCardRegistration } from "./public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import {
  wildzVaultAdmissionCarriesProofObject,
  type WildzAdmittedVaultProofObjects
} from "../../lib/receiz/wildz-vault-card-admission";

const RETRY_AFTER_MS = 30_000;

export function publicCardPublicationCandidates(
  assets: readonly PortableCardAsset[],
  pendingAssetIds: ReadonlySet<string>,
  admittedPins: ReadonlySet<string>
) {
  return assets.filter((asset) =>
    pendingAssetIds.has(asset.id)
    && !admittedPins.has(`${asset.id}:${asset.proof.digest}`));
}

export function publicCardPublicationQueue(
  assets: readonly PortableCardAsset[],
  publishedPins: ReadonlySet<string>
) {
  return assets
    .filter((asset) => {
      try {
        return !publishedPins.has(`${asset.id}:${asset.proof.digest}`) && verifyAnyWildsCard(asset).ok;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id) || left.proof.digest.localeCompare(right.proof.digest));
}

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function publicCardPublicationQueueCooperatively(
  assets: readonly PortableCardAsset[],
  publishedPins: ReadonlySet<string>,
  options: {
    batchSize?: number;
    yieldControl?: () => Promise<void>;
    proofObjects?: WildzAdmittedVaultProofObjects;
    verifyCard?: (asset: PortableCardAsset) => boolean;
  } = {}
) {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 1));
  const yieldControl = options.yieldControl ?? yieldToBrowser;
  const verifyCard = options.verifyCard ?? ((asset: PortableCardAsset) => verifyAnyWildsCard(asset).ok);
  const candidates = [...assets].sort((left, right) =>
    left.id.localeCompare(right.id) || left.proof.digest.localeCompare(right.proof.digest));
  const waiting: PortableCardAsset[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const asset = candidates[index]!;
    try {
      if (!publishedPins.has(`${asset.id}:${asset.proof.digest}`)) {
        const admitted = wildzVaultAdmissionCarriesProofObject(options.proofObjects, asset);
        if (admitted || verifyCard(asset)) waiting.push(asset);
      }
    } catch {
      // Invalid cards never enter the public projection.
    }
    if ((index + 1) % batchSize === 0 && index + 1 < candidates.length) await yieldControl();
  }
  return waiting;
}

export function usePublicCardPublisher(
  assets: readonly PortableCardAsset[],
  enabled: boolean,
  proofObjects?: WildzAdmittedVaultProofObjects
) {
  const publishedPins = useRef(new Set<string>());
  const retryAt = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const publish = async () => {
      if (cancelled) return;
      const now = Date.now();
      const waiting = await publicCardPublicationQueueCooperatively(assets, publishedPins.current, { proofObjects });
      const queue = waiting.filter((asset) => (retryAt.current.get(`${asset.id}:${asset.proof.digest}`) ?? 0) <= now);
      for (const asset of queue) {
        if (cancelled) break;
        const pin = `${asset.id}:${asset.proof.digest}`;
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 30_000);
        const result = await attemptPublicWildsCardRegistration(asset, {
          proofObjects,
          signal: controller.signal,
          prepareBody: async (value) => await wildzJsonSerializer.serialize(value)
            ?? wildzGameplayBackground.run(() => JSON.stringify(value))
        }).finally(() => clearTimeout(deadline));
        if (result.published) {
          publishedPins.current.add(pin);
          retryAt.current.delete(pin);
        } else {
          retryAt.current.set(pin, Date.now() + RETRY_AFTER_MS);
        }
      }
      if (cancelled) return;
      const nextRetryAt = waiting
        .filter((asset) => !publishedPins.current.has(`${asset.id}:${asset.proof.digest}`))
        .map((asset) => retryAt.current.get(`${asset.id}:${asset.proof.digest}`))
        .filter((value): value is number => typeof value === "number")
        .sort((left, right) => left - right)[0];
      if (nextRetryAt) retryTimer = setTimeout(() => void publish(), Math.max(0, nextRetryAt - Date.now()));
    };

    // Deferring one microtask lets React Strict Mode retire its probe effect
    // before any network publication begins.
    const reconnect = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryAt.current.clear();
      void publish();
    };
    window.addEventListener("online", reconnect);
    queueMicrotask(() => void publish());
    return () => {
      window.removeEventListener("online", reconnect);
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [assets, enabled, proofObjects]);
}

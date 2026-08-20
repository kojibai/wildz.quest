"use client";

import { useEffect, useRef } from "react";
import { attemptPublicWildsCardRegistration } from "./public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

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
        return verifyAnyWildsCard(asset).ok && !publishedPins.has(`${asset.id}:${asset.proof.digest}`);
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
  options: { batchSize?: number; yieldControl?: () => Promise<void> } = {}
) {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 1));
  const yieldControl = options.yieldControl ?? yieldToBrowser;
  const candidates = [...assets].sort((left, right) =>
    left.id.localeCompare(right.id) || left.proof.digest.localeCompare(right.proof.digest));
  const waiting: PortableCardAsset[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const asset = candidates[index]!;
    try {
      if (verifyAnyWildsCard(asset).ok && !publishedPins.has(`${asset.id}:${asset.proof.digest}`)) {
        waiting.push(asset);
      }
    } catch {
      // Invalid cards never enter the public projection.
    }
    if ((index + 1) % batchSize === 0 && index + 1 < candidates.length) await yieldControl();
  }
  return waiting;
}

export function usePublicCardPublisher(assets: readonly PortableCardAsset[], enabled: boolean) {
  const publishedPins = useRef(new Set<string>());
  const retryAt = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const publish = async () => {
      if (cancelled) return;
      const now = Date.now();
      const waiting = await publicCardPublicationQueueCooperatively(assets, publishedPins.current);
      const queue = waiting.filter((asset) => (retryAt.current.get(`${asset.id}:${asset.proof.digest}`) ?? 0) <= now);
      for (const asset of queue) {
        if (cancelled) break;
        const pin = `${asset.id}:${asset.proof.digest}`;
        const result = await attemptPublicWildsCardRegistration(asset);
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
    queueMicrotask(() => void publish());
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [assets, enabled]);
}

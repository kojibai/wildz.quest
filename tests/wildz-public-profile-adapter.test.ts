import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard, type PortableCardAsset } from "../src/features/play/portable-card";
import {
  fetchPublicWildzProfile,
  parsePublicWildzProfileRecord,
  publishCurrentWildzProfile,
  publicWildzProfileRecoverySourceUrls,
  publishPublicWildzProfile,
  resolvePublicWildzProfile
} from "../src/lib/receiz/wildz-profile-adapter";
import * as profileAdapter from "../src/lib/receiz/wildz-profile-adapter";

const fernProfile = {
  username: "@fern",
  displayName: "Fern",
  vault: [],
  discoveries: 3,
  record: { wins: 2, losses: 0, raids: 1 }
};

describe("Receiz-backed public Wildz profiles", () => {
  test("a fully authenticated owner is publication-ready before opening Profile", () => {
    const readiness = (profileAdapter as Record<string, unknown>).wildzProfilePublicationReadiness;
    assert.equal(typeof readiness, "function");
    const evaluate = readiness as (input: {
      hasIdentity: boolean;
      hasCharacter: boolean;
      proofSessionConnected: boolean;
    }) => string;
    assert.equal(evaluate({ hasIdentity: true, hasCharacter: true, proofSessionConnected: true }), "ready");
    assert.equal(evaluate({ hasIdentity: true, hasCharacter: false, proofSessionConnected: true }), "waiting");
    assert.equal(evaluate({ hasIdentity: true, hasCharacter: true, proofSessionConnected: false }), "waiting");
  });

  test("uses canonical profile URLs across the request and production origins", () => {
    assert.deepEqual(
      publicWildzProfileRecoverySourceUrls("@Fern", "http://localhost:3000", "wildz.quest"),
      ["http://localhost:3000/u/fern", "https://wildz.quest/u/fern"]
    );
  });

  test("recovers a sanitized profile from nested Receiz app-state responses", () => {
    const parsed = parsePublicWildzProfileRecord({
      ok: true,
      record: {
        data: {
          schema: "receiz.wilds_public_profile.v1",
          handle: "@fern",
          sourceUrl: "https://wildz.quest/u/fern",
          publishedAt: "2026-07-15T12:00:00.000Z",
          profile: { ...fernProfile, accessToken: "must-not-leak", vault: [] }
        }
      }
    });
    assert.equal(parsed?.profile.username, "@fern");
    assert.equal("accessToken" in (parsed?.profile ?? {}), false);
  });

  test("publishes through the Receiz public store and resolves from a fresh adapter", async () => {
    const published: Record<string, unknown>[] = [];
    const writer = {
      publishPublicStore: async (input: Record<string, unknown>) => {
        published.push(input);
        return { ok: true, accepted: 1 };
      },
      readAppStateByUrl: async () => ({ ok: false, record: null })
    };
    const record = await publishPublicWildzProfile(fernProfile, {
      adapter: writer,
      sourceUrl: "https://wildz.quest/u/fern",
      merchantReceizId: "fern",
      publishedAt: "2026-07-15T12:00:00.000Z"
    });
    assert.equal(record.profile.username, "@fern");
    assert.equal((published[0]?.state as { schema?: string }).schema, "receiz.wilds_public_profile.v1");
    assert.equal(published[0]?.schema, undefined);

    const reader = {
      publishPublicStore: async () => ({ ok: false }),
      readAppStateByUrl: async () => ({ ok: true, record: { data: record } })
    };
    const recovered = await resolvePublicWildzProfile("@fern", {
      adapter: reader,
      requestOrigin: "https://wildz.quest",
      platformDomain: "wildz.quest"
    });
    assert.equal(recovered?.username, "@fern");
    assert.equal(recovered?.discoveries, 3);
  });

  test("fails closed when Receiz does not contain the requested profile", async () => {
    const profile = await resolvePublicWildzProfile("@missing", {
      adapter: {
        publishPublicStore: async () => ({ ok: false }),
        readAppStateByUrl: async () => ({ ok: false, record: null })
      },
      requestOrigin: "https://wildz.quest",
      platformDomain: "wildz.quest"
    });
    assert.equal(profile, null);
  });

  test("browser helpers use the canonical same-origin profile endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, profile: { ...fernProfile, schema: "wildz.public_profile.v1" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;
    assert.equal((await fetchPublicWildzProfile("@Fern", fetcher))?.username, "@fern");
    await publishCurrentWildzProfile(sanitizePublicWildzProfile(fernProfile), fetcher);
    assert.equal(calls[0]?.url, "/api/profiles/fern");
    assert.equal(calls[0]?.init?.credentials, "omit");
    assert.equal(calls[0]?.init?.cache, "no-cache");
    assert.equal(calls[1]?.url, "/api/profiles/fern");
    assert.equal(calls[1]?.init?.method, "POST");
    assert.equal(calls[1]?.init?.credentials, "same-origin");
  });

  test("publishes every required verified card before its non-empty owner profile", async () => {
    const asset = createOwnerBoundInitialPlayState("fern").inventory[0]!;
    const profile = sanitizePublicWildzProfile({
      ...fernProfile,
      vault: [{
        id: asset.id,
        name: asset.manifest.name,
        proofDigest: asset.proof.digest,
        visibility: "public"
      }]
    });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("/api/cards/")) {
        return new Response(JSON.stringify({
          ok: true,
          record: {
            schema: "receiz.wilds_public_card.v1",
            assetId: asset.id,
            sourceUrl: `https://wildz.quest/cards/${encodeURIComponent(asset.id)}`,
            registeredAt: "2026-07-16T12:00:00.000Z",
            asset
          }
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, profile }), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;
    const publish = publishCurrentWildzProfile as unknown as (
      input: typeof profile,
      assets: readonly PortableCardAsset[],
      request: typeof fetch
    ) => Promise<typeof profile>;
    let failure: unknown = null;

    try {
      await publish(profile, [asset], fetcher);
    } catch (cause) {
      failure = cause;
    }

    assert.equal(failure, null);
    assert.deepEqual(calls.map((call) => call.url), [
      `/api/cards/${encodeURIComponent(asset.id)}`,
      "/api/profiles/fern"
    ]);
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { asset });
    assert.equal(calls[1]?.init?.method, "POST");
  });

  test("stops an obsolete profile publication before starting another card", async () => {
    const assets = [
      sealCollectedCard({
        formId: "voltray-1",
        ownerReceizId: "fern",
        encounterId: "profile-cancel-first",
        capturedAt: "2026-08-20T20:00:00.000Z"
      }),
      sealCollectedCard({
        formId: "mintcub-1",
        ownerReceizId: "fern",
        encounterId: "profile-cancel-second",
        capturedAt: "2026-08-20T20:01:00.000Z"
      })
    ];
    const profile = sanitizePublicWildzProfile({
      ...fernProfile,
      vault: assets.map((asset) => ({
        id: asset.id,
        name: asset.manifest.name,
        proofDigest: asset.proof.digest,
        visibility: "public" as const
      }))
    });
    const controller = new AbortController();
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      controller.abort();
      return new Response(JSON.stringify({ ok: true, record: {
        schema: "receiz.wilds_public_card.v1",
        assetId: assets[0]!.id,
        sourceUrl: `https://wildz.quest/cards/${encodeURIComponent(assets[0]!.id)}`,
        registeredAt: "2026-08-20T20:00:00.000Z",
        asset: assets[0]
      } }), { status: 201, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const publish = publishCurrentWildzProfile as unknown as (
      input: typeof profile,
      cards: readonly PortableCardAsset[],
      request: typeof fetch,
      options: { signal: AbortSignal }
    ) => Promise<typeof profile>;
    await assert.rejects(
      publish(profile, assets, fetcher, { signal: controller.signal }),
      { name: "AbortError" }
    );
    assert.equal(calls.length, 1);
  });
});

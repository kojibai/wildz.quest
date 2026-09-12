import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalPublicCardPath,
  createPublicWildsCardRecord,
  parsePublicCardParam,
  registerPublicWildsCard
} from "../src/features/play/public-card-registry";
import { initialPlayState } from "../src/features/play/game-state";
import { resolveLocalWildzCard } from "../src/lib/receiz/wildz-local-card-resolver";
import * as vaultAdmission from "../src/lib/receiz/wildz-vault-card-admission";
import * as publicCardRegistry from "../src/features/play/public-card-registry";

test("full and compact card parameters resolve one canonical asset", () => {
  assert.deepEqual(parsePublicCardParam("wilds:0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "canonical"
  });
  assert.deepEqual(parsePublicCardParam("0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "compact"
  });
  assert.equal(canonicalPublicCardPath("wilds:0123456789abcdef01234567"), "/cards/wilds%3A0123456789abcdef01234567");
  assert.equal(existsSync("app/c/[assetId]/page.tsx"), true);
});

test("concurrent publishers share one registration for the same verified card revision", async () => {
  const asset = initialPlayState.inventory[0]!;
  const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-08-20T20:00:00.000Z");
  let registrations = 0;
  const fetcher = (async () => {
    registrations += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return new Response(JSON.stringify({ ok: true, record }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  const [first, second] = await Promise.all([
    registerPublicWildsCard(asset, fetcher),
    registerPublicWildsCard(asset, fetcher)
  ]);

  assert.equal(registrations, 1);
  assert.equal(first.asset.proof.digest, asset.proof.digest);
  assert.equal(second.asset.proof.digest, asset.proof.digest);
});

test("an admitted Proof Object bypasses client re-verification but an unadmitted copy does not", () => {
  const admit = (vaultAdmission as Record<string, unknown>).admitWildzVaultProofObjects as ((input: {
    cards: typeof initialPlayState.inventory;
    playerHandle: string;
  }) => { proofObjects: unknown });
  const needsVerification = (publicCardRegistry as Record<string, unknown>).publicCardNeedsClientVerification as ((
    asset: typeof initialPlayState.inventory[number],
    proofObjects: unknown
  ) => boolean) | undefined;
  assert.equal(typeof needsVerification, "function");
  const asset = initialPlayState.inventory[0]!;
  const { proofObjects } = admit({ cards: [asset], playerHandle: "publisher" });

  assert.equal(needsVerification!(asset, proofObjects), false);
  assert.equal(needsVerification!(structuredClone(asset), proofObjects), true);
  assert.equal(needsVerification!(asset, {}), true);
});

test("a weaker publication response cannot replace or re-verify an admitted local Proof Object", async () => {
  const admit = (vaultAdmission as Record<string, unknown>).admitWildzVaultProofObjects as ((input: {
    cards: typeof initialPlayState.inventory;
    playerHandle: string;
  }) => { proofObjects: never });
  const asset = initialPlayState.inventory[0]!;
  const { proofObjects } = admit({ cards: [asset], playerHandle: "publisher" });
  const projected = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-08-20T20:00:00.000Z");
  const weakerProjection = structuredClone(projected);
  weakerProjection.asset.proof.digest = `sha256:${"0".repeat(64)}`;
  const fetcher = (async () => new Response(JSON.stringify({ ok: true, record: weakerProjection }), {
    status: 201,
    headers: { "content-type": "application/json" }
  })) as typeof fetch;

  const registered = await registerPublicWildsCard(asset, fetcher, { proofObjects });

  assert.equal(registered.asset, asset);
  assert.equal(registered.asset.proof.digest, asset.proof.digest);
  assert.equal(registered.sourceUrl, projected.sourceUrl);
});

test("public card publication treats the Proof Object as authority and the server as transport", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  assert.doesNotMatch(route, /isReceizKeyFile|publishPublicStoreWithIdentityProof/);
  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /verifyAnyWildsCard\(asset\)/);
  assert.match(route, /publishPublicStore\(\{\s*\.\.\.base,\s*state:/);
  assert.match(route, /merchantReceizId:\s*ownerCoordinate\.profileHandle/);
  assert.doesNotMatch(route, /createReceizWildzPublicRepository|loadVerifiedWildzPublicOwnershipAuthority|advanceWildzPublicState/);
  assert.match(route, /status:\s*503/);
  assert.match(route, /namespace:\s*`wildz-card:\$\{record\.assetId\}`/);
  assert.match(route, /state:\s*transportRecord as unknown as JsonObject/);
});

test("standalone card recovery prefers exact verified local truth before the public projection", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  const resolver = readFileSync("src/lib/receiz/wildz-public-card-resolver.ts", "utf8");
  const serverPage = readFileSync("app/cards/[assetId]/page.tsx", "utf8");
  assert.match(route, /resolvePublicWildsCardRecord/);
  assert.match(route, /requestOrigin\(request\)/);
  assert.match(route, /return WILDZ_PRODUCT\.origin/);
  assert.match(resolver, /createReceizWildzPublicRepository/);
  assert.match(resolver, /resolveSdkPublicWildzCard/);
  assert.match(resolver, /verifyAnyWildsCard/);
  assert.match(serverPage, /resolvePublicWildsCardRecord/);
  assert.match(serverPage, /<WildsCardPage assetId=\{parsed\.assetId\} initialRecord=\{initialRecord\} \/>/);
  const page = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.match(page, /initialRecord\?\.assetId === assetId/);
  assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
  assert.match(page, /resolveLocalWildzCard\(assetId\)/);
  assert.match(page, /wildz-local-card-resolver/);
  assert.match(page, /if \(localAsset\) \{[\s\S]*?return;[\s\S]*?if \(serverAsset\) return;[\s\S]*?fetch\(`/);
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.doesNotMatch(registry, /identityProof|keyFile|defaultIdentityRepository|indexedDB/);
  assert.doesNotMatch(registry, /registryKey|Symbol\.for|resolveLocalPublicWildsCard/);
});

test("card and Vault sealing use the active Wildz Receiz ID without a Connect redirect", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const route = readFileSync("app/api/receiz/proof-object/route.ts", "utf8");
  const identityAdapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  assert.doesNotMatch(inventory, /\/api\/auth\/receiz\/start|ensureWildzNativeProofSession|ensureActiveWildzProofSession|receizResume/);
  assert.doesNotMatch(route, /resolveWildzCookieActor|receiz_authority_required/);
  assert.match(route, /requireVerifiedWildzPng/);
  assert.match(route, /\/api\/document-seal/);
  assert.doesNotMatch(route, /verifyReceizArtifact/);
  assert.match(identityAdapter, /downloadReceizProofObject/);
  assert.doesNotMatch(identityAdapter, /identityBound:\s*false/);
});

test("local standalone recovery returns only the exact proof-verified card", async () => {
  const asset = structuredClone(initialPlayState.inventory[0]!);
  const session = {
    schema: "receiz.wildz.identity_session.v1" as const,
    keyId: "local-card-key",
    actorId: asset.manifest.ownerReceizId,
    username: null,
    displayName: "Wildz Explorer",
    portableStateStatus: "verified" as const,
    localAuthority: "verified" as const,
    remoteStatus: "offline" as const
  };
  const dependencies = {
    database: {} as never,
    repository: { active: async () => session },
    loadOwnerState: async () => ({ playState: { inventory: [asset] } }) as never
  };

  const resolved = await resolveLocalWildzCard(asset.id, dependencies);
  assert.equal(resolved?.id, asset.id);
  assert.notEqual(resolved, asset);
  assert.equal(await resolveLocalWildzCard("wilds:ffffffffffffffffffffffff", dependencies), null);

  const tampered = structuredClone(asset);
  tampered.proof.digest = "sha256:" + "0".repeat(64);
  assert.equal(await resolveLocalWildzCard(asset.id, {
    ...dependencies,
    loadOwnerState: async () => ({ playState: { inventory: [tampered] } }) as never
  }), null);
});

test("QR public-read verification forwards cancellation to a stalled anonymous request", async () => {
  const asset=initialPlayState.inventory[0]!;
  const record=createPublicWildsCardRecord(asset,"https://wildz.quest","2026-09-09T11:00:00.000Z");
  const controller=new AbortController();
  let readSignal:AbortSignal | null | undefined;
  const fetcher=(async (_url: string, init?: RequestInit)=>{
    if(init?.method === "POST") return Response.json({ok:true,record},{status:201});
    readSignal=init?.signal;
    return Response.json({ok:true,record});
  }) as typeof fetch;
  const requirePublic = publicCardRegistry.requireGloballyAvailablePublicWildsCard as (candidate: typeof asset, fetcher:typeof fetch, options?:{signal:AbortSignal})=>Promise<unknown>;
  await requirePublic(asset,fetcher,{signal:controller.signal});
  assert.equal(readSignal,controller.signal);
});

test("a QR caller can cancel its wait without cancelling another publisher's shared registration", async () => {
  const asset=initialPlayState.inventory[0]!;
  const record=createPublicWildsCardRecord(asset,"https://wildz.quest","2026-09-09T11:00:00.000Z");
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let calls=0;
  const fetcher=(async ()=>{calls++;await gate;return Response.json({ok:true,record},{status:201});}) as typeof fetch;
  const publishing=registerPublicWildsCard(asset,fetcher);
  const controller=new AbortController();
  const waiting=publicCardRegistry.requireGloballyAvailablePublicWildsCard(asset,fetcher,{signal:controller.signal}).then(()=>"resolved",()=>"aborted");
  controller.abort();
  const outcome=await Promise.race([waiting,new Promise<string>(resolve=>setTimeout(()=>resolve("stalled"),30))]);
  release();
  await publishing;
  await waiting;
  assert.equal(outcome,"aborted");
  assert.equal(calls,2); // One independent publication plus the anonymous availability check.
});

test("unsigned registry authorization failure retries through the owner's signed publication", async () => {
  const asset=initialPlayState.inventory[0]!;
  const record=createPublicWildsCardRecord(asset,"https://wildz.quest","2026-09-09T11:00:00.000Z");
  let signed=0;
  const fetcher=(async ()=>Response.json({ok:false,error:"unauthorized"},{status:400})) as typeof fetch;
  const options={publishWithIdentityProof:async (candidate:typeof asset)=>{assert.equal(candidate,asset);signed++;return record;}};
  const result=await registerPublicWildsCard(asset,fetcher,options as publicCardRegistry.PublicWildsCardRegistrationOptions);
  assert.equal(signed,1);
  assert.equal(result.asset.proof.digest,asset.proof.digest);
});

test("cancelled body preparation releases the shared upload and cannot publish late", async () => {
  const asset = initialPlayState.inventory[0]!;
  const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-09-09T11:00:00.000Z");
  let requests = 0;
  let release!: (body: string) => void;
  const body = new Promise<string>(resolve => { release = resolve; });
  const fetcher = (async () => {
    requests++;
    return Response.json({ ok: true, record }, { status: 201 });
  }) as typeof fetch;
  const controller = new AbortController();
  const first = registerPublicWildsCard(asset, fetcher, {
    signal: controller.signal, prepareBody: () => body
  });
  controller.abort();
  await assert.rejects(first);
  await new Promise<void>(resolve => setImmediate(resolve));
  const retry = registerPublicWildsCard(asset, fetcher);
  const outcome = await Promise.race([
    retry.then(() => "published"),
    new Promise<string>(resolve => setTimeout(() => resolve("stalled"), 100))
  ]);
  // Retire the deliberately delayed operation even when testing the broken implementation.
  release(JSON.stringify({ asset }));
  await retry;
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(outcome, "published");
  assert.equal(requests, 1, "only the fresh retry may reach the registry");
});


test("an already public exact revision opens without attempting another authenticated publication", async () => {
  const asset = initialPlayState.inventory[0]!;
  const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-09-09T11:00:00.000Z");
  const methods: string[] = [];
  const fetcher = (async (_url: string, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    if (init?.method === "POST") return Response.json({ error: "unauthorized" }, { status: 401 });
    assert.equal(init?.credentials, "omit");
    return Response.json({ ok: true, record });
  }) as typeof fetch;
  assert.equal((await publicCardRegistry.requireGloballyAvailablePublicWildsCard(asset, fetcher)).assetId, asset.id);
  assert.deepEqual(methods, ["GET"]);
});

test("a missing public revision is published and then anonymously verified", async () => {
  const asset = initialPlayState.inventory[0]!;
  const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-09-09T11:00:00.000Z");
  const methods: string[] = [];
  const fetcher = (async (_url: string, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    return methods.length === 1 ? Response.json({ ok: false }, { status: 404 }) : Response.json({ ok: true, record });
  }) as typeof fetch;
  await publicCardRegistry.requireGloballyAvailablePublicWildsCard(asset, fetcher);
  assert.deepEqual(methods, ["GET", "POST", "GET"]);
});

import {
  canonicalizeReceizV122, openReceizSourceCarriedReplayFamilyV124, parseReceizPortableAssetDocument,
  receizBase64UrlDecode, type ReceizClient, type ReceizDomainReplayV124, type ReceizPortableSealedArtifactV124,
  type ReceizSourceCarriedReplayFamilyV124
} from "@receiz/sdk";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { WildsResourceSourcePredecessorV128 } from "./wilds-resource-source-v128";
import { readWildsSourceReplayAfterV128 } from "./wilds-source-replay-recovery-v128";

export type WildsAtlasReplayDomain = Readonly<{
  applicationId: string;
  domainId: string;
  expectedRegistryDigest: string;
  expectedReducerDigest: string;
}>;
export type WildsAtlasReplaySource = ReceizSourceCarriedReplayFamilyV124["sources"][number];

export function readWildsAtlasReplayJson(bytes: string): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(receizBase64UrlDecode(bytes)));
}

export function wildsAtlasReplayPredecessor(sources: readonly WildsAtlasReplaySource[]): WildsResourceSourcePredecessorV128 | null {
  const last = sources.at(-1);
  if (!last) return null;
  return {
    artifact: last.artifact, head: last.head,
    segmentIds: sources.map(source => source.head.currentSegment.segmentId),
    sourceArtifactShas: sources.map(source => source.artifactSha256),
    appendIndex: new Map(sources.flatMap(source => source.replay.additions.map(({ appendId, eventDigest, cursor, newHead }) => [appendId, { eventDigest, cursor, newHead }]))),
  };
}

async function replayOriginal(sdk: ReceizClient, domain: WildsAtlasReplayDomain, replay: ReceizDomainReplayV124, owner: string) {
  const exported = await sdk.domains.exportVerifiedReplayProofObjectV124({ ...domain, throughHead: replay.head,
    ownership: { ownerReceizId: owner, custody: "current", proofRef: "genesis" },
    provenance: { root: `profile:${owner.replace(/\.receiz\.id$/, "")}`, appends: [] }, settlement: { state: "none" }
  });
  const portable = await parseReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(exported.proofObject.payload.bytes)));
  const custody = readWildsAtlasReplayJson(portable.payload.bytesBase64Url) as { replaySourceArtifact?: ReceizPortableSealedArtifactV124 };
  if (!custody.replaySourceArtifact) throw Error("wilds_atlas_original_missing");
  return custody.replaySourceArtifact;
}

export function createWildsAtlasReplayReader(input: Readonly<{
  database: WildzContinuityDatabase;
  domain: WildsAtlasReplayDomain;
}>) {
  const { database, domain } = input;
  const historyKey = JSON.stringify(["wildz.atlas.replay", domain.applicationId, domain.domainId]);
  const sourceKey = (position: number) => JSON.stringify([historyKey, position]);
  let sources: readonly WildsAtlasReplaySource[] = [];
  let loaded = false;
  let pending: Promise<readonly WildsAtlasReplaySource[]> | undefined;

  async function open(artifacts: readonly ReceizPortableSealedArtifactV124[]) {
    if (!artifacts.length) return sources;
    const family = await openReceizSourceCarriedReplayFamilyV124({
      artifacts, expected: { ...domain, audience: domain.applicationId },
    });
    if (family.headArtifactSha256s.length !== 1
      || family.sources.some((source, i) => source.replay.afterHead !== (family.sources[i - 1]?.replay.head ?? null))
      || sources.some((source, i) => family.sources[i]?.artifactSha256 !== source.artifactSha256)) throw Error("wilds_atlas_replay_history_conflict");
    return family.sources;
  }

  async function readHeld() {
    if (loaded) return sources;
    const artifacts = await database.transaction(["artifacts", "meta"], "readonly", async tx => {
      const count = await tx.get<number>("meta", historyKey) ?? 0;
      if (!Number.isSafeInteger(count) || count < 0) throw Error("wilds_atlas_replay_history_invalid");
      const entries: ReceizPortableSealedArtifactV124[] = [];
      for (let i = 0; i < count; i++) {
        const artifact = await tx.get<ReceizPortableSealedArtifactV124>("artifacts", sourceKey(i));
        if (!artifact) throw Error("wilds_atlas_original_missing");
        entries.push(artifact);
      }
      return entries;
    });
    sources = await open(artifacts); loaded = true;
    return sources;
  }

  async function retain(verified: readonly WildsAtlasReplaySource[]) {
    await database.transaction(["artifacts", "meta"], "readwrite", async tx => {
      const count = await tx.get<number>("meta", historyKey) ?? 0;
      for (let i = sources.length; i < verified.length; i++) {
        const exact = verified[i]!.artifact;
        if (i < count) {
          const held = await tx.get("artifacts", sourceKey(i));
          if (canonicalizeReceizV122(held) !== canonicalizeReceizV122(exact)) throw Error("wilds_atlas_replay_history_conflict");
        } else await tx.put("artifacts", exact, sourceKey(i));
      }
      if (verified.length > count) await tx.put("meta", verified.length, historyKey);
    });
    sources = verified;
  }

  async function refresh(sdk: ReceizClient, owner: string) {
    await readHeld();
    const artifacts = sources.map(source => source.artifact);
    let head = sources.at(-1)?.head.head ?? null, cursor = sources.at(-1)?.head.cursor ?? 0;
    try {
      for (;;) {
        const replay = await readWildsSourceReplayAfterV128(sdk, { ...domain, afterHead: head, afterCursor: cursor });
        // SDK 129.5 returns the verified page already held when the
        // transport proves there are no additions after this coordinate.
        if (replay.head === head && replay.cursor === cursor) break;
        if (!replay.additions.length || replay.afterHead !== head || replay.afterCursor !== cursor || replay.cursor <= cursor)
          throw Error("wilds_atlas_replay_history_conflict");
        const artifact = await replayOriginal(sdk, domain, replay, owner);
        artifacts.push(artifact); head = replay.head; cursor = replay.cursor;
      }
    } finally {
      if (artifacts.length > sources.length) {
        const verified = await open(artifacts);
        if (verified.at(-1)?.head.head !== head || verified.at(-1)?.head.cursor !== cursor) throw Error("wilds_atlas_replay_history_conflict");
        await retain(verified);
      }
    }
    return sources;
  }

  return { readHeld, refresh(sdk: ReceizClient, owner: string) {
    if (pending) return pending;
    const run = refresh(sdk, owner);
    pending = run;
    void run.finally(() => { if (pending === run) pending = undefined; }).catch(() => undefined);
    return run;
  }};
}

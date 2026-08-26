import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import {
  convergeWildzPlayerState,
  findWildzPlayerStateRecord,
  WILDZ_PLAYER_STATE_SCHEMA,
  type WildzPlayerStateRecord
} from "../src/lib/receiz/wildz-player-state-sync";

function vault(playerId: string, exportedAt: string, input: { beans: number; achievements: string[] }) {
  const playState = {
    ...createOwnerBoundInitialPlayState(playerId, "2026-08-26T00:00:00.000Z"),
    beans: input.beans,
    achievements: input.achievements
  };
  return createWildsPlayerVault({
    playerId,
    exportedAt,
    playState,
    character: null,
    settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
}

test("same Receiz ID browsers converge additive source history while newest source supplies live state", () => {
  const first = vault("wildz", "2026-08-26T01:00:00.000Z", { beans: 4, achievements: ["first-browser"] });
  const current: WildzPlayerStateRecord = {
    schema: WILDZ_PLAYER_STATE_SCHEMA,
    playerId: "wildz",
    revision: 1,
    updatedAt: first.exportedAt,
    sourceDigest: first.payloadDigest,
    previousSourceDigest: null,
    player: first
  };
  const second = vault("wildz", "2026-08-26T01:01:00.000Z", { beans: 9, achievements: ["second-browser"] });
  const converged = convergeWildzPlayerState({
    actorId: "wildz",
    current,
    incoming: second,
    now: "2026-08-26T01:01:01.000Z"
  });

  assert.equal(converged.schema, WILDZ_PLAYER_STATE_SCHEMA);
  assert.equal(converged.revision, 2);
  assert.equal(converged.previousSourceDigest, first.payloadDigest);
  assert.equal(converged.player.playState.beans, 9);
  assert.deepEqual(new Set(converged.player.playState.achievements), new Set(["first-browser", "second-browser"]));
  assert.equal(findWildzPlayerStateRecord({ data: { state: converged } })?.sourceDigest, converged.sourceDigest);
});

test("a projection for another identity cannot enter the source chain", () => {
  assert.throws(() => convergeWildzPlayerState({
    actorId: "wildz",
    current: null,
    incoming: vault("another", "2026-08-26T01:00:00.000Z", { beans: 1, achievements: [] }),
    now: "2026-08-26T01:00:01.000Z"
  }), /wildz_player_state_source_invalid/);
});

test("player-state route requires the verified Receiz actor and never accepts a client owner override", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("app/api/wilds/player-state/route.ts", "utf8"));
  assert.match(source, /resolveWildsMultiplayerActor\(request, undefined/);
  assert.doesNotMatch(source, /guestId|playerId\s*[:=]\s*body/);
  assert.match(source, /publishWildzPlayerState\(request, actor, body\.player\)/);
});

test("an admitted state from another browser updates live play without remounting the world", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("src/features/play/PlayCampaign.tsx", "utf8"));
  assert.match(source, /admittedSourceStateRef\.current === initialState/);
  assert.match(source, /setState\(initialState\)/);
  assert.doesNotMatch(source, /key=\{[^}]*sourceDigest/);
});

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
    actionHistory: [{ id: "local:test", kind: "activity" as const, title: "Travel", detail: "Player action", authority: "local" as const, uPulse: Date.parse(exportedAt) }],
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

test("an admitted collection update preserves local position without remounting the world", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("src/features/play/PlayCampaign.tsx", "utf8"));
  assert.match(source, /admittedSourceStateRef\.current === initialState/);
  assert.match(source, /admitWildsForwardPosition\(initialState, current\)/);
  assert.doesNotMatch(source, /key=\{[^}]*sourceDigest/);
});


test("a delayed publication keeps gameplay time so a later action can still become current", () => {
  const older = vault("wildz", "2026-08-26T01:00:00.000Z", { beans: 4, achievements: ["older"] });
  const published = convergeWildzPlayerState({ actorId: "wildz", current: null, incoming: older, now: "2026-08-26T02:00:00.000Z" });
  const later = vault("wildz", "2026-08-26T01:30:00.000Z", { beans: 9, achievements: ["later"] });
  const converged = convergeWildzPlayerState({ actorId: "wildz", current: published, incoming: later, now: "2026-08-26T02:01:00.000Z" });
  assert.equal(converged.player.playState.beans, 9);
  assert.equal(converged.player.exportedAt, later.exportedAt);
  assert.equal(converged.updatedAt, "2026-08-26T02:01:00.000Z");
  assert.deepEqual(new Set(converged.player.playState.achievements), new Set(["older", "later"]));
});


test("replaying an already merged older save does not create another revision", () => {
  const older = vault("wildz", "2026-08-26T01:00:00.000Z", { beans: 4, achievements: ["older"] });
  const later = vault("wildz", "2026-08-26T01:30:00.000Z", { beans: 9, achievements: ["later"] });
  const first = convergeWildzPlayerState({ actorId: "wildz", current: null, incoming: later, now: "2026-08-26T02:00:00.000Z" });
  const merged = convergeWildzPlayerState({ actorId: "wildz", current: first, incoming: older, now: "2026-08-26T02:01:00.000Z" });
  const retried = convergeWildzPlayerState({ actorId: "wildz", current: merged, incoming: older, now: "2026-08-26T02:02:00.000Z" });
  assert.equal(retried, merged);
});

test("later export time cannot overrule an older player Kai ledger", () => {
  const latest = vault("wildz", "2026-08-26T02:00:00.000Z", { beans: 9, achievements: [] });
  const current = convergeWildzPlayerState({ actorId: "wildz", current: null, incoming: latest, now: latest.exportedAt });
  const { schema: _schema, payloadDigest: _digest, ...basis } = latest;
  void _schema; void _digest;
  const stale = createWildsPlayerVault({ ...basis, exportedAt: "2026-08-27T02:00:00.000Z", playState: { ...latest.playState, beans: 1, actionHistory: latest.playState.actionHistory.map(entry => ({ ...entry, uPulse: entry.uPulse - 1 })) } });
  const result = convergeWildzPlayerState({ actorId: "wildz", current, incoming: stale, now: stale.exportedAt });
  assert.equal(result.player.playState.beans, 9);
  assert.equal(result.player.exportedAt, latest.exportedAt);
});

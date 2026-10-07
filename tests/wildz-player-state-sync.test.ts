import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault, mergeWildsRemotePlayerPlayState } from "../src/features/play/wilds-player-vault";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { adventureConditionToHearttree } from "../src/features/play/hearttree/card-capability";
import { appendLivingCardHistory } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { mergePlayerContinuity } from "../src/features/identity/wildz-restore";
import {
  convergeWildzPlayerState,
  findWildzPlayerStateRecord,
  WILDZ_PLAYER_STATE_SCHEMA,
  type WildzPlayerStateRecord
} from "../src/lib/receiz/wildz-player-state-sync";

function vault(playerId: string, exportedAt: string, input: { beans: number; achievements: string[]; actionId?: string }) {
  const playState = {
    ...createOwnerBoundInitialPlayState(playerId, "2026-08-26T00:00:00.000Z"),
    actionHistory: [{ id: input.actionId ?? "local:test", kind: "activity" as const, title: "Travel", detail: "Player action", authority: "local" as const, uPulse: Date.parse(exportedAt) }],
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

for (const remotePulse of [99, 100]) {
  test(`a remote card at ledger ${remotePulse} converges without rewinding local ledger 100`, () => {
    const local = createOwnerBoundInitialPlayState("converging", "2026-10-06T00:00:00.000Z");
    const travel = { id: "travel", kind: "activity" as const, title: "Travel", detail: "Moving", authority: "local" as const, uPulse: 100 };
    local.actionHistory = [travel]; local.player = { x: 11, z: 12 }; local.energy = 55;
    const companionId = local.inventory[0]!.id;
    const condition = { ...emptyAdventureCondition(companionId), fatigue: 27, xp: { stewardship: 9 } };
    local.adventureConditions = { ...local.adventureConditions, [companionId]: condition };
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "converging", encounterId: `remote:${remotePulse}`, capturedAt: "2026-10-06T00:00:00.000Z" });
    const restored = { ...local, inventory: [...local.inventory, card], adventureConditions: { [companionId]: emptyAdventureCondition(companionId) }, player: { x: -11, z: -12 }, energy: 25, actionHistory: [{ ...travel, uPulse: remotePulse }], achievements: ["remote-discovery"] };
    const merged = mergeWildsRemotePlayerPlayState({ local, restored, actorId: "converging" });
    assert.ok(merged.inventory.some(asset => asset.id === card.id));
    assert.deepEqual(merged.player, { x: 11, z: 12 });
    assert.equal(merged.energy, 55);
    assert.equal(merged.actionHistory.at(-1)?.uPulse, 100);
    assert.ok(merged.achievements.includes("remote-discovery"));
    assert.deepEqual(merged.adventureConditions[companionId], condition);
    assert.deepEqual(merged.hearttreeConditions[companionId], adventureConditionToHearttree(condition));
  });
}

test("a strictly newer remote ledger advances movement while retaining locally collected cards", () => {
  const local = createOwnerBoundInitialPlayState("converging", "2026-10-06T00:00:00.000Z");
  const travel = { id: "travel", kind: "activity" as const, title: "Travel", detail: "Moving", authority: "local" as const, uPulse: 100 };
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "converging", encounterId: "local:newer-ledger", capturedAt: "2026-10-06T00:00:00.000Z" });
  local.inventory = [...local.inventory, card];
  local.actionHistory = [travel]; local.player = { x: 11, z: 12 }; local.energy = 55;
  const restored = { ...local, inventory: local.inventory.filter(asset => asset.id !== card.id), player: { x: -11, z: -12 }, energy: 25, actionHistory: [{ ...travel, uPulse: 101 }] };
  const merged = mergeWildsRemotePlayerPlayState({ local, restored, actorId: "converging" });
  assert.ok(merged.inventory.some(asset => asset.id === card.id));
  assert.deepEqual(merged.player, { x: -11, z: -12 });
  assert.equal(merged.energy, 25);
  assert.equal(merged.actionHistory.at(-1)?.uPulse, 101);
});

test("an older player ledger with an advanced sealed companion head adopts that head's condition", () => {
  const local = createOwnerBoundInitialPlayState("converging", "2026-10-06T00:00:00.000Z");
  const companion = local.inventory[0]!;
  assert.ok(isLivingCardAsset(companion));
  local.adventureConditions = { [companion.id]: { ...emptyAdventureCondition(companion.id), fatigue: 27, xp: { stewardship: 9 } } };
  const advanced = appendLivingCardHistory({ asset: companion, event: {
    eventId: "remote:condition", rulesetVersion: "wildz.progression.v1", occurredAt: "2026-10-06T00:00:01.000Z",
    source: { mode: "training", activityId: "remote:training", actorId: "converging", authority: "local" }, evidence: {},
    effects: [{ kind: "condition", delta: { assetId: companion.id, lifeBefore: "alive", lifeAfter: "alive", fatigueDelta: 10,
      injuriesAdded: [], xp: { stewardship: 12 }, mastery: {}, upgradeIdsAdded: [], receiptDigestsAdded: [] } }]
  } });
  const merged = mergeWildsRemotePlayerPlayState({ local, restored: { ...local, inventory: [advanced] }, actorId: "converging" });
  assert.equal(merged.inventory[0]?.proof.digest, advanced.proof.digest);
  assert.equal(merged.adventureConditions[companion.id]?.fatigue, 10);
  assert.equal(merged.adventureConditions[companion.id]?.xp.stewardship, 12);
});

test("remote continuity retains imported events, receipts and the latest world cursor", () => {
  const remote = vault("converging", "2026-10-06T00:00:00.000Z", { beans: 0, achievements: [] });
  remote.personalEvents = [{ eventId: "cloud:event", kind: "story", occurredAt: remote.exportedAt }];
  remote.receipts = [{ eventId: "cloud:receipt", digest: `sha256:${"a".repeat(64)}` }];
  const local = { settings: remote.settings, personalEvents: [{ eventId: "imported:event", kind: "story", occurredAt: remote.exportedAt }],
    receipts: [{ eventId: "imported:receipt", digest: `sha256:${"b".repeat(64)}` }],
    canonicalCursor: { worldId: "wilds:global:v3" as const, revision: 12, eventId: "world:12" } };
  const merged = mergePlayerContinuity(local, remote)!;
  assert.deepEqual(merged.personalEvents.map(event => event.eventId), ["imported:event", "cloud:event"]);
  assert.deepEqual(merged.receipts.map(receipt => receipt.eventId), ["imported:receipt", "cloud:receipt"]);
  assert.deepEqual(merged.canonicalCursor, local.canonicalCursor);
  assert.equal(mergePlayerContinuity(local, { ...remote, canonicalCursor: { ...local.canonicalCursor, revision: 13, eventId: "world:13" } })?.canonicalCursor.revision, 13);
});

test("story ledger convergence retains both devices' actions and the latest coalesced travel record", () => {
  const local = createOwnerBoundInitialPlayState("converging", "2026-10-06T00:00:00.000Z");
  const entry = { kind: "activity" as const, title: "Travel", detail: "Newer location", authority: "local" as const };
  local.actionHistory = [{ ...entry, id: "travel", uPulse: 100 }, { ...entry, id: "local:work", uPulse: 95 }];
  const restored = { ...local, actionHistory: [{ ...entry, id: "travel", uPulse: 99, detail: "Older location" }, { ...entry, id: "remote:work", uPulse: 90 }] };
  const merged = mergeWildsRemotePlayerPlayState({ local, restored, actorId: "converging" });
  assert.deepEqual(merged.actionHistory.map(activity => activity.id), ["remote:work", "local:work", "travel"]);
  assert.equal(merged.actionHistory.at(-1)?.detail, "Newer location");
  assert.equal(merged.actionHistory.at(-1)?.uPulse, 100);
});

test("server convergence keeps both devices' story records before a newer state is pulled", () => {
  const first = vault("converging", "2026-10-06T00:00:00.000Z", { beans: 4, achievements: [], actionId: "device:a" });
  const current = convergeWildzPlayerState({ actorId: "converging", current: null, incoming: first, now: first.exportedAt });
  const second = vault("converging", "2026-10-06T00:01:00.000Z", { beans: 9, achievements: [], actionId: "device:b" });
  const converged = convergeWildzPlayerState({ actorId: "converging", current, incoming: second, now: second.exportedAt });
  assert.deepEqual(converged.player.playState.actionHistory.map(entry => entry.id), ["device:a", "device:b"]);
  assert.equal(converged.player.playState.beans, 9);
});

test("an imported malformed activity is filtered before remote history enters runtime state", () => {
  const local = createOwnerBoundInitialPlayState("converging", "2026-10-06T00:00:00.000Z");
  const good = { id: "valid", kind: "activity" as const, title: "Travel", detail: "A recorded journey", authority: "local" as const, uPulse: 100 };
  const restored = { ...local, actionHistory: [good, { ...good, id: undefined, uPulse: NaN }] as unknown as typeof local.actionHistory };
  const merged = mergeWildsRemotePlayerPlayState({ local, restored, actorId: "converging" });
  assert.deepEqual(merged.actionHistory, [{ ...good, constitution: undefined }]);
});

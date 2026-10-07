import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { WildsSagaPanel } from "../src/features/play/WildsSagaPanel.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director.js";
import { projectMissionGraph } from "../src/features/play/wilds-saga-missions.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("living saga interface", () => {
  it("updates Story so far with completed objectives, the live next step and readable chapter memories", () => {
    const framework = wildsSagaFramework();
    const remembered = framework.dailyChapters[0]!;
    const saga = projectWildsSaga({ moment: deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "local" }), framework,
      memories: [{ chapterId: remembered.id, dayId: "saga:day:previous", outcome: "success", hookId: remembered.outcomeHooks.success,
        settledEventId: "story:previous", settledAt: "2026-07-15T22:00:00.000Z" }] });
    const first = saga.chapter.missions.find(mission => mission.primary)!.nodes[0]!;
    const missions = projectMissionGraph({ saga, playerId: "player:source", contributions: [{ eventId: "story:step", dayId: saga.dayId,
      objectiveId: first.id, playerId: "player:source", verb: first.acceptedVerbs[0]!, amount: first.target }], currentDayId: saga.dayId });
    const markup = renderToStaticMarkup(createElement(WildsSagaPanel, { saga, missions, player: null, trainers: [], tournament: null,
      mode: "receiz_recovery_pending", playerId: "player:source", playerName: "Source Keeper", pending: false,
      onContribute() {}, onBattleTrainer() {}, onEnterTournament() {} }));
    const history = markup.slice(markup.indexOf('class="wilds-saga-history"'));
    assert.match(history, /Completed/);
    assert.ok(history.includes(first.title));
    assert.ok(history.includes(missions.recommended!.definition.title));
    assert.ok(history.includes(remembered.title));
    assert.match(history, /Path restored/);
    assert.ok(!history.includes(remembered.id));
    assert.ok(!history.includes(remembered.outcomeHooks.success));
  });

  it("keeps source-admissible story work available while global projection reconnects", () => {
    const saga = projectWildsSaga({
      moment: deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "local" }),
      framework: wildsSagaFramework(),
      memories: []
    });
    const missions = projectMissionGraph({ saga, playerId: "player:source", contributions: [], currentDayId: saga.dayId });
    const markup = renderToStaticMarkup(createElement(WildsSagaPanel, {
      saga,
      missions,
      player: null,
      trainers: [],
      tournament: null,
      mode: "receiz_recovery_pending",
      playerId: "player:source",
      playerName: "Source Keeper",
      pending: false,
      onContribute() {},
      onBattleTrainer() {},
      onEnterTournament() {}
    }));

    assert.match(markup, /<button class="wilds-saga-action is-primary"/);
    assert.doesNotMatch(markup, /<button class="wilds-saga-action is-primary"[^>]*disabled=""/);
    assert.match(markup, /admitted locally/i);
  });

  it("presents the shared chapter, causal history, objectives, trainers, and tournament accessibly", () => {
    const panel = source("src/features/play/WildsSagaPanel.tsx");
    const hud = source("src/features/play/WildsLivingWorldHud.tsx");
    const campaign = source("src/features/play/PlayCampaign.tsx");

    for (const phrase of [
      "Today's living chapter",
      "Next objective",
      "Why the world changed",
      "Trainer level",
      "Daily tournament",
      "Story so far",
      'aria-live="polite"',
      "worldMutable"
    ]) assert.match(panel, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    assert.match(hud, /activeChapter/);
    assert.match(campaign, /WildsSagaPanel/);
    assert.doesNotMatch(campaign, /nearestSagaTrainer/);
    assert.match(campaign, /activeTrainer/);
    assert.match(campaign, /MortalArenaExperience/);
    assert.doesNotMatch(`${panel}\n${campaign}`, /Brandable reward|brandable merchant|portable merchant rewards/i);
  });

  it("projects trainer NPCs into the world and atlas with distance guidance", () => {
    const campaign = source("src/features/play/PlayCampaign.tsx");
    const world = source("src/features/play/WildsWorldCanvas.tsx");
    const map = source("src/features/play/WildsWorldMap.tsx");
    const atlas = source("src/features/play/wilds-world-atlas.ts");

    assert.match(world, /TrainerExplorer/);
    assert.match(world, /trainers\.map/);
    assert.match(map, /trainers/);
    assert.match(atlas, /trainers:/);
    assert.match(world, /distance <= 12/);
    assert.match(world, /wilds-trainer-challenge-prompt/);
    assert.match(world, /Tap to challenge/);
    assert.doesNotMatch(campaign, /m away/);
  });

  it("keeps living-world pills contextual and lets a solo player enter the selected boss raid", () => {
    const hud = source("src/features/play/WildsLivingWorldHud.tsx");
    const campaign = source("src/features/play/PlayCampaign.tsx");

    assert.match(hud, /type LivingWorldDetail/);
    assert.match(hud, /setDetail\(\{ kind: "boss"/);
    assert.match(hud, /setDetail\(\{ kind: "ecology"/);
    assert.match(hud, /Health remaining/);
    assert.match(hud, /Fight solo/);
    assert.match(hud, /onEnterRaid\(selectedBoss\.id\)/);
    assert.doesNotMatch(hud, /world\.joinRaid\(/);
    assert.match(campaign, /onEnterRaid=\{enterLivingRaid\}/);
  });
});

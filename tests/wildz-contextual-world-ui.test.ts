import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  dismissIncomingChallengeWhenBlocked,
  shareWildzInviteWhenEnabled,
  shouldShowIncomingChallenge
} from "../src/features/play/wilds-multiplayer-controls";

const read = (path: string) => readFileSync(path, "utf8");

test("world HUD is one active-creature capsule, one objective, and orientation", () => {
  const hud = read("src/features/play/WildzReferenceHud.tsx");
  assert.match(hud, /WildsCreatureThumbnail/);
  assert.match(hud, /activeCard/);
  assert.match(hud, /wildz-companion-vitality/);
  assert.match(hud, /wildz-mission-chip/);
  assert.match(hud, /<WildzMinimap/);
  assert.match(hud, /className="wildz-identity-home"/);
  assert.match(hud, /className="wildz-mission-home"/);
  assert.match(hud, /className="wildz-map-home"/);
  assert.match(hud, /<strong>\{model\.player\.displayName \|\| model\.player\.username\}<i>✓<\/i><\/strong>/);
  assert.doesNotMatch(hud, /<strong>\{activeCard\.manifest\.name\}<i>✓<\/i><\/strong>/);
  assert.doesNotMatch(hud, /wildz-status-rail|wildz-energy-meter|wildz-xp-meter/);
});

test("campaign projects one modal owner and gates underlying world input", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");

  assert.match(campaign, /const exclusiveOwner[^=]*=\s*trainerEncounter\?\.phase === "combat"\s*\|\| Boolean\(state\.battle\)\s*\|\| Boolean\(multiplayer\.activeBattle\)\s*\? "combat"/);
  assert.match(campaign, /:\s*activeTrainer && activeAsset && trainerEncounter && \["challenge", "transition", "result"\]\.includes\(trainerEncounter\.phase\)\s*\? "trainer"/);
  assert.match(campaign, /:\s*mapOpen\s*\? "map"\s*:\s*"none"/);
  assert.match(campaign, /exclusiveOwner=\{exclusiveOwner\}/);
  assert.match(campaign, /const worldInteractionEnabled = interactionEnabled && exclusiveOwner === "none"/);
  assert.match(campaign, /if \(!worldInteractionEnabled \|\| !avatarStyle\) return/);
  assert.match(campaign, /searchEnabled=\{worldInteractionEnabled && discoveryActive && Boolean\(avatarStyle\)\}/);
});

test("exclusive ownership dismisses multiplayer expansions and blocks roster and challenge actions", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const multiplayer = read("src/features/play/WildsMultiplayer.tsx");

  assert.match(campaign, /<WildsMultiplayer[\s\S]*dismissSignal=\{commandDismissSignal\}[\s\S]*interactionEnabled=\{worldInteractionEnabled\}/);
  assert.match(multiplayer, /dismissSignal: number/);
  assert.match(multiplayer, /interactionEnabled: boolean/);
  assert.match(multiplayer, /setRosterOpen\(false\);[\s\S]*setChatOpen\(false\);[\s\S]*setMessage\(""\);[\s\S]*multiplayer\.selectPlayer\(null\)/);
  assert.match(multiplayer, /className=\{`wilds-live-badge[\s\S]*disabled=\{!interactionEnabled\}/);
  assert.match(multiplayer, /disabled=\{!interactionEnabled \|\| !canInteract\}/);
  assert.match(multiplayer, /if \(!interactionEnabled\) return;[\s\S]*multiplayer\.offerChallenge/);
  assert.match(multiplayer, /disabled=\{!interactionEnabled\}[\s\S]*multiplayer\.answerChallenge/);
});

test("exclusive ownership suppresses an incoming multiplayer challenge", () => {
  const incomingChallenge = { id: "challenge-1" };

  assert.equal(shouldShowIncomingChallenge(true, incomingChallenge), true);
  assert.equal(shouldShowIncomingChallenge(false, incomingChallenge), false);
  assert.equal(shouldShowIncomingChallenge(true, null), false);
});

test("exclusive ownership safely declines an incoming multiplayer challenge", async () => {
  const answers: Array<{ id: string; action: "accept" | "decline" }> = [];

  const dismissed = await dismissIncomingChallengeWhenBlocked(
    false,
    "challenge-1",
    async (id, action) => {
      answers.push({ id, action });
    }
  );

  assert.equal(dismissed, true);
  assert.deepEqual(answers, [{ id: "challenge-1", action: "decline" }]);
});

test("exclusive ownership prevents invite creation and sharing", async () => {
  let createCalls = 0;
  let shareCalls = 0;

  const result = await shareWildzInviteWhenEnabled(
    false,
    async () => {
      createCalls += 1;
      return "https://wildz.quest/?wildsJoin=room";
    },
    async () => {
      shareCalls += 1;
      return "shared" as const;
    }
  );

  assert.equal(result, null);
  assert.equal(createCalls, 0);
  assert.equal(shareCalls, 0);
});

test("multiplayer UI connects exclusive ownership to incoming challenge and share guards", () => {
  const multiplayer = read("src/features/play/WildsMultiplayer.tsx");

  assert.match(multiplayer, /shouldShowIncomingChallenge\(interactionEnabled, multiplayer\.incomingChallenge\)/);
  assert.match(multiplayer, /shareWildzInviteWhenEnabled\([\s\S]*interactionEnabled,[\s\S]*multiplayer\.createInviteLink/);
  assert.match(multiplayer, /className="wilds-live-share"[\s\S]*disabled=\{!interactionEnabled\}/);
});

test("campaign removes duplicate world chrome and persistent distant trainer navigation", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  for (const legacy of ["wilds-hud-top", "wilds-resource-strip", "runner-card", "wilds-mission-meter", "wilds-trainer-navigator"]) {
    assert.doesNotMatch(campaign, new RegExp(legacy));
  }
  assert.match(campaign, /activeCard=\{activeAsset\}/);
  assert.match(campaign, /condition=\{activeAsset \? state\.adventureConditions\[activeAsset\.id\] : undefined\}/);
});

test("visible trainers remain directly tappable and show challenge copy only within twelve meters", () => {
  const world = read("src/features/play/WildsWorldCanvas.tsx");
  assert.match(world, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); onSelect\(trainer\); \}\}/);
  assert.match(world, /distance <= 12/);
  assert.match(world, /wilds-trainer-challenge-prompt/);
  assert.match(world, /Battle trainer/);
});

test("mobile HUD reserves corners and leaves target prompts unobstructed", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.wildz-companion-capsule\s*\{/);
  assert.match(css, /\.wilds-trainer-challenge-prompt\s*\{/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.wildz-companion-capsule/s);
});

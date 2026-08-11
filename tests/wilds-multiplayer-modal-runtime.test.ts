import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsMultiplayer } from "../src/features/play/WildsMultiplayer";
import type { WildsMultiplayerController } from "../src/features/play/use-wilds-multiplayer";

const card = {
  assetId: "fixture-card",
  proofDigest: "sha256:fixture-card",
  name: "Gradoaw",
  stats: { health: 52, power: 41, guard: 38, speed: 35, bond: 22 },
  abilities: [
    { name: "Stone Pulse", power: 18 },
    { name: "Root Guard", power: 14 }
  ] as [{ name: string; power: number }, { name: string; power: number }]
};

const remotePlayer = {
  playerId: "player-remote",
  handle: "Aster",
  style: "female" as const,
  x: 2,
  z: 2,
  heading: 0,
  status: "available" as const,
  lastSeenAt: "2026-08-11T12:00:00.000Z",
  practice: false,
  activeCard: card
};

function controller(): WildsMultiplayerController {
  return {
    guestId: "fixture-guest",
    roomKey: "wilds:fixture:0:0",
    selfId: "player-self",
    mode: "receiz_live",
    error: "",
    snapshot: null,
    remotePlayers: [remotePlayer],
    selectedPlayer: remotePlayer,
    selectedPlayerId: remotePlayer.playerId,
    selectPlayer: () => {},
    activeBattle: null,
    incomingChallenge: {
      id: "challenge-1",
      roomKey: "wilds:fixture:0:0",
      challengerId: remotePlayer.playerId,
      opponentId: "player-self",
      challengerCard: card,
      opponentCard: null,
      mode: "friendly",
      state: "offered",
      revision: 1,
      offeredAt: "2026-08-11T12:00:00.000Z",
      acceptedAt: null,
      closedAt: null,
      expiresAt: "2026-08-11T12:00:45.000Z"
    },
    createInviteLink: async () => "https://wildz.quest/",
    sendMessage: async () => null as never,
    offerChallenge: async () => null as never,
    answerChallenge: async () => null as never,
    submitIntent: async () => null as never,
    dismissBattle: () => {},
    refresh: async () => {}
  };
}

test("incoming challenge ownership renders only the challenge, never selected-player details", () => {
  const markup = renderToStaticMarkup(createElement(WildsMultiplayer, {
    battleModalOwned: false,
    dismissSignal: 0,
    interactionEnabled: false,
    modalOwned: true,
    multiplayer: controller(),
    position: { x: 0, z: 0 }
  }));

  assert.doesNotMatch(markup, /Interact with Aster/);
  assert.doesNotMatch(markup, /wilds-player-sheet/);
});

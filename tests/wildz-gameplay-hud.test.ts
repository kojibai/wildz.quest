import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { projectWildzHud } from "../src/features/play/wildz-gameplay-hud";

test("HUD projection exposes existing energy XP mission and companion state", () => {
  const model = projectWildzHud(initialPlayState, { username: "minttrail", displayName: "Mint Trail" });
  assert.equal(model.player.username, "minttrail");
  assert.equal(model.player.displayName, "Mint Trail");
  assert.equal(model.energy.current, initialPlayState.energy);
  assert.equal(model.xp.current, initialPlayState.cardXp);
  assert.equal(model.mission.progress, initialPlayState.missionProgress);
  assert.equal(model.mission.title, "Living Expedition 1");
  assert.equal(model.companion.name, "SealCub");
});

test("HUD projection preserves bounded percentages", () => {
  const model = projectWildzHud({ ...initialPlayState, energy: 101, cardXp: 200, challenge: -1, missionProgress: 999 }, { username: "trail", displayName: "Trail" });
  assert.equal(model.energy.current, 100);
  assert.equal(model.xp.progress, 0);
  assert.equal(model.mission.progress, 99);
});

test("HUD names the next living mission from recorded completion history", () => {
  const model = projectWildzHud({
    ...initialPlayState,
    completedMissionIds: ["living-expedition:1", "living-expedition:2"],
    missionProgress: 7
  }, { username: "trail", displayName: "Trail" });
  assert.equal(model.mission.title, "Living Expedition 3");
  assert.equal(model.mission.progress, 7);
});

import {KAI_N_DAY_MICRO} from '../src/features/play/kai-klok-moment';
import {createPlayerBreaths,advancePlayerBreaths} from '../src/features/play/player-breath-energy';
import {applyWildsInput,serializePlayState} from '../src/features/play/game-state';
const BREATH_DAY=Number(KAI_N_DAY_MICRO),BREATH_BASE=BREATH_DAY*100;
test('clock-only HUD updates analytically show drain without changing the saved player',()=>{
 const state={...initialPlayState,energy:100,playerBreaths:createPlayerBreaths(BREATH_BASE,100)},saved=serializePlayState(state);
 for(let i=1;i<=20;i++){const hud=projectWildzHud(state,{username:'owner',displayName:'Explorer'},BREATH_BASE+Math.floor(BREATH_DAY*i/20));if(i===20){assert.equal(hud.energy.current,95);assert.equal(hud.energy.breaths?.spentTodayBreaths,0);assert.equal(hud.energy.breaths?.day,101);}}
 assert.equal(serializePlayState(state),saved);assert.equal(state.playerBreaths.lastKaiUPulse,BREATH_BASE);
 const settled=applyWildsInput(state,{type:'energy-tick',kaiUPulse:BREATH_BASE+BREATH_DAY});assert.equal(settled.energy,95);
});
test('a resting HUD recovers elapsed breaths without publishing or ending camp',()=>{
 const state={...initialPlayState,energy:20,playerBreaths:advancePlayerBreaths(createPlayerBreaths(BREATH_BASE,20),BREATH_BASE,'camp')},saved=serializePlayState(state);
 const hud=projectWildzHud(state,{username:'owner',displayName:'Explorer'},BREATH_BASE+Math.floor(BREATH_DAY/20));
 assert.equal(hud.energy.current,60);assert.equal(hud.energy.breaths?.mode,'camp');assert.equal(serializePlayState(state),saved);
});

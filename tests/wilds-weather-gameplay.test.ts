import assert from "node:assert/strict";
import test from "node:test";
import { applyWildsFlightWind, createWildsKaiWeatherSample, writeWildsKaiWeather } from "../src/features/play/wilds-kai-wind";
import { writeWildsWeatherExposure } from "../src/features/play/wilds-weather-exposure";
import { createGroundedWildsAerialState, beginWildsAerialTraversal, writeWildsAerialRuntimeStep, createWildsAerialRuntimeResult } from "../src/features/play/wilds-aerial-traversal";
import type { WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";
test("weather is repeatable at exact Kai and changes continuously across time and space", () => {
  const a = writeWildsKaiWeather(createWildsKaiWeatherSample(), 1_000_000_000, 3, 4);
  assert.deepEqual(a, writeWildsKaiWeather(createWildsKaiWeatherSample(), 1_000_000_000, 3, 4));
  const b = writeWildsKaiWeather(createWildsKaiWeatherSample(), 1_000_000_001, 3.001, 4);
  assert.ok(Math.abs(a.windSpeed - b.windSpeed) < .001);
});
test("headwind resists flight while tailwind changes the intended displacement", () => {
  const weather = { ...createWildsKaiWeatherSample(), windX: 6, windSpeed: 6, flightLoad: .5 };
  const downwind = applyWildsFlightWind({ x: 1, z: 0 }, { x: 0, z: 0 }, weather);
  const upwind = applyWildsFlightWind({ x: -1, z: 0 }, { x: 0, z: 0 }, weather);
  assert.ok(downwind.x > Math.abs(upwind.x));
  assert.deepEqual(applyWildsFlightWind({x:0,z:0},{x:0,z:0},weather),{x:0,z:0});
});
test("flight spends more energy in exposed weather, with no penalty while grounded", () => {
  const state = () => beginWildsAerialTraversal(createGroundedWildsAerialState({x:0,z:0},0), {kind:"flight", capabilities:["flight"]}).state;
  const calm = state(), storm = state();
  const input = {deltaSeconds:.1,groundElevation:0,hasFlight:true,hasGlide:false,horizontalDistance:1,positionX:0,positionZ:0,verticalOffset:3};
  writeWildsAerialRuntimeStep(calm,input,createWildsAerialRuntimeResult());
  writeWildsAerialRuntimeStep(storm,{...input,weatherLoad:1},createWildsAerialRuntimeResult());
  assert.ok(storm.stamina < calm.stamina);
  const ground = createGroundedWildsAerialState({x:0,z:0},0);
  writeWildsAerialRuntimeStep(ground,{...input,weatherLoad:1},createWildsAerialRuntimeResult());
  assert.equal(ground.stamina,100);
});
test("only built overhead and windward solids shelter the player", () => {
  const weather={...createWildsKaiWeatherSample(), precipitation:1,windX:6,windSpeed:6};
  const roof:WildsTerrainObstacle={id:"roof",kind:"structure",material:"solid",position:{x:0,y:3,z:0},radius:4,visualScale:1,shape:{kind:"box",halfX:3,halfY:.2,halfZ:3},airbornePolicy:"clearable"};
  const point={x:0,y:0,z:0};const target={rain:0,wind:1,sheltered:false};
  assert.equal(writeWildsWeatherExposure(target,weather,point,[]).rain,1);
  assert.equal(writeWildsWeatherExposure(target,weather,point,[roof]).rain,0);
  assert.equal(target.sheltered,true);
  assert.equal(writeWildsWeatherExposure(target,weather,{...point,x:4},[roof]).rain,1);
  const wall={...roof,id:"wall",position:{x:-2,y:1.5,z:0},shape:{kind:"box" as const,halfX:.15,halfY:1.5,halfZ:3}};
  assert.ok(writeWildsWeatherExposure(target,weather,point,[wall]).wind < .5);
  assert.equal(writeWildsWeatherExposure(target,weather,point,[{...wall,position:{...wall.position,x:2}}]).wind,1);
});

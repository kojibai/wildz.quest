import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { mountFrameComponent } from './support/frame-component-harness';
import { createWildsFlightCameraControlState, writeWildsFlightCameraControlState } from '../src/features/play/wilds-flight-camera';
import { writeUnderwaterCameraTarget, isUnderwaterCameraSubmerged } from '../src/features/play/wilds-underwater-camera';
import { projectWildsExplorerAnatomy } from '../src/features/play/wilds-explorer-anatomy';
import { createWildsExplorerFace, createWildsExplorerTorso } from '../src/features/play/wilds-explorer-face';
import { writeWildsExplorerOrientation, writeWildsExplorerWingFlightPose } from '../src/features/play/wilds-explorer-flight-pose';
import { playerBodyBreathExpansion } from '../src/features/play/player-breath-energy';
import * as aerial from '../src/features/play/wilds-aerial-traversal';
import * as vertical from '../src/features/play/wilds-vertical-traversal';
import * as ground from '../src/features/play/wilds-grounded-movement';
import * as sites from '../src/features/play/wilds-site-runtime';
import * as weather from '../src/features/play/wilds-kai-wind';
import * as exposure from '../src/features/play/wilds-weather-exposure';
import * as body from '../src/features/play/wilds-player-body';
import { admitWildsDiscoveryPhysicalNeighborhood } from '../src/features/play/wilds-discovery-sites';
import { creatureForm } from '../src/features/play/creature-catalog';
import * as creatureMotion from '../src/features/play/WildsCreatureActor';
import { companionFootRows, companionFootStep, writeWildsCompanionAnimation } from '../src/features/play/wilds-companion-gait';
import { threeCreatureColor } from '../src/features/play/card-kai-appearance';
import { readFileSync } from 'node:fs';

test('battle pose changes reach the accepted pose on the first frame while ongoing animation keeps its cadence', () => {
  const actor = mountFrameComponent('src/features/play/WildsCreatureActor.tsx', ['WildsCreatureActor'], {
    ...creatureMotion, creatureForm, companionFootRows, companionFootStep, writeWildsCompanionAnimation, threeCreatureColor,
    useWildsReadability: () => ({ motionScale: 1, actorEmissive: .1 }),
    useWildsCharacterTexture: () => null, useWildsNaturalTexture: () => null,
    CreatureIdentityDetail: 'identity-detail',
    identityNumber: () => .5, performance: { now: () => 1000 }
  });
  const root = new THREE.Group();
  const props = { formId: 'mintcub-1', familyId: 'mintcub', primary: '#44aa66', secondary: '#ffffff', accent: '#ffee22', glow: '#44aa66', pose: 'idle' };
  const render = () => { const tree = actor.render(props); tree.props.ref.current = root; actor.flushEffects(); };
  render(); actor.frame();
  props.pose = 'weakened'; render(); actor.frame();
  assert.equal(root.position.y, .38, 'accepted weakened state has no remaining idle height');
  assert.equal(root.rotation.z, -.08);
  props.pose = 'impact'; render(); actor.frame();
  const impact = creatureMotion.projectWildsCreatureLocomotionFrame({ locomotion: 'ground', timeSeconds: 1, marking: .5, motionScale: 1, pose: 'impact' });
  assert.equal(root.rotation.z, impact.rootRoll);
  root.rotation.z = .1;
  actor.frame();
  assert.ok(Math.abs(root.rotation.z - (.1 + (impact.rootRoll - .1) * (1 - Math.exp(-18 / 60)))) < 1e-12, 'continuing impact animation retains its original blend');
});

test('state meters and the movement knob never animate behind their accepted values', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  for (const selector of ['.wilds-battle-world-stat-meter > b', '.wilds-pvp-fighters [role="progressbar"] i', '.mortal-arena-life > div i', '.wilds-construction-site-progress i', '.wilds-raid-health i::after', '.hearttree-vitals i', '.wildz-dpad-knob']) {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0);
    const rule = css.slice(start, css.indexOf('}', start));
    assert.doesNotMatch(rule, /transition:\s*(?:width|transform)\s/);
  }
  const roaming = readFileSync('src/features/play/WildsRoamingBattle.module.css', 'utf8');
  assert.doesNotMatch(roaming.match(/\.health i \{[^}]*\}/)?.[0] ?? '', /transition:\s*width\s/);
});

function aerialPlayer() {
  const physical = admitWildsDiscoveryPhysicalNeighborhood(0, 0);
  const siteRuntime = sites.prepareWildsSiteRuntime({ ...physical, sites: [], solids: [], surfaces: [], ceilings: [], mountainFields: [], portals: [], waterVolumes: [], encounterVolumes: [] });
  const runtime = { current: aerial.createGroundedWildsAerialState({ x: 0, z: 0 }, 10) };
  const verticalTraversalRef = { current: vertical.createWildsVerticalTraversalState() };
  const props = {
    kaiUPulse: 1_000_000, capabilities: ['flight', 'swim'], runtime, verticalTraversalRef,
    aquaticPresentation: { mode: 'land', terrainElevation: 10, waterSurfaceY: 20, actorLocalY: 0 },
    flightEndurancePotential: 1, liftPotential: 1, pressurePotential: 1, swimStamina: 100,
    horizontalAllowedRef: { current: true }, verticalIntentRef: { current: 0 },
    terrainObstacleNeighborhood: { tileX: 0, tileZ: 0, obstacles: [] }, livingPhysicalObstacles: [],
    siteRuntime, siteSpace: { spaceId: 'wildz.space.outer.v1' }, player: { x: 0, z: 0 },
    onEnergyChange() {}, onModeChange() {}, onLandingRequired() {}, onVerticalReadoutChange() {}
  };
  const actor = mountFrameComponent('src/features/play/WildsWorldCanvas.tsx', ['AerialPlayerFrame'], {
    ...aerial, ...vertical, ...ground, ...sites, ...weather, ...exposure, ...body
  });
  const group = new THREE.Group();
  const render = () => { const tree = actor.render(props); tree.props.ref.current = group; actor.flushEffects(); };
  render();
  return { actor, group, props, render };
}

test('rendered flight and swim height equal the physical traversal height every frame', () => {
  const { actor, group, props, render } = aerialPlayer();
  props.runtime.current = aerial.beginWildsAerialTraversal(props.runtime.current, { kind: 'flight', capabilities: ['flight'] }).state;
  render(); actor.frame();
  assert.ok(props.verticalTraversalRef.current.offset >= .35, 'the original physical takeoff still applies');
  assert.equal(group.position.y, props.verticalTraversalRef.current.offset);
  props.runtime.current = aerial.createGroundedWildsAerialState(props.player, 10);
  props.aquaticPresentation = { ...props.aquaticPresentation, mode: 'swim', actorLocalY: 4 };
  render(); actor.frame();
  assert.equal(props.verticalTraversalRef.current.layer, 'water');
  assert.equal(group.position.y, props.verticalTraversalRef.current.offset);
});

test('returning to ground clears a previous underwater display offset before drawing', () => {
  const { actor, group, props, render } = aerialPlayer();
  props.verticalTraversalRef.current.layer = 'water';
  props.verticalTraversalRef.current.offset = -3;
  group.position.y = -3;
  props.capabilities = []; render(); actor.frame();
  assert.equal(props.verticalTraversalRef.current.layer, 'ground');
  assert.equal(group.position.y, 0, 'an actor cannot display underneath the accepted ground');
  group.position.y = 4; actor.frame();
  assert.equal(group.position.y, 0, 'landing must not retain an old flight display offset');
});

test('accepted world movement has no residual translation on its first display frame', () => {
  const world = mountFrameComponent('src/features/play/WildsWorldCanvas.tsx', ['WorldFrame', 'SmoothWorldFrame']);
  const group = new THREE.Group();
  const mount = (player: { x: number; z: number }, terrainElevation: number) => {
    const tree = world.render({ player, terrainElevation, children: 'world' });
    if (tree.props.ref) tree.props.ref.current = group;
    world.flushEffects();
    world.frame();
  };
  mount({ x: 2, z: -1 }, 10);
  mount({ x: 2.25, z: -1.5 }, 10.3);
  assert.deepEqual(group.position.toArray(), [0, 0, 0], 'the world must show the accepted position without easing behind it');
  mount({ x: -400, z: 900 }, -2);
  assert.deepEqual(group.position.toArray(), [0, 0, 0], 'portal/restore rebases must also be immediate');
});

function cameraRig() {
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 60);
  camera.position.set(0, 5, 8);
  const headings: number[] = [];
  const controls = { target: new THREE.Vector3(0, .9, 0), update() {} };
  const vertical = { layer: 'air', offset: 3 };
  const props = {
    terrainElevation: 10, actualCameraSubmergedRef: { current: false }, verticalTraversalRef: { current: vertical },
    aquaticPresentation: { mode: 'land', terrainElevation: 10, waterSurfaceY: 10, waterDepth: 0, actorLocalY: 0, actorWorldY: 10, cameraSubmersionAllowed: false },
    onCameraHeadingChange: (heading: number) => headings.push(heading), vistaHeading: null,
    siteRuntime: sites.prepareWildsSiteRuntime({ ...admitWildsDiscoveryPhysicalNeighborhood(0, 0), mountainFields: [] }), siteSpace: { spaceId: 'wildz.space.outer.v1' }, player: { x: 2, z: -1 }
  };
  const rig = mountFrameComponent('src/features/play/WildsWorldCanvas.tsx', ['CameraRig'], {
    useThree: () => ({ camera }), OrbitControls: 'orbit', createWildsFlightCameraControlState, writeWildsFlightCameraControlState,
    writeUnderwaterCameraTarget, isUnderwaterCameraSubmerged,
    writeWildsSiteRuntimeCamera: () => ({ floorY: 10, ceilingY: Infinity, flooded: false }),
    wildsSiteRuntimeCameraIsFlooded: () => false, writeWildsInteriorCameraPosition: () => {},
    writeWildsMountainCameraPosition: sites.writeWildsMountainCameraPosition
  });
  const tree = rig.render(props);
  tree.props.ref.current = controls;
  rig.flushEffects();
  return { rig, tree, camera, controls, headings, props, vertical };
}

test('flight camera follows the current physical height on the first frame and preserves orbit offset', () => {
  const { rig, tree, camera, controls } = cameraRig();
  const offset = tree.props.camera.position.y - controls.target.y;
  rig.frame();
  assert.equal(controls.target.y, 3.9);
  assert.ok(Math.abs(camera.position.y - (3.9 + offset)) < 1e-12);
  assert.equal(camera.position.x, 0);
  assert.equal(camera.position.z, 8);
});

test('world orbit uses the entire gesture immediately without residual damping', () => {
  const { tree } = cameraRig();
  assert.equal(tree.props.enableDamping, false);
  assert.equal(tree.props.enablePan, false);
  assert.equal(tree.props.rotateSpeed, .62);
  assert.equal(tree.props.zoomSpeed, .82);
  assert.equal(tree.props.minDistance, .45);
  assert.equal(tree.props.maxDistance, 12.5);
});

test('orbit changes publish camera-relative movement heading before another frame', () => {
  const { tree, camera, headings } = cameraRig();
  tree.props.camera.position.set(8, 5, 0);
  tree.props.onChange?.();
  assert.equal(headings.at(-1), Math.PI / 2);
  assert.equal(camera.position.x, 8);
  assert.equal(camera.position.z, 0);
});

test('underwater height and ceiling clearance apply on the same display frame', () => {
  const { rig, props, controls, camera } = cameraRig();
  props.verticalTraversalRef.current = { layer: 'water', offset: -2 };
  props.aquaticPresentation = { mode: 'swim', terrainElevation: 10, waterSurfaceY: 12, waterDepth: 2, actorLocalY: -2, actorWorldY: 8, cameraSubmersionAllowed: true };
  rig.render(props);
  rig.frame();
  assert.ok(camera.position.y <= 1.4 + 1e-12);
  assert.equal(props.actualCameraSubmergedRef.current, true);
  assert.ok(controls.target.y < -2);
});

test('arena fighters display their accepted combat positions on the first frame', () => {
  const actor = mountFrameComponent('src/features/games/mortal-arena/MortalArenaScene.tsx', ['ArenaFighter'], {
    projectCardKaiAppearance: () => ({ palette: { primary: '#000', accent: '#fff', secondary: '#888', glow: '#fff' } }),
    WildsCreatureActor: 'creature', Sparkles: 'sparkles'
  });
  const fighter = { position: { x: 3000, y: 1000, z: -2000 }, facing: -1, vitality: 100, maxVitality: 100, recoveryTicks: 0 };
  const tree = actor.render({ card: { id: 'card', manifest: { familyId: 'mintcub', formId: 'mintcub-1', variant: { traits: { palette: { primary: '#000', accent: '#fff' } } } } }, fighter, side: 'player' });
  const group = new THREE.Group(); tree.props.ref.current = group;
  actor.frame();
  assert.deepEqual(group.position.toArray(), [3, 1.46, -2]);
  fighter.position = { x: -4000, y: 0, z: 2000 }; actor.frame();
  assert.deepEqual(group.position.toArray(), [-4, .46, 2]);
});

test('Hearttree camera follows the active actor without an extra easing queue', () => {
  const camera = new THREE.PerspectiveCamera();
  const follow = mountFrameComponent('src/features/play/hearttree/HearttreeScene.tsx', ['CameraFollow'], {
    useThree: () => ({ camera, size: { width: 800, height: 600 } })
  });
  follow.render({ position: { x: 3, z: -2 }, reducedMotion: false }); follow.frame();
  assert.deepEqual(camera.position.toArray(), [3, 5.6, 5.8]);
});

test('local explorer faces the accepted movement on the first frame and keeps the flight pitch', () => {
  const explorer = mountFrameComponent('src/features/play/WildsExplorer.tsx', ['WildsExplorer'], {
    useWildsReadability: () => ({ motionScale: 1 }),
    palette: { skin: '#b97856', hair: '#241a17' },
    projectWildsExplorerAnatomy, createWildsExplorerFace, createWildsExplorerTorso,
    useWildsCharacterTexture: () => null, useWildsNaturalTexture: () => null,
    writeWildsExplorerOrientation, writeWildsExplorerWingFlightPose, playerBodyBreathExpansion,
    Leg: 'leg', Arm: 'arm', ExplorerBackpack: 'backpack', ExplorerScubaKit: 'scuba', performance: { now: () => 1000 }
  });
  const props = { style: 'male', worldPosition: { x: 0, z: 0 }, bodyReadiness: 100, aerialStateRef: { current: { mode: 'flight', verticalVelocity: 1 } } };
  const root = new THREE.Group();
  const render = () => { const tree = explorer.render(props); tree.props.ref.current = root; explorer.flushEffects(); };
  render();
  props.worldPosition = { x: 1, z: 0 }; render(); explorer.frame();
  assert.ok(Math.abs(root.rotation.y + Math.PI / 2) < 1e-12, 'turning must not wait for yaw easing');
  assert.equal(root.rotation.x, -1.12, 'flight pose must match the current traversal state');
  assert.equal(root.rotation.order, 'YXZ');
  explorer.unmount();
});

test('arena camera frames the accepted fighter positions without follow lag', () => {
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 60);
  const rig = mountFrameComponent('src/features/games/mortal-arena/MortalArenaScene.tsx', ['ArenaCamera'], {
    useThree: () => ({ camera, size: { width: 600, height: 600 } }), mortalArenaCameraDistance: () => 10
  });
  const state = { sides: [{ activeIndex: 0, fighters: [{ position: { x: 1000, z: 3000 } }] }, { activeIndex: 0, fighters: [{ position: { x: 5000, z: -1000 } }] }] };
  rig.render({ state, impactTick: 0 }); rig.flushEffects(); rig.frame();
  assert.deepEqual(camera.position.toArray(), [3, 7.7, 11]);
});

test('removing arena follow delay preserves the original impact-shake envelope', () => {
  const camera = new THREE.PerspectiveCamera(43);
  camera.position.set(0, 7.7, 10);
  const rig = mountFrameComponent('src/features/games/mortal-arena/MortalArenaScene.tsx', ['ArenaCamera'], {
    useThree: () => ({ camera, size: { width: 600, height: 600 } }), mortalArenaCameraDistance: () => 10
  });
  const fighter = { position: { x: 0, z: 0 } };
  rig.render({ state: { sides: [{ activeIndex: 0, fighters: [fighter] }, { activeIndex: 0, fighters: [fighter] }] }, impactTick: 1 });
  rig.flushEffects();
  // Captured from the original stationary-camera response at c1ad1bc.
  for (const [x, y] of [[.014805667055353014, 7.702080370548864], [.027206457691828348, 7.703822827644941], [.037509423286798266, 7.705270515622091]]) {
    rig.frame();
    assert.ok(Math.abs(camera.position.x - x) < 1e-12);
    assert.ok(Math.abs(camera.position.y - y) < 1e-12);
  }
});

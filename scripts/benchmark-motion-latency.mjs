/** pnpm test first. Deterministic 60 Hz presentation step responses using the
 * actual components and real Three transforms; not hardware/input-to-photon timing. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as THREE from 'three';
import { mountFrameComponent } from '../.test-build/tests/support/frame-component-harness.js';
import { createWildsFlightCameraControlState, writeWildsFlightCameraControlState } from '../.test-build/src/features/play/wilds-flight-camera.js';
import { writeUnderwaterCameraTarget, isUnderwaterCameraSubmerged } from '../.test-build/src/features/play/wilds-underwater-camera.js';

const reference = process.argv[2] ?? 'HEAD';
const baselineCommit = execFileSync('git', ['rev-parse', reference], { encoding: 'utf8' }).trim();
const directory = mkdtempSync(join(tmpdir(), 'wildz-motion-latency-'));
const source = (path, baseline) => {
  if (!baseline) return path;
  const target = join(directory, path.split('/').at(-1));
  writeFileSync(target, execFileSync('git', ['show', `${baselineCommit}:${path}`]));
  return target;
};
function response(component, error, amplitude) {
  let firstFrameError, settledFrames;
  for (let frame = 1; frame <= 300; frame++) {
    component.frame({}, 1 / 60);
    const remaining = error();
    firstFrameError ??= remaining;
    if (settledFrames === undefined && remaining <= amplitude * .05) settledFrames = frame;
  }
  component.unmount();
  return { firstFrameResidualPercent: Math.round(firstFrameError / amplitude * 10000) / 100,
    framesTo95Percent: settledFrames, simulatedMsTo95Percent: Math.round(settledFrames / 60 * 100000) / 100 };
}
function measure(baseline) {
  const worldSource = source('src/features/play/WildsWorldCanvas.tsx', baseline);
  const world = mountFrameComponent(worldSource, ['WorldFrame', 'SmoothWorldFrame']);
  const group = new THREE.Group();
  const mountWorld = player => { const tree = world.render({ player, terrainElevation: 0, children: null }); if (tree.props.ref) tree.props.ref.current = group; world.flushEffects(); };
  mountWorld({ x: 0, z: 0 }); mountWorld({ x: 1, z: 0 });
  const worldMovement = response(world, () => Math.abs(group.position.x), 1);

  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 5, 8);
  const controls = { target: new THREE.Vector3(0, .9, 0), update() {} };
  const rig = mountFrameComponent(worldSource, ['CameraRig'], {
    useThree: () => ({ camera }), OrbitControls: 'orbit', createWildsFlightCameraControlState, writeWildsFlightCameraControlState,
    writeUnderwaterCameraTarget, isUnderwaterCameraSubmerged,
    writeWildsSiteRuntimeCamera: () => ({ floorY: 0, ceilingY: Infinity, flooded: false }),
    wildsSiteRuntimeCameraIsFlooded: () => false, writeWildsInteriorCameraPosition: () => {}
  });
  const tree = rig.render({ terrainElevation: 0, actualCameraSubmergedRef: { current: false },
    verticalTraversalRef: { current: { layer: 'air', offset: 3 } },
    aquaticPresentation: { mode: 'land', terrainElevation: 0, waterSurfaceY: 0, cameraSubmersionAllowed: false },
    onCameraHeadingChange() {}, vistaHeading: null, siteRuntime: {}, siteSpace: { spaceId: 'wildz.space.outer.v1' }, player: { x: 0, z: 0 } });
  tree.props.ref.current = controls; rig.flushEffects();
  const flightCamera = response(rig, () => Math.abs(3.9 - controls.target.y), 3);

  const arena = mountFrameComponent(source('src/features/games/mortal-arena/MortalArenaScene.tsx', baseline), ['ArenaFighter'], { projectCardKaiAppearance: () => ({ palette: {} }), WildsCreatureActor: 'creature' });
  const fighterTree = arena.render({ card: { id: 'card', manifest: { familyId: 'mintcub', formId: 'mintcub-1', variant: { traits: { palette: {} } } } }, fighter: { position: { x: 1000, y: 0, z: 0 }, facing: 1, vitality: 100, maxVitality: 100, recoveryTicks: 0 }, side: 'player' });
  const fighter = new THREE.Group(); fighterTree.props.ref.current = fighter;
  const arenaMovement = response(arena, () => Math.abs(1 - fighter.position.x), 1);

  const hearttreeCamera = new THREE.PerspectiveCamera();
  const hearttree = mountFrameComponent(source('src/features/play/hearttree/HearttreeScene.tsx', baseline), ['CameraFollow'], { useThree: () => ({ camera: hearttreeCamera, size: { width: 800, height: 600 } }) });
  hearttree.render({ position: { x: 1, z: 0 }, reducedMotion: false });
  const hearttreeFollow = response(hearttree, () => Math.abs(1 - hearttreeCamera.position.x), 1);
  return { worldMovement, flightCamera, arenaMovement, hearttreeFollow };
}
try {
  console.log(JSON.stringify({ scenario: 'One accepted position change, deterministic 60 Hz frames; 95% convergence includes the first display frame.', baselineCommit, before: measure(true), after: measure(false) }, null, 2));
} finally { rmSync(directory, { recursive: true, force: true }); }

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { KAI_PULSE_DURATION_MS } from './kai-klok-moment';
import { projectWildsWildAnimalPosition, type WildsWildAnimal } from './wilds-animal-ecology';
import type { WildsNourishmentPlantProjection, WildsWildAnimalProjection, WildsOwnedLivestockProjection } from './WildsNourishmentPanel';

export type WildsNourishmentEnvironmentProps = Readonly<{
  plants?: readonly WildsNourishmentPlantProjection[];
  animals?: readonly WildsWildAnimalProjection[];
  livestock?: readonly WildsOwnedLivestockProjection[];
  /** The same scene origin used by existing terrain/trees, including its ground Y. */
  origin: Readonly<{ x: number; y: number; z: number }>;
  kaiUPulse: number;
  spaceId?: string;
  onGather?: (plant: WildsNourishmentPlantProjection) => void;
  onHunt?: (animal: WildsWildAnimalProjection) => void;
  onCapture?: (animal: WildsWildAnimalProjection) => void;
  onProduce?: (animal: WildsOwnedLivestockProjection) => void;
}>;
const MAX_INSTANCES = 1536;
const MAX_PLANTS = 64;
const MAX_WILD_ANIMALS = 24;
const MAX_LIVESTOCK = 12;
type PickTarget = { kind: 'plant'; plant: WildsNourishmentPlantProjection } | { kind: 'wild'; animal: WildsWildAnimalProjection } | { kind: 'livestock'; animal: WildsOwnedLivestockProjection };

/** A single bounded draw shares all geometry/materials. Food dots follow finite crop counts. */
export function WildsNourishmentEnvironment(props: WildsNourishmentEnvironmentProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const latest = useRef(props);
  const picks = useRef<(PickTarget | null)[]>([]);
  const time = useRef({ observedKai: props.kaiUPulse, elapsedSeconds: 0, drawSeconds: 0 });
  const transform = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 6), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .9 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  const draw = useCallback((kaiUPulse: number) => {
    const target = mesh.current; if (!target) return;
    const current = latest.current, origin = current.origin;
    let count = 0;
    const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone: string, pick: PickTarget | null, heading = 0) => {
      if (count >= MAX_INSTANCES) return;
      transform.position.set(x - origin.x, y - origin.y, z - origin.z);
      transform.scale.set(sx, sy, sz); transform.rotation.set(0, heading, 0); transform.updateMatrix();
      target.setMatrixAt(count, transform.matrix); target.setColorAt(count, color.set(tone)); picks.current[count] = pick; count++;
    };
    const outer = !current.spaceId || current.spaceId === 'wildz.space.outer.v1';
    if (outer) for (const plant of (current.plants ?? []).slice(0, MAX_PLANTS)) {
      const p = plant.position, pick: PickTarget = { kind: 'plant', plant };
      if (plant.kind === 'fruit-tree') {
        for (let item = 0; item < plant.remaining; item++) {
          const angle = item / plant.capacity * Math.PI * 2;
          add(p.x + Math.cos(angle) * .48, p.y + (plant.canopyHeight ?? 2.4), p.z + Math.sin(angle) * .48, .13, .15, .13, '#efaa43', pick);
        }
      } else if (plant.kind === 'berry-bush') {
        add(p.x, p.y + .25, p.z, .4, .32, .4, plant.remaining ? '#42744b' : '#425740', pick);
        add(p.x - .19, p.y + .26, p.z + .08, .28, .25, .31, '#345e40', pick);
        for (let item = 0; item < plant.remaining; item++) {
          const angle = item / plant.capacity * Math.PI * 2;
          add(p.x + Math.cos(angle) * .29, p.y + .48, p.z + Math.sin(angle) * .29, .09, .075, .09, '#bd4c70', pick);
        }
      } else {
        add(p.x, p.y + .01, p.z, .39, .035, .34, '#685a3a', pick);
        for (let item = 0; item < plant.remaining; item++) {
          const offset = (item - .5) * .3;
          add(p.x + offset, p.y + .08, p.z, .1, .12, .1, '#ddab58', pick);
          add(p.x + offset - .055, p.y + .23, p.z, .09, .21, .05, '#69a554', pick);
          add(p.x + offset + .055, p.y + .2, p.z + .02, .07, .17, .09, '#477d40', pick);
        }
      }
    }
    const animalBody = (animal: WildsWildAnimal, position: { x: number; y: number; z: number }, heading: number, pick: PickTarget) => {
      const bird = animal.species === 'ground-bird', goat = animal.species === 'meadow-goat';
      const bodyY = bird ? .36 : goat ? .62 : .3;
      const bodyTone = bird ? '#b99661' : goat ? '#c9c6af' : '#aa957e';
      const part = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone = bodyTone) => {
        add(position.x + x * Math.cos(heading) + z * Math.sin(heading), position.y + y,
          position.z + z * Math.cos(heading) - x * Math.sin(heading), sx, sy, sz, tone, pick, heading);
      };
      part(0, .015, 0, goat ? .48 : .27, .025, goat ? .65 : .35, '#3d4731');
      part(0, bodyY, 0, goat ? .34 : .23, goat ? .32 : .24, goat ? .53 : .31);
      const headZ = goat ? .52 : .25, headY = goat ? .93 : bird ? .63 : .48;
      part(0, headY, headZ, goat ? .19 : .15, goat ? .23 : .16, goat ? .21 : .16);
      part(-.13, headY + .04, headZ + .075, .025, .03, .025, '#231f17');
      part(.13, headY + .04, headZ + .075, .025, .03, .025, '#231f17');
      if (bird) {
        part(0, headY - .025, headZ + .16, .065, .04, .1, '#d29942');
        part(-.23, bodyY + .03, -.04, .07, .18, .24, '#8c7049');
        part(.23, bodyY + .03, -.04, .07, .18, .24, '#8c7049');
        part(-.09, .12, .02, .025, .12, .025, '#bc8742');
        part(.09, .12, .02, .025, .12, .025, '#bc8742');
        part(0, bodyY + .05, -.31, .1, .15, .16, '#816b4e');
      } else if (goat) {
        part(-.13, headY + .23, headZ - .04, .035, .19, .035, '#8a8270');
        part(.13, headY + .23, headZ - .04, .035, .19, .035, '#8a8270');
        part(-.2, headY + .02, headZ, .11, .065, .085);
        part(.2, headY + .02, headZ, .11, .065, .085);
        for (const x of [-.22, .22]) for (const z of [-.32, .32]) part(x, .27, z, .065, .27, .065, '#ada991');
        part(0, bodyY + .12, -.55, .06, .15, .08);
      } else {
        part(-.075, .75, headZ, .05, .22, .07);
        part(.075, .75, headZ, .05, .22, .07);
        part(-.15, .09, .19, .12, .07, .17);
        part(.15, .09, .19, .12, .07, .17);
        part(0, .33, -.3, .1, .1, .1, '#ded4bf');
      }
    };
    if (outer) for (const animal of (current.animals ?? []).filter(a => a.status === 'wild').slice(0, MAX_WILD_ANIMALS)) {
      const motion = projectWildsWildAnimalPosition(animal, kaiUPulse);
      animalBody(animal, motion.position, motion.heading, { kind: 'wild', animal });
    }
    const owned = [...(current.livestock ?? [])].filter(a => a.spaceId === (current.spaceId ?? 'wildz.space.outer.v1')
      && Math.hypot(a.position.x - origin.x, a.position.z - origin.z) <= 72)
      .sort((a, b) => Math.hypot(a.position.x - origin.x, a.position.z - origin.z) - Math.hypot(b.position.x - origin.x, b.position.z - origin.z)).slice(0, MAX_LIVESTOCK);
    owned.forEach((animal, index) => {
      const angle = index * 2.399;
      animalBody(animal, { ...animal.position, x: animal.position.x + Math.cos(angle) * .65, z: animal.position.z + Math.sin(angle) * .65 }, angle, { kind: 'livestock', animal });
    });
    target.count = count; picks.current.length = count;
    target.instanceMatrix.needsUpdate = true; if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [color, transform]);
  useLayoutEffect(() => {
    latest.current = props;
    if (time.current.observedKai !== props.kaiUPulse) time.current = { observedKai: props.kaiUPulse, elapsedSeconds: 0, drawSeconds: 0 };
    draw(props.kaiUPulse);
  }, [props, draw]);
  useFrame((_, delta) => {
    time.current.elapsedSeconds += Math.min(delta, .1); time.current.drawSeconds += delta;
    if (time.current.drawSeconds < .05 || !(latest.current.animals?.length)) return;
    time.current.drawSeconds = 0;
    draw(time.current.observedKai + Math.floor(time.current.elapsedSeconds * 1000 / KAI_PULSE_DURATION_MS * 1_000_000));
  });
  const activate = (event: ThreeEvent<MouseEvent>, capture: boolean) => {
    const picked = event.instanceId === undefined ? null : picks.current[event.instanceId];
    if (!picked) return;
    const current = latest.current;
    if (picked.kind === 'plant' && picked.plant.canGather && current.onGather) { event.stopPropagation(); current.onGather(picked.plant); }
    else if (picked.kind === 'wild' && picked.animal.canInteract) {
      if (capture && picked.animal.capturable && current.onCapture) { event.stopPropagation(); current.onCapture(picked.animal); }
      else if (!capture && current.onHunt) { event.stopPropagation(); current.onHunt(picked.animal); }
    } else if (picked.kind === 'livestock' && picked.animal.canProduce && current.onProduce) { event.stopPropagation(); current.onProduce(picked.animal); }
  };
  return <instancedMesh name="wilds-nourishment-landscape" ref={mesh} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} castShadow receiveShadow
    onClick={event => activate(event, event.nativeEvent.shiftKey)}
    onContextMenu={event => { event.nativeEvent.preventDefault(); activate(event, true); }} />;
}

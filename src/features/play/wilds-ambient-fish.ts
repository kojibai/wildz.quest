import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A shared, +Z-facing silver fish with a tapered body and a vertical forked tail. */
export function createWildsAmbientFishGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const append = (source: THREE.BufferGeometry, tone: string, scales = false) => {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    const positions = geometry.getAttribute('position'), count = positions.count;
    const colors = new Float32Array(count * 3), base = new THREE.Color(tone);
    const back = new THREE.Color('#345967'), belly = new THREE.Color('#e0e4d6');
    const color = new THREE.Color();
    for (let index = 0; index < count; index++) {
      color.copy(scales ? belly : base);
      if (scales) color.lerp(back, THREE.MathUtils.smoothstep(positions.getY(index), -.23, .31));
      color.toArray(colors, index * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('fishScales', new THREE.BufferAttribute(new Float32Array(count).fill(scales ? 1 : 0), 1));
    parts.push(geometry);
  };
  const body = new THREE.SphereGeometry(1, 16, 10);
  const positions = body.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const z = positions.getZ(index);
    const taper = .48 + .52 * THREE.MathUtils.smoothstep(z, -.9, .15);
    positions.setXYZ(index, positions.getX(index) * .255 * taper, positions.getY(index) * .34 * taper, z * .72);
  }
  body.computeVertexNormals();
  append(body, '#92afb6', true);
  append(new THREE.SphereGeometry(1, 8, 4).scale(.085, .1, .19).translate(0, 0, -.65), '#7d9ba3');

  const fin = (points: readonly (readonly [number, number, number])[], tone: string) => {
    const geometry = new THREE.BufferGeometry();
    // Convex fans keep every fin in the same instanced mesh/material.
    const vertices: number[] = [], uv: number[] = [];
    for (let index = 1; index < points.length - 1; index++) {
      for (const point of [points[0]!, points[index]!, points[index + 1]!]) {
        vertices.push(...point); uv.push(point[2], point[1]);
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    append(geometry, tone);
  };
  // Two lobes produce a true fork rather than a wing or a triangular placeholder.
  fin([[0, 0, -.7], [0, .43, -1.13], [0, .055, -.98]], '#628a98');
  fin([[0, 0, -.7], [0, -.43, -1.13], [0, -.055, -.98]], '#628a98');
  fin([[0, .23, -.35], [0, .52, -.25], [0, .39, .14], [0, .27, .27]], '#608592');
  fin([[0, -.2, -.38], [0, -.38, -.28], [0, -.27, -.03]], '#9ab2b4');
  for (const side of [-1, 1]) {
    fin([[side * .18, -.02, .26], [side * .44, -.18, -.12], [side * .22, -.15, -.22]], '#779ca7');
    fin([[side * .09, -.22, .04], [side * .23, -.37, -.23], [side * .07, -.27, -.28]], '#b6c6bf');
    append(new THREE.SphereGeometry(1, 8, 5).scale(.041, .045, .047).translate(side * .17, .105, .49), '#c7b87b');
    append(new THREE.SphereGeometry(1, 8, 5).scale(.018, .027, .031).translate(side * .2, .108, .497), '#111f24');
    // Gill cover and fine caudal rays remain visible without extra draw calls.
    fin([[side * .219, .18, .27], [side * .23, .02, .25], [side * .19, -.16, .27]], '#567780');
    for (let ray = 1; ray <= 4; ray++) {
      const y = side * ray * .081;
      fin([[.002, 0, -.73], [.002, y, -1.08], [.002, y + side * .006, -1.07]], '#a0b8ba');
    }
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

/** Lateral body waves and scale highlights run on the GPU, one draw per school batch. */
export function createWildsAmbientFishMaterial(time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .44, metalness: .24, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.wildsFishTime = time;
    shader.vertexShader = `attribute vec2 fishSwim;
attribute float fishScales;
uniform float wildsFishTime;
varying vec3 wildsFishSurface;
varying float wildsFishScales;
float wildsFishWave(float z) { return wildsFishTime * fishSwim.y + fishSwim.x - z * 4.; }
${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float fishTail = max(0., .35 - position.z);
float fishPhase = wildsFishWave(position.z);
float fishSlope = position.z < .35 ? -.22 * fishTail * sin(fishPhase) - .44 * fishTail * fishTail * cos(fishPhase) : 0.;
objectNormal.z -= fishSlope * objectNormal.x;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
wildsFishSurface = position;
wildsFishScales = fishScales;
float tailAmount = max(0., .35 - position.z);
transformed.x += .11 * tailAmount * tailAmount * sin(wildsFishWave(position.z));`);
    shader.fragmentShader = `varying vec3 wildsFishSurface;
varying float wildsFishScales;
${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float scaleRow = floor(wildsFishSurface.y * 35.);
vec2 scaleCell = fract(vec2(wildsFishSurface.z * 24. + mod(scaleRow, 2.) * .5, wildsFishSurface.y * 35.));
float scaleEdge = 1. - smoothstep(.005, .035, abs(length((scaleCell - .5) * vec2(1., .8)) - .4));
diffuseColor.rgb *= 1. - wildsFishScales * scaleEdge * .13;`);
  };
  material.customProgramCacheKey = () => 'wilds-ambient-fish-v1';
  return material;
}

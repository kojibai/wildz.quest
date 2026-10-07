import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type WildsAmbientBirdFlightFrame = { x: number; y: number; z: number; directionX: number; directionZ: number; pitch: number; bank: number };

/** Closed Catmull-Rom flight keeps position and heading continuous at every route seam. */
export function writeWildsAmbientBirdPath(out: WildsAmbientBirdFlightFrame, path: readonly Readonly<{x:number;y:number;z:number}>[], progress: number) {
  const scaled=((progress%1)+1)%1*path.length,index=Math.floor(scaled),t=scaled-index;
  const p0=path[(index+path.length-1)%path.length]!,p1=path[index]!,p2=path[(index+1)%path.length]!,p3=path[(index+2)%path.length]!;
  const ax=-p0.x+p2.x,bx=2*p0.x-5*p1.x+4*p2.x-p3.x,cx=-p0.x+3*p1.x-3*p2.x+p3.x;
  const ay=-p0.y+p2.y,by=2*p0.y-5*p1.y+4*p2.y-p3.y,cy=-p0.y+3*p1.y-3*p2.y+p3.y;
  const az=-p0.z+p2.z,bz=2*p0.z-5*p1.z+4*p2.z-p3.z,cz=-p0.z+3*p1.z-3*p2.z+p3.z;
  out.x=.5*(2*p1.x+ax*t+bx*t*t+cx*t*t*t);
  out.y=.5*(2*p1.y+ay*t+by*t*t+cy*t*t*t);
  out.z=.5*(2*p1.z+az*t+bz*t*t+cz*t*t*t);
  out.directionX=.5*(ax+2*bx*t+3*cx*t*t);
  out.directionZ=.5*(az+2*bz*t+3*cz*t*t);
  const dy=.5*(ay+2*by*t+3*cy*t*t);
  out.pitch=-Math.atan2(dy,Math.hypot(out.directionX,out.directionZ));
  out.bank=THREE.MathUtils.clamp(Math.atan2(out.directionX*(bz+3*cz*t)-out.directionZ*(bx+3*cx*t),out.directionX*out.directionX+out.directionZ*out.directionZ)*.6,-.4,.4);
  return out;
}

/** One shared bird mesh: rounded anatomy, a pointed beak, fan tail and feathered wings. */
export function createWildsAmbientBirdGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const append = (source: THREE.BufferGeometry, tone: string, wingSide = 0) => {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    const count = geometry.getAttribute('position').count, color = new THREE.Color(tone);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) color.toArray(colors, index * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('birdWingSide', new THREE.BufferAttribute(new Float32Array(count).fill(wingSide), 1));
    parts.push(geometry);
  };
  const rounded = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone: string, segments = 8, rings = 5) => {
    append(new THREE.SphereGeometry(1, segments, rings).scale(sx, sy, sz).translate(x, y, z), tone);
  };
  rounded(0, 0, -.08, .22, .24, .59, '#a9b4b9');
  rounded(0, -.105, .05, .17, .145, .4, '#d9dcd3');
  rounded(0, .11, .43, .135, .18, .18, '#bbc6c8');
  rounded(0, .18, .61, .16, .15, .2, '#c4cdd0');
  for (const side of [-1, 1]) rounded(side * .143, .215, .69, .025, .026, .024, '#1c272a', 6, 3);
  append(new THREE.ConeGeometry(.065, .23, 6).rotateX(Math.PI / 2).translate(0, .16, .865), '#6a6454');

  const tail = new THREE.Shape();
  tail.moveTo(-.11, -.43); tail.lineTo(-.26, -1.08); tail.lineTo(-.13, -1.03);
  tail.lineTo(0, -1.13); tail.lineTo(.13, -1.03); tail.lineTo(.26, -1.08);
  tail.lineTo(.11, -.43); tail.closePath();
  append(new THREE.ShapeGeometry(tail).rotateX(Math.PI / 2).translate(0, .015, 0), '#697b86');

  for (const side of [-1, 1]) {
    const wing = new THREE.Shape();
    wing.moveTo(.13, .2);
    wing.quadraticCurveTo(.42, .32, .74, .17);
    wing.quadraticCurveTo(1.04, .08, 1.35, -.48);
    // Separate primaries read as feathers at the tips, rather than a triangle.
    wing.lineTo(1.12, -.38); wing.lineTo(1.17, -.55);
    wing.lineTo(.96, -.4); wing.lineTo(.96, -.57);
    wing.lineTo(.77, -.41); wing.lineTo(.75, -.55);
    wing.quadraticCurveTo(.43, -.38, .13, -.25); wing.closePath();
    const geometry = new THREE.ShapeGeometry(wing, 3).rotateX(Math.PI / 2).scale(side, 1, 1).translate(0, .04, 0);
    append(geometry, '#8799a3', side);
  }
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

/** Wing articulation stays on the GPU: no extra meshes, frame allocations or buffer uploads. */
export function createWildsAmbientBirdMaterial(time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.wildsBirdTime = time;
    shader.vertexShader = `attribute float birdWingSide;
attribute vec2 birdFlight;
uniform float wildsBirdTime;
float wildsBirdFlap() { return .12 + sin(wildsBirdTime * birdFlight.y + birdFlight.x) * .68; }
${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
if (abs(birdWingSide) > .5) {
  float angle = wildsBirdFlap() * birdWingSide;
  float nx = objectNormal.x;
  objectNormal.x = nx * cos(angle) - objectNormal.y * sin(angle);
  objectNormal.y = nx * sin(angle) + objectNormal.y * cos(angle);
}`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
if (abs(birdWingSide) > .5) {
  float flap = wildsBirdFlap();
  float span = abs(transformed.x) - .13;
  transformed.x = birdWingSide * (.13 + span * cos(flap));
  transformed.y += span * sin(flap);
  transformed.z -= abs(span) * (1. - cos(flap)) * .12;
}`);
  };
  material.customProgramCacheKey = () => 'wilds-ambient-bird-v1';
  return material;
}

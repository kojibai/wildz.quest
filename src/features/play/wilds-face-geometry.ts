import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { HeartboundHighlightShape, HeartboundPupilShape } from "./living-card-types";

type Point = readonly [number, number, number];
type ColorAt = (x: number, y: number, z: number) => THREE.Color;
type CloseAt = (x: number, y: number, z: number) => Point;

/** Skin, ocular surfaces and eyelids merge into one draw. Closed poses stay on the GPU. */
export class WildsFaceGeometryBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(geometry: THREE.BufferGeometry, color: string | ColorAt, position: Point = [0, 0, 0], scale: Point = [1, 1, 1], close?: CloseAt, ocular = false) {
    geometry.scale(...scale);
    geometry.translate(...position);
    const positions = geometry.getAttribute("position");
    if (!geometry.index) geometry.setIndex(Array.from({ length: positions.count }, (_, index) => index));
    const colors = new Float32Array(positions.count * 3);
    const closed = new Float32Array(positions.count * 3);
    const tint = typeof color === "string" ? new THREE.Color(color) : null;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const c = tint ?? (color as ColorAt)(x, y, z);
      colors.set([c.r, c.g, c.b], i * 3);
      closed.set(close ? close(x, y, z) : [x, y, z], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("faceClosed", new THREE.BufferAttribute(closed, 3));
    geometry.setAttribute("faceOcular", new THREE.BufferAttribute(new Float32Array(positions.count).fill(ocular ? 1 : 0), 1));
    this.parts.push(geometry);
  }

  finish() {
    const geometry = mergeGeometries(this.parts, false);
    this.parts.forEach(part => part.dispose());
    this.parts = [];
    if (!geometry) throw new Error("wildz_face_geometry_merge_failed");
    geometry.computeVertexNormals();
    const closed = geometry.clone();
    closed.setAttribute("position", geometry.getAttribute("faceClosed").clone());
    closed.computeVertexNormals();
    geometry.setAttribute("faceClosedNormal", closed.getAttribute("normal").clone());
    closed.dispose();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function radialPatch(radii: readonly number[], segments: number, point: (r: number, angle: number) => Point, front = 1) {
  const positions: number[] = [], indices: number[] = [];
  for (const r of radii) for (let i = 0; i <= segments; i++) positions.push(...point(r, i / segments * Math.PI * 2));
  for (let ring = 0; ring < radii.length - 1; ring++) for (let i = 0; i < segments; i++) {
    const a = ring * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (front < 0) for (let i = 0; i < indices.length; i += 3) {
    const index = geometry.index!;
    const a = index.getX(i);
    index.setX(i, index.getX(i + 1));
    index.setX(i + 1, a);
  }
  // All face parts carry the same attributes so they can be merged.
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function addWildsFaceEye(builder: WildsFaceGeometryBuilder, options: {
  center: Point; width: number; height: number; depth: number; tilt: number;
  skin: string; iris: string; seed: number; segments: number;
  pupil?: HeartboundPupilShape; highlight?: HeartboundHighlightShape; lidFold?: number;
}) {
  const { center: [cx, cy, cz], width: w, height: h, depth, tilt, skin, iris, seed, segments } = options;
  const toWorld = (x: number, y: number, z: number): Point => [cx + x, cy + y + x * tilt, cz + z];
  const seam = (x: number) => cy - h * .12 * (1 - Math.min(1, ((x - cx) / w) ** 2)) + (x - cx) * tilt;
  const close: CloseAt = (x) => [x, seam(x), cz + depth * .08];
  const skinTint = new THREE.Color(skin), rimTint = skinTint.clone().multiplyScalar(.66);
  const eye = radialPatch([0, .58, 1], segments, (r, angle) => {
    const x = Math.cos(angle) * w * r, y = Math.sin(angle) * h * r;
    return toWorld(x, y, depth * (1 - r * r));
  }, depth);
  builder.add(eye, (x, _y) => new THREE.Color("#eee9dd").lerp(new THREE.Color("#b98079"), Math.max(0, Math.abs((x - cx) / w) - .64) * .48), undefined, undefined, close, true);

  const irisRadius = Math.min(w * .48, h * .92), irisTint = new THREE.Color(iris);
  const irisGeometry = radialPatch([0, .38, .45, .7, .9, 1], segments, (r, angle) => {
    const pupilShape = options.pupil;
    const shaped = pupilShape === "star" ? 1 + Math.cos(angle * 5) * .2 : pupilShape === "crescent" ? 1 + Math.cos(angle) * .28 : 1;
    const shape = r <= .45 ? shaped : 1;
    const sx = pupilShape === "slit" && r <= .45 ? .3 : pupilShape === "oval" && r <= .45 ? .7 : 1;
    return toWorld(Math.cos(angle) * irisRadius * r * shape * sx, Math.sin(angle) * irisRadius * r * shape, depth + depth * .05 * (1 - r * r));
  }, depth);
  builder.add(irisGeometry, (x, y) => {
    const radius = Math.hypot(x - cx, y - cy - (x - cx) * tilt) / irisRadius;
    if (radius < .42) return new THREE.Color("#111716");
    if (radius > .94) return irisTint.clone().multiplyScalar(.38);
    const angle = Math.atan2(y - cy, x - cx);
    const fibers = .78 + Math.sin(angle * 19 + seed * 9) * .12 + Math.cos(angle * 31 + seed * 5) * .08;
    return irisTint.clone().multiplyScalar(fibers).lerp(new THREE.Color("#c9a45d"), Math.max(0, .65 - radius) * .4);
  }, undefined, undefined, close, true);

  // A fixed outer socket and moving inner lid cover the globe as the aperture closes.
  const lid = radialPatch([1, 1.17, 1.32], segments, (r, angle) => {
    const x = Math.cos(angle) * w * r, y = Math.sin(angle) * h * r;
    return toWorld(x, y, -Math.abs(depth) * .06 * (r - 1));
  }, depth);
  builder.add(lid, (x, y) => {
    const r = Math.hypot((x - cx) / w, (y - cy - (x - cx) * tilt) / h);
    return skinTint.clone().lerp(rimTint, Math.max(0, 1 - (r - 1) / .17) * .45);
  }, undefined, undefined, (x, y, z) => {
    const r = Math.hypot((x - cx) / w, (y - cy - (x - cx) * tilt) / h);
    const weight = Math.max(0, 1 - (r - 1) / .32);
    return [x, y + (seam(x) - y) * weight, z + depth * .16 * weight];
  });
  if (options.lidFold) {
    const fold = new THREE.CatmullRomCurve3(Array.from({ length: 7 }, (_, i) => {
      const a = i / 6 * Math.PI;
      return new THREE.Vector3(...toWorld(Math.cos(a) * w * 1.15, Math.sin(a) * h * 1.22 + options.lidFold!, -Math.abs(depth) * .08));
    }));
    builder.add(new THREE.TubeGeometry(fold, 6, options.lidFold * .2, 3, false), rimTint.getStyle());
  }
  const highlight = toWorld(-irisRadius * .29, irisRadius * .33, depth * 1.07);
  builder.add(options.highlight === "diamond" ? new THREE.OctahedronGeometry(irisRadius * .14) : new THREE.SphereGeometry(irisRadius * .12, 5, 3),
    "#ffffff", highlight, options.highlight === "comet" ? [1.65, .7, .3] : [1, 1, .3], close, true);
  if (options.highlight === "double") builder.add(new THREE.SphereGeometry(irisRadius * .07, 4, 3), "#ffffff",
    toWorld(irisRadius * .2, -irisRadius * .16, depth * 1.07), [1, 1, .3], close, true);
}

/** Same program for every face; each actor updates only its blink uniform. */
export function createWildsFaceMaterial(map: THREE.Texture, roughness = .68) {
  const blink = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness });
  material.onBeforeCompile = shader => {
    shader.uniforms.wildsFaceBlink = blink;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      attribute vec3 faceClosed;
      attribute vec3 faceClosedNormal;
      attribute float faceOcular;
      uniform float wildsFaceBlink;
      varying float vFaceOcular;`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        objectNormal = normalize(mix(objectNormal, faceClosedNormal, wildsFaceBlink));`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed = mix(transformed, faceClosed, wildsFaceBlink);
        vFaceOcular = faceOcular;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vFaceOcular;")
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        diffuseColor *= mix(sampledDiffuseColor, vec4(1.0), vFaceOcular);
        #endif`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.23, vFaceOcular);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - vFaceOcular;");
  };
  material.customProgramCacheKey = () => "wildz.face-lids.v1";
  return { material, blink };
}

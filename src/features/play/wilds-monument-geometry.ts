import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WildsMonumentDescriptor, WildsMonumentPart, WildsWaterfallChute } from "./wilds-discovery-monuments";
import type { WildsQualityTier } from "./wilds-quality-profile";

export type WildsMonumentLightState = Readonly<{ id: string; lights: readonly number[]; aligned: boolean }>;
export type WildsDiscoveryBatch = Readonly<{ material: "stone" | "bronze" | "light" | "water"; geometry: THREE.BufferGeometry }>;
const LIGHT_COLORS = ["#edbc62", "#77d9dd", "#b4a0ef"] as const;

function tintGeometry(geometry: THREE.BufferGeometry, tint: string, stone = false) {
  const position = geometry.getAttribute("position"), color = new THREE.Color(tint);
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    const shade = stone ? .8 + Math.sin(position.getY(index) * 8.7 + position.getX(index) * .57) * .06 : 1;
    colors[index * 3] = color.r * shade;
    colors[index * 3 + 1] = color.g * shade;
    colors[index * 3 + 2] = color.b * shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function partGeometry(part: WildsMonumentPart, tier: WildsQualityTier, tint: string) {
  const segments = tier === "low" ? 12 : tier === "medium" ? 20 : 24;
  const indexed = part.shape === "ring" ? new THREE.TorusGeometry(.5, .024, 3, segments)
    : part.shape === "prism" ? new THREE.OctahedronGeometry(.5, 0)
      : part.shape === "inlay" ? new THREE.RingGeometry(.36, .5, segments, 1)
        : new THREE.BoxGeometry(1, 1, 1);
  const geometry = indexed.index ? indexed.toNonIndexed() : indexed.clone();
  indexed.dispose();
  if (part.shape === "inlay") {
    geometry.rotateX(-Math.PI / 2);
    geometry.scale(part.size.x, 1, part.size.z);
  } else geometry.scale(part.size.x, part.size.y, part.size.z);
  geometry.rotateX(part.rotation.x); geometry.rotateY(part.rotation.y); geometry.rotateZ(part.rotation.z);
  geometry.translate(part.position.x, part.position.y, part.position.z);
  tintGeometry(geometry, tint, part.material === "stone");
  return geometry;
}

function mergeRole(material: WildsDiscoveryBatch["material"], pieces: THREE.BufferGeometry[]): WildsDiscoveryBatch {
  const geometry = mergeGeometries(pieces, false)!;
  for (const piece of pieces) piece.dispose();
  geometry.computeBoundingSphere();
  return Object.freeze({ material, geometry });
}

/** Static parts merge by material role. Light state changes rebuild only this small local kit. */
export function createWildsMonumentBatches(monument: WildsMonumentDescriptor, tier: WildsQualityTier, lightState?: WildsMonumentLightState | null): readonly WildsDiscoveryBatch[] {
  const roles = new Map<WildsMonumentPart["material"], THREE.BufferGeometry[]>();
  let prism = 0;
  for (const part of monument.parts) {
    const lightIndex = part.shape === "prism" && monument.type === "prism" ? prism++ : -1;
    const tint = lightIndex >= 0 ? LIGHT_COLORS[(lightState?.id === monument.id ? lightState.lights[lightIndex] ?? 0 : 0) % 3]! : part.tint;
    const pieces = roles.get(part.material) ?? [];
    pieces.push(partGeometry(part, tier, tint)); roles.set(part.material, pieces);
  }
  return Object.freeze([...roles].map(([role, pieces]) => mergeRole(role, pieces)));
}

function waterGeometry(chute: WildsWaterfallChute, origin: Readonly<{ x: number; y: number; z: number }>, tier: WildsQualityTier) {
  const positions: number[] = [], uv: number[] = [], kind: number[] = [], colors: number[] = [];
  const columns = tier === "low" ? 1 : tier === "medium" ? 2 : 3;
  const waterTint = new THREE.Color(chute.seed % 2 ? "#a0c8bd" : "#99c4ca");
  function vertex(x: number, y: number, z: number, u: number, v: number, mode: number) {
    positions.push(x - origin.x, y - origin.y, z - origin.z); uv.push(u, v); kind.push(mode);
    colors.push(waterTint.r, waterTint.g, waterTint.b);
  }
  for (let segment = 1; segment < chute.flowPath.length; segment++) {
    const start = chute.flowPath[segment - 1]!, end = chute.flowPath[segment]!;
    for (let column = 0; column < columns; column++) {
      const left = column / columns, right = (column + 1) / columns;
      const widthStart = chute.width * (segment === 1 ? .8 : 1), widthEnd = chute.width * (segment === chute.flowPath.length - 1 ? 1.2 : 1);
      const top = (u: number) => vertex(start.x + (u - .5) * widthStart, start.y, start.z, u, chute.source.y - start.y, 0);
      const bottom = (u: number) => vertex(end.x + (u - .5) * widthEnd, end.y, end.z, u, chute.source.y - end.y, 0);
      top(left); bottom(left); top(right); top(right); bottom(left); bottom(right);
    }
  }
  // Two triangles per froth patch; shader rings replace particle simulation and ring meshes.
  const foam = [{ point: { ...chute.pool, y: chute.pool.y + 1.018 }, radius: 1.85 }];
  if (tier !== "low") foam.push({ point: { ...chute.flowPath[1]!, y: chute.flowPath[1]!.y + .025 }, radius: .62 });
  for (const patch of foam) {
    const corners = [[-1, -1], [-1, 1], [1, -1], [1, -1], [-1, 1], [1, 1]] as const;
    for (const [x, z] of corners) vertex(patch.point.x + x * patch.radius, patch.point.y, patch.point.z + z * patch.radius, x, z, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("flowKind", new THREE.Float32BufferAttribute(kind, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function createWildsWaterfallBatches(chute: WildsWaterfallChute, origin: Readonly<{ x: number; y: number; z: number }>, tier: WildsQualityTier): readonly WildsDiscoveryBatch[] {
  const rocks = chute.parts.map(part => partGeometry(part, tier, part.tint));
  return Object.freeze([mergeRole("stone", rocks), Object.freeze({ material: "water" as const, geometry: waterGeometry(chute, origin, tier) })]);
}

export function createWildsFlowMaterial(time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, transparent: true, opacity: .74, roughness: .3, metalness: .04, side: THREE.DoubleSide, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.uWildsFlowTime = time;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float flowKind;\nvarying vec2 vWildsFlowUv;\nvarying float vWildsFlowKind;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWildsFlowUv = uv;\nvWildsFlowKind = flowKind;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uWildsFlowTime;\nvarying vec2 vWildsFlowUv;\nvarying float vWildsFlowKind;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (vWildsFlowKind < .5) {
          float strands = sin(vWildsFlowUv.x * 83.0 + sin(vWildsFlowUv.y * 2.0) * 1.2);
          float froth = smoothstep(.5, .96, sin(vWildsFlowUv.y * 12.0 - uWildsFlowTime * 6.0 + sin(vWildsFlowUv.x * 32.0)));
          float edge = smoothstep(0.0, .065, vWildsFlowUv.x) * smoothstep(0.0, .065, 1.0 - vWildsFlowUv.x);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.9, .96, .91), froth * .55 + strands * .08);
          diffuseColor.a *= edge * (.64 + froth * .3 + strands * .08);
        } else {
          float radius = length(vWildsFlowUv);
          float ripple = smoothstep(.78, .98, sin(radius * 27.0 - uWildsFlowTime * 3.0));
          float foam = (1.0 - smoothstep(.12, .52, radius)) * .6;
          diffuseColor.rgb = vec3(.86, .95, .9);
          diffuseColor.a *= (ripple * .42 + foam) * (1.0 - smoothstep(.68, 1.0, radius));
        }
      `);
  };
  material.customProgramCacheKey = () => "wilds-sheet-flow-v1";
  return material;
}

/** Sediment bands are shaded on existing faces, adding no geometry or scene lights. */
export function createWildsMonumentStoneMaterial(texture: THREE.Texture | null) {
  const material = new THREE.MeshStandardMaterial({ map: texture, color: "#ffffff", vertexColors: true, roughness: .98 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWildsRockPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWildsRockPosition = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWildsRockPosition;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float strata = sin(vWildsRockPosition.y * 10.0 + sin(vWildsRockPosition.x * .7) * .9);
        float seam = smoothstep(.88, 1.0, strata);
        diffuseColor.rgb *= 1.0 - seam * .16;
      `);
  };
  material.customProgramCacheKey = () => "wilds-sediment-v1";
  return material;
}

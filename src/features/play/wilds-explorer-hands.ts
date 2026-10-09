import * as THREE from "three";
import type { WildsExplorerAnatomy } from "./wilds-explorer-anatomy";

type Point = readonly [number, number, number];

/** Palm, five relaxed digits and nails remain one indexed surface per hand.
 * Built once per identity/LOD; the existing arm pose moves the entire hand. */
export function createWildsExplorerHand(anatomy: WildsExplorerAnatomy, skin: string, side: -1 | 1, remote = false) {
  const unit = (offset: number) => Number.parseInt(anatomy.fingerprint.slice(offset, offset + 4), 16) / 65535;
  const width = .96 + unit(0) * .12, length = .95 + unit(8) * .1, curl = .85 + unit(16) * .3;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const skinColor = new THREE.Color(skin), nailColor = skinColor.clone().lerp(new THREE.Color("#e8cfc3"), .55);
  const jointColor = skinColor.clone().lerp(new THREE.Color("#925748"), .13);
  const digits: { name: string; base: Point; tip: Point }[] = [];
  function vertex(point: THREE.Vector3, tint: THREE.Color) {
    const index = positions.length / 3;
    positions.push(point.x * side, point.y, point.z);
    colors.push(tint.r, tint.g, tint.b);
    return index;
  }
  function triangle(a: number, b: number, c: number) {
    indices.push(a, side === 1 ? b : c, side === 1 ? c : b);
  }
  function tube(points: Point[], radii: readonly number[], segments: number, depthRatio = 1) {
    const first = positions.length / 3;
    for (let ring = 0; ring < points.length; ring++) {
      const point = new THREE.Vector3(...points[ring]);
      const tangent = new THREE.Vector3(...points[Math.min(points.length - 1, ring + 1)])
        .sub(new THREE.Vector3(...points[Math.max(0, ring - 1)])).normalize();
      const u = tangent.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
      const v = tangent.clone().cross(u).normalize();
      for (let segment = 0; segment < segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        vertex(point.clone().addScaledVector(u, Math.cos(angle) * radii[ring])
          .addScaledVector(v, Math.sin(angle) * radii[ring] * depthRatio), ring === 2 ? jointColor : skinColor);
      }
    }
    for (let ring = 0; ring < points.length - 1; ring++) for (let segment = 0; segment < segments; segment++) {
      const a = first + ring * segments + segment, next = first + ring * segments + (segment + 1) % segments;
      triangle(a, next, a + segments);
      triangle(next, next + segments, a + segments);
    }
    const start = vertex(new THREE.Vector3(...points[0]), skinColor);
    const end = vertex(new THREE.Vector3(...points[points.length - 1]), skinColor);
    const lastRing = first + (points.length - 1) * segments;
    for (let segment = 0; segment < segments; segment++) {
      triangle(start, first + (segment + 1) % segments, first + segment);
      triangle(end, lastRing + segment, lastRing + (segment + 1) % segments);
    }
  }
  function nail(points: Point[], nearRadius: number, tipRadius: number, depthRatio: number) {
    const near = new THREE.Vector3(...points[points.length - 2]);
    const tip = new THREE.Vector3(...points[points.length - 1]);
    const nearTangent = tip.clone().sub(new THREE.Vector3(...points[points.length - 3])).normalize();
    const tipTangent = tip.clone().sub(near).normalize();
    const first = positions.length / 3;
    // Dorsal nail plates follow the distal segment and stay inside its outline.
    for (const t of [0, .72]) for (const x of [-.44, 0, .44]) {
      const radius = THREE.MathUtils.lerp(nearRadius, tipRadius, t);
      const tangent = nearTangent.clone().lerp(tipTangent, t).normalize();
      const u = tangent.clone().cross(new THREE.Vector3(0,0,1)).normalize();
      const dorsal = tangent.clone().cross(u).normalize();
      const surface = remote ? 1 - Math.abs(x) : Math.sqrt(3) / 2;
      vertex(near.clone().lerp(tip,t).addScaledVector(u, -radius * x)
        .addScaledVector(dorsal, radius * depthRatio * surface + .0002), nailColor);
    }
    triangle(first, first + 1, first + 3); triangle(first + 1, first + 4, first + 3);
    triangle(first + 1, first + 2, first + 4); triangle(first + 2, first + 5, first + 4);
  }
  const palm: Point[] = [[0,.032,0], [0,.008,0], [0,-.021,0], [0,-.044,.002], [0,-.062,.005], [0,-.074,.008]];
  const palmRadii = [.031, .035, .052, .055, .048, .031].map(radius => radius * width);
  const palmPoints = remote ? palm.filter((_, index) => index !== 1) : palm;
  const selectedPalmRadii = remote ? palmRadii.filter((_, index) => index !== 1) : palmRadii;
  tube(palmPoints, selectedPalmRadii, remote ? 6 : 8, .46);
  const fingers = [
    { name: "index", x: -.034, y: -.054, length: .092, radius: .011 },
    { name: "middle", x: -.011, y: -.062, length: .102, radius: .0115 },
    { name: "ring", x: .014, y: -.061, length: .094, radius: .0105 },
    { name: "little", x: .037, y: -.051, length: .073, radius: .009 }
  ];
  for (const [index, finger] of fingers.entries()) {
    const fingerLength = finger.length * length * (.98 + unit(24 + index * 4) * .04);
    const points: Point[] = [0, .4, .65, .86, 1, 1.045].map(t => [
      (finger.x + (index - 1.5) * .002 * t) * width,
      finger.y - fingerLength * t,
      .005 + Math.pow(t, 1.7) * .037 * curl
    ]);
    const radii = [1, 1.02, .9, .74, .54, .18].map(radius => radius * finger.radius * width);
    const selected = remote ? points.filter((_, i) => i !== 1) : points;
    tube(selected, remote ? radii.filter((_, i) => i !== 1) : radii, remote ? 4 : 6, .88);
    nail(points.slice(0,-1), radii[3], radii[4], .88);
    digits.push({ name: finger.name, base: [points[0][0] * side, points[0][1], points[0][2]],
      tip: [points[5][0] * side, points[5][1], points[5][2]] });
  }
  const thumb: Point[] = [[-.029,-.016,.005],[-.055,-.043,.013],[-.063,-.061,.022],[-.062,-.077,.032],[-.055,-.085,.039],[-.053,-.089,.041]]
    .map(([x,y,z]) => [x * width, y * length, z * curl] as Point);
  const thumbRadii = [.015,.013,.011,.008,.0045,.0013];
  tube(remote ? thumb.filter((_, i) => i !== 1) : thumb,
    remote ? thumbRadii.filter((_, i) => i !== 1) : thumbRadii, remote ? 4 : 6, .86);
  nail(thumb.slice(0,-1), thumbRadii[3], thumbRadii[4], .86);
  digits.push({ name: "thumb", base: [thumb[0][0] * side, thumb[0][1], thumb[0][2]],
    tip: [thumb[5][0] * side, thumb[5][1], thumb[5][2]] });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  geometry.userData.digits = digits;
  return geometry;
}

import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";

export const WILDS_NAMED_REGIONS = [
  { id: "verdant-heartlands", name: "Verdant Heartlands", position: { x: 0, z: 0 } },
  { id: "echo-highlands", name: "Echo Highlands", position: { x: 96, z: -72 } },
  { id: "prism-coast", name: "Prism Coast", position: { x: -128, z: 94 } },
  { id: "moonwater-reach", name: "Moonwater Reach", position: { x: -24, z: -158 } },
  { id: "amberweald", name: "Amberweald", position: { x: 126, z: 68 } }
] as const;

export const WILDS_MAJOR_ROUTES = [
  {
    id: "golden-spine",
    name: "Golden Spine",
    points: [{ x: -176, z: -72 }, { x: -92, z: -38 }, { x: 0, z: 0 }, { x: 88, z: 42 }, { x: 176, z: 76 }]
  },
  {
    id: "wayfinder-run",
    name: "Wayfinder Run",
    points: [{ x: -118, z: 164 }, { x: -54, z: 74 }, { x: -8, z: 0 }, { x: 52, z: -88 }, { x: 116, z: -166 }]
  }
] as const;

export const WILDS_AUTHORED_OVERLOOKS = [
  {
    id: "prism-watch",
    name: "Prism Watch",
    position: { x: -118, z: 164 },
    approach: { x: -116.26, z: 161.56 },
    viewHeading: 2.52,
    revealLandmarkIds: ["prism-arcade", "wayfinder-hollow"]
  },
  {
    id: "echo-crown",
    name: "Echo Crown",
    position: { x: 80, z: -122 },
    approach: { x: 78.1, z: -119.7 },
    viewHeading: -0.58,
    revealLandmarkIds: ["arena-of-echoes", "hearttree-sanctum"]
  },
  {
    id: "northreach-aerie",
    name: "Northreach Aerie",
    position: { x: 116, z: -166 },
    approach: { x: 114.1, z: -163.7 },
    viewHeading: -2.28,
    revealLandmarkIds: ["hearttree-sanctum", "prism-arcade", "wayfinder-hollow"]
  }
] as const;

export function describeWildsPoint(position: { x: number; z: number }) {
  const nearestLandmark = WILDS_FLAGSHIP_LANDMARKS
    .map((landmark) => ({ landmark, distance: Math.hypot(landmark.position.x - position.x, landmark.position.z - position.z) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (nearestLandmark && nearestLandmark.distance <= 74) return `${nearestLandmark.landmark.name} reaches`;
  return WILDS_NAMED_REGIONS
    .map((region) => ({ region, distance: Math.hypot(region.position.x - position.x, region.position.z - position.z) }))
    .sort((left, right) => left.distance - right.distance)[0]?.region.name ?? "Verdant Heartlands";
}

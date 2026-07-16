import type { WildsLandmarkDefinition } from "./wilds-landmarks";

export type WildsSettlementDistrictId = "trail-gate" | "dawn-commons" | "mosslight-atelier" | "cartographer-house" | "monument-walk";
export type WildsSettlementResidentId = "mira-vale" | "oren-moss" | "sola-reed";
export type WildsSettlementServiceId = "orientation" | "card-attunement" | "world-archive";

export type WildsSettlementDistrict = {
  id: WildsSettlementDistrictId;
  name: string;
  purpose: string;
  position: readonly [number, number];
};

export type WildsSettlementResident = {
  id: WildsSettlementResidentId;
  name: string;
  title: string;
  districtId: WildsSettlementDistrictId;
  serviceId: WildsSettlementServiceId;
};

export type WildsSettlementService = {
  id: WildsSettlementServiceId;
  name: string;
  cardRequired: boolean;
  minimumReputation: number;
};

export type WildsSettlementDefinition = Omit<WildsLandmarkDefinition, "id" | "kind" | "icon"> & {
  id: "wayfinder-hollow";
  kind: "settlement";
  icon: "compass";
  districts: readonly WildsSettlementDistrict[];
  residents: readonly WildsSettlementResident[];
  services: readonly WildsSettlementService[];
};

export const WAYFINDER_HOLLOW: WildsSettlementDefinition = {
  id: "wayfinder-hollow",
  name: "Wayfinder Hollow",
  subtitle: "A living crossroads where cards, people, and world memory meet",
  kind: "settlement",
  position: { x: 72, z: 40 },
  radius: 10,
  accent: "#f2c86b",
  icon: "compass",
  occupancy: "public",
  cardRequired: false,
  access: { mode: "public", requirements: [] },
  districts: [
    { id: "trail-gate", name: "Trail Gate", purpose: "Arrival and regional orientation", position: [8, 8] },
    { id: "dawn-commons", name: "Dawn Commons", purpose: "Meet explorers in the shared world", position: [0, 1] },
    { id: "mosslight-atelier", name: "Mosslight Atelier", purpose: "Attune a verified companion card", position: [-6, -3] },
    { id: "cartographer-house", name: "Cartographer House", purpose: "Learn routes through memory", position: [6, -4] },
    { id: "monument-walk", name: "Monument Walk", purpose: "Remember canonical world history", position: [0, -8] }
  ],
  residents: [
    { id: "mira-vale", name: "Mira Vale", title: "First Wayfinder", districtId: "trail-gate", serviceId: "orientation" },
    { id: "oren-moss", name: "Oren Moss", title: "Cardwright", districtId: "mosslight-atelier", serviceId: "card-attunement" },
    { id: "sola-reed", name: "Sola Reed", title: "World Archivist", districtId: "monument-walk", serviceId: "world-archive" }
  ],
  services: [
    { id: "orientation", name: "Regional orientation", cardRequired: false, minimumReputation: 0 },
    { id: "card-attunement", name: "Companion attunement", cardRequired: true, minimumReputation: 0 },
    { id: "world-archive", name: "World archive", cardRequired: false, minimumReputation: 0 }
  ]
};

export const WILDS_SETTLEMENTS: readonly WildsSettlementDefinition[] = [WAYFINDER_HOLLOW];

export function settlementAtPosition(position: { x: number; z: number }) {
  return WILDS_SETTLEMENTS.find((settlement) => Math.hypot(settlement.position.x - position.x, settlement.position.z - position.z) <= settlement.radius) ?? null;
}

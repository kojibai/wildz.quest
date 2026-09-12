export type WildsCrewTravelEntry = {
  spaceId: string;
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number } | null;
  blocked: boolean;
  paused: boolean;
};
/** Mutable physical presentation bridge; never a world event or ownership authority. */
export type WildsCrewTravelRuntime = Map<string, WildsCrewTravelEntry>;

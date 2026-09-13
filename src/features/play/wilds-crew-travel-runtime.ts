export type WildsCrewTravelEntry = {
  proofDigest: string;
  halted?: boolean;
  /** Presentation only: endpoints of the last actually admitted swept segment. */
  visualStep?: { from: {x:number;y:number;z:number}; to: {x:number;y:number;z:number}; startedAtMs:number; durationMs:number };
  spaceId: string;
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number } | null;
  blocked: boolean;
  paused: boolean;
};
/** Mutable physical presentation bridge; never a world event or ownership authority. */
export type WildsCrewTravelRuntime = Map<string, WildsCrewTravelEntry>;

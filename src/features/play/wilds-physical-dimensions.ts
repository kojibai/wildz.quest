export const WILDS_SETTLEMENT_PHYSICAL_DIMENSIONS = {
  anchor: { x: 72, z: 40 },
  trailGate: {
    local: [8, 0, 8] as const,
    beamCenterY: 2.48,
    beamScale: [3.5, .28, .42] as const,
    beamHalf: [1.75, .14, .21] as const
  },
  timberHall: {
    districtLocal: [0, 0, 1.25] as const,
    settlementLocal: [0, 0, 2.25] as const,
    bodyCenterY: 1.25,
    bodySize: [4.4, 2.5, 2.8] as const,
    roofCenterY: 2.72,
    roofScale: [3.25, 1, 2.25] as const,
    radius: 3.25,
    topY: 3.72
  }
} as const;

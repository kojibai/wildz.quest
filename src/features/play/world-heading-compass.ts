export type WorldCompassLandmark = {
  id: string;
  name: string;
  position: { x: number; z: number };
};

export type WorldCompassTick = {
  degrees: number;
  label: string;
  offsetDegrees: number;
};

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const VISIBLE_ARC_DEGREES = 60;
const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

export function headingRadiansToDegrees(heading: number) {
  return Math.round(normalizeDegrees(heading * 180 / Math.PI) * 10) / 10;
}

export function shortestHeadingDelta(targetDegrees: number, originDegrees: number) {
  const delta = normalizeDegrees(targetDegrees) - normalizeDegrees(originDegrees);
  return delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
}

function cardinalForDegrees(degrees: number) {
  return CARDINALS[Math.round(normalizeDegrees(degrees) / 45) % CARDINALS.length];
}

function bearingTo(position: { x: number; z: number }, landmark: WorldCompassLandmark) {
  return normalizeDegrees(Math.atan2(landmark.position.x - position.x, -(landmark.position.z - position.z)) * 180 / Math.PI);
}

export function projectWorldHeadingCompass({ heading, x, z, landmarks }: {
  heading: number;
  x: number;
  z: number;
  landmarks: readonly WorldCompassLandmark[];
}) {
  const degrees = headingRadiansToDegrees(heading);
  const ticks: WorldCompassTick[] = [];
  for (let tick = 0; tick < 360; tick += 15) {
    const offsetDegrees = shortestHeadingDelta(tick, degrees);
    if (Math.abs(offsetDegrees) <= VISIBLE_ARC_DEGREES) {
      ticks.push({
        degrees: tick,
        label: tick % 45 === 0 ? cardinalForDegrees(tick) : `${tick}°`,
        offsetDegrees
      });
    }
  }

  const position = { x, z };
  const projectedLandmarks = landmarks.map((landmark) => {
    const bearing = bearingTo(position, landmark);
    return {
      id: landmark.id,
      name: landmark.name,
      bearing,
      distance: Math.hypot(landmark.position.x - x, landmark.position.z - z),
      offsetDegrees: shortestHeadingDelta(bearing, degrees)
    };
  }).filter((landmark) => Math.abs(landmark.offsetDegrees) <= VISIBLE_ARC_DEGREES)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3);

  return { degrees, cardinal: cardinalForDegrees(degrees), ticks, landmarks: projectedLandmarks };
}

import type { KaiKlokMoment } from "./kai-klok-moment";

export type KaiWorldExpression = {
  accent: string;
  atmosphericInfluence: number;
  particleSpeed: number;
  geometrySides: number;
};

export function projectKaiWorldExpression(moment: KaiKlokMoment): KaiWorldExpression {
  return {
    accent: moment.accent,
    atmosphericInfluence: 0.055 + moment.pulseInStep / 500,
    particleSpeed: 0.18 + moment.pulseInStep / 110,
    geometrySides: moment.sides
  };
}

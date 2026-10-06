import type { CreationPose } from './types';
/** A suggestion only: geometry, resources, placement and admission stay with the real compiler. */
export function creationShelterStarterPrompt(input: { displayName?: string; pose: CreationPose }): string {
    const name = input.displayName?.replace(/\p{Cc}/gu, '').trim().slice(0, 80);
    const { x, y, z } = input.pose.position;
    if (![x, y, z].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9)) throw Error('creation_starter_location_invalid');
    const coordinate = (n: number) => String(Number(n.toFixed(3)));
    return `Build ${name ? `a personal home for ${name}` : 'my first home'} here: a cozy, beautifully crafted shelter with a walk-in doorway, protective roof, usable bed, and room to move. Fit the terrain near my living coordinates (${coordinate(x)}, ${coordinate(y)}, ${coordinate(z)}). Use only the creatures and resources I select. Leave room to make it my own.`;
}

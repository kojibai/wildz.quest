import { freezeConstructionProof, validConstructionKai, constructionProofDigest } from '../wilds-construction-project';
export type CreationGardenState = Readonly<{
    planted: number;
    waterUnits: number;
    fertility: number;
    produce: number;
    lastGrowthKaiUPulse: number;
}>;
export type CreationGardenInputs = Readonly<{
    seedUnits: number;
    waterUnits: number;
}>;
export const CREATION_GARDEN_RULES = Object.freeze({ id: 'creation.garden.v1', growthIntervalKaiUPulse: 120000000, maximumStoredUnits: 256, seedPerProduce: 1, waterPerProduce: 1 });
export const CREATION_GARDEN_RULE_HEAD = constructionProofDigest(CREATION_GARDEN_RULES);
function quantity(value: number) { return Number.isSafeInteger(value) && value >= 0 && value <= CREATION_GARDEN_RULES.maximumStoredUnits; }
function validateGardenState(state: CreationGardenState): void {
    if (![state.planted, state.waterUnits, state.produce].every(quantity) || !Number.isSafeInteger(state.fertility) || state.fertility < 0 || state.fertility > 100 || !validConstructionKai(state.lastGrowthKaiUPulse))
        throw Error('creation_garden_state_invalid');
}
/** Pure bounded proposal; callers must atomically consume the exact admitted input lots. */
export function advanceCreationGarden(state: CreationGardenState, kaiUPulse: number, inputs: CreationGardenInputs): CreationGardenState {
    validateGardenState(state);
    if (!validConstructionKai(kaiUPulse) || kaiUPulse < state.lastGrowthKaiUPulse)
        throw Error('creation_garden_time_regressed');
    if (!quantity(inputs.seedUnits) || !quantity(inputs.waterUnits) || state.planted + inputs.seedUnits > 256 || state.waterUnits + inputs.waterUnits > 256)
        throw Error('creation_garden_input_invalid');
    const mature = state.fertility > 0 && kaiUPulse - state.lastGrowthKaiUPulse >= CREATION_GARDEN_RULES.growthIntervalKaiUPulse ? Math.min(state.planted, state.waterUnits, 256 - state.produce) : 0;
    const planted = state.planted - mature + inputs.seedUnits, waterUnits = state.waterUnits - mature + inputs.waterUnits;
    // New inputs begin now; old dry plots cannot retroactively grow when watered.
    const lastGrowthKaiUPulse = mature > 0 || inputs.seedUnits > 0 || inputs.waterUnits > 0 ? kaiUPulse : state.lastGrowthKaiUPulse;
    return freezeConstructionProof({ ...state, planted, waterUnits, produce: state.produce + mature, lastGrowthKaiUPulse });
}
export function harvestCreationGarden(state: CreationGardenState, quantityToHarvest: number) {
    validateGardenState(state);
    if (!quantity(quantityToHarvest) || quantityToHarvest === 0 || quantityToHarvest > state.produce)
        throw Error('creation_garden_produce_unavailable');
    return { garden: freezeConstructionProof({ ...state, produce: state.produce - quantityToHarvest }), quantity: quantityToHarvest };
}

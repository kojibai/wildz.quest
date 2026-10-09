// Run after pnpm test. --modules can select a saved compiled baseline.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = resolve(process.argv.includes('--modules')
  ? process.argv[process.argv.indexOf('--modules') + 1]
  : '.test-build/src/features/play');
const body = await import(pathToFileURL(resolve(directory, 'player-breath-energy.js')));
const { KAI_N_DAY_MICRO } = await import(pathToFileURL(resolve(directory, 'kai-klok-moment.js')));
const { createWildsNaturalTextureData } = await import(pathToFileURL(resolve(directory, 'wilds-natural-material.js')));
const digest = value => createHash('sha256').update(value).digest('hex');
const base = Number(KAI_N_DAY_MICRO) * 100 + 543210;
const source = body.recordPlayerExertion(body.createPlayerBreaths(base, 84), 1.7);
const iterations = 10000;
let result;
const measure = callback => {
  const start = performance.now();
  for (let index = 0; index < iterations; index++) result = callback(index);
  return { totalMs: performance.now() - start, iterations, outputDigest: digest(JSON.stringify(result)) };
};
const textures = {};
// Capture the first call too: texture generation is normally once per role/process.
for (const role of ['bark', 'leaf', 'skin']) {
  const start = performance.now();
  const data = createWildsNaturalTextureData(role);
  textures[role] = { firstCallMs: performance.now() - start, rgbaDigest: digest(data) };
}
// Give both implementations the same warm-up before testing repeated gameplay work.
for (let index = 0; index < 1000; index++) {
  body.playerBreathReadout(source);
  body.projectPlayerBreathState({ energy: 84, playerBreaths: source }, base + index);
}
const readout = measure(() => body.playerBreathReadout(source));
const projectionAndReadout = measure(index => body.playerBreathReadout(
  body.projectPlayerBreathState({ energy: 84, playerBreaths: source }, base + index).playerBreaths));
const movementBody = measure(index => body.recordPlayerExertion(body.advancePlayerBreaths(source, base + index), .03));
const transitions = [];
for (const mode of ['active', 'camp', 'bed', 'sleep', 'swim', 'flight', 'glide']) {
  const state = body.advancePlayerBreaths(source, base, mode);
  for (const elapsed of [0, 1, 999999, 20000000, Number(KAI_N_DAY_MICRO), 500 * Number(KAI_N_DAY_MICRO)]) {
    transitions.push(body.advancePlayerBreaths(state, base + elapsed));
  }
}
console.log(JSON.stringify({ scenario: 'Synthetic body operations and cold texture generation in fresh Node; not iPhone frame timing',
  readout, projectionAndReadout, movementBody, transitionsDigest: digest(JSON.stringify(transitions)), textures }));

export const CREATION_PAGE_SIZE = 128;
export const CREATION_GRAMMAR_VERSION = 1;
export const CREATION_MATERIALS: Readonly<Record<string, Readonly<{ density: number; technique: string; work: number }>>> = Object.freeze({
  hay: Object.freeze({density: .5, technique: 'assembly', work: 1}),
  timber: Object.freeze({density: 1, technique: 'assembly', work: 2}),
  stone: Object.freeze({density: 2, technique: 'masonry', work: 4}),
});
export const CREATION_BEHAVIORS: Readonly<Record<string, Readonly<{ version: number; technique: string; physical: boolean }>>> = Object.freeze(Object.fromEntries([
  ['storage', 'assembly'], ['bed', 'assembly'], ['habitat', 'assembly'], ['weapon', 'forging'], ['tool', 'forging'], ['garden', 'cultivation'], ['sensor', 'assembly'], ['logic', 'assembly'], ['joint', 'engineering'], ['water', 'water'], ['heat', 'engineering'], ['portal', 'space'],
].map(([id,technique])=>[id,Object.freeze({version:1,technique,physical:true})])));

import type { WildsDiscoveryPhysicalNeighborhood, WildsDiscoverySiteProjection } from "./wilds-discovery-sites";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "./wilds-terrain-rendering";

type Point = Readonly<{ x: number; y: number; z: number }>;
export type WildsMonumentSite = Pick<WildsDiscoverySiteProjection, "key" | "regionX" | "regionZ" | "slot" | "family" | "entrance">;
export type WildsMonumentSolid = WildsDiscoveryPhysicalNeighborhood["solids"][number];
export type WildsMonumentPart = Readonly<{
  shape: "block" | "ring" | "prism" | "inlay";
  material: "stone" | "bronze" | "light";
  position: Point;
  size: Point;
  rotation: Point;
  tint: string;
  solidId?: string;
}>;
export type WildsMonumentDescriptor = Readonly<{
  id: string;
  type: "stone-arch" | "compass" | "prism";
  siteKey: string;
  name: string;
  position: Point;
  heading: number;
  viewHeading: number;
  lore: string;
  puzzlePattern: readonly number[];
  style: Readonly<{ seed: number; palette: number; width: number; height: number; detail: number }>;
  parts: readonly WildsMonumentPart[];
  physicalSolids: readonly WildsMonumentSolid[];
}>;

export const WILDS_MONUMENT_VISIBLE_RADIUS = 72;
export const WILDS_MONUMENT_DETAIL_RADIUS = 34;
export const WILDS_MONUMENT_MAX_VISIBLE = 2;
export const WILDS_MONUMENT_INTERACTION_RADIUS = 3.8;
const OUTER = "wildz.space.outer.v1";
const point = (x: number, y: number, z: number): Point => Object.freeze({ x, y, z });
const q = (n: number) => Math.round(n * 1e6) / 1e6;
const mod = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor;
function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}
const unit = (seed: number, lane: number) => hash(`${seed}:${lane}`) / 4294967296;
const stoneTints = ["#827d6b", "#8a8071", "#697772", "#8c827a"];
const lightTints = ["#bddeca", "#edcf8c", "#c5c4ef", "#a5d8e3"];
const descriptorCache = new WeakMap<WildsMonumentSite, WildsMonumentDescriptor | null>();
const listCache = new WeakMap<readonly WildsMonumentSite[], readonly WildsMonumentDescriptor[]>();

function projectMonument(site: WildsMonumentSite): WildsMonumentDescriptor | null {
  if (descriptorCache.has(site)) return descriptorCache.get(site)!;
  const blockX = Math.floor(site.regionX / 2), blockZ = Math.floor(site.regionZ / 2);
  const selection = hash(`monument-block:${blockX}:${blockZ}`) % 4;
  // A fixed region in each block is selected, rather than the first streamed ruin.
  // This keeps the choice stable when neighboring regions arrive in a different order.
  if (site.family !== "ruin" || site.slot !== 3 || site.entrance.y < WILDS_WATERLINE_ELEVATION + .2 || mod(site.regionX, 2) !== selection % 2 || mod(site.regionZ, 2) !== Math.floor(selection / 2)) {
    descriptorCache.set(site, null);
    return null;
  }
  const seed = hash(site.key), palette = seed % stoneTints.length;
  const type = (["stone-arch", "compass", "prism"] as const)[mod(blockX + blockZ * 2, 3)]!;
  // Ruin ordinary routes cross the anchor north/south. Keep physical supports
  // on either side of that lane while varying which face greets the traveler.
  const heading = (seed % 2) * Math.PI;
  const width = q(2.7 + unit(seed, 1) * .8), height = q(2.9 + unit(seed, 2) * .7);
  const style = Object.freeze({ seed, palette, width, height, detail: seed % 3 });
  const id = `monument:${site.key}`;
  const parts: WildsMonumentPart[] = [], physicalSolids: WildsMonumentSolid[] = [];
  function add(shape: WildsMonumentPart["shape"], material: WildsMonumentPart["material"], x: number, y: number, z: number, sx: number, sy: number, sz: number, solid = false, rx = 0, rz = 0) {
    const cos = Math.round(Math.cos(heading)), sin = Math.round(Math.sin(heading));
    const position = point(q(x * cos + z * sin), q(y), q(z * cos - x * sin + (type === "stone-arch" ? .75 : 0)));
    const solidId = solid ? `${id}:solid:${physicalSolids.length}` : undefined;
    const size = point(sx, sy, sz);
    parts.push(Object.freeze({ shape, material, position, size, rotation: point(rx, heading, rz), tint: material === "stone" ? stoneTints[palette]! : material === "bronze" ? "#a68a50" : lightTints[palette]!, ...(solidId ? { solidId } : {}) }));
    if (solidId) physicalSolids.push(Object.freeze({ id: solidId, siteKey: site.key, spaceId: OUTER,
      center: point(q(site.entrance.x + position.x), q(site.entrance.y + y), q(site.entrance.z + position.z)),
      halfExtents: point(q((cos ? sx : sz) / 2), q(sy / 2), q((cos ? sz : sx) / 2)) }));
  }
  if (type === "stone-arch") {
    for (const side of [-1, 1]) {
      add("block", "stone", side * width / 2, height / 2, 0, .64, height, .8, true);
      add("block", "bronze", side * width / 2, height * .55, -.411, .22, .7 + unit(seed, 3) * .3, .02);
    }
    add("block", "stone", 0, height + .16, 0, width + .68, .32, .84, true);
    add("block", "stone", (unit(seed, 4) - .5) * .7, height + .48, .05, .68, .32, .66, true);
    add("ring", "light", 0, height - .35, -.43, .54, .54, .022);
  } else if (type === "compass") {
    add("inlay", "bronze", 0, .035, 0, width + 1, .018, width + 1);
    add("ring", "bronze", 0, .05, 0, width, width, .02, false, -Math.PI / 2);
    const poleHeight = q(1.24 + unit(seed, 5) * .34);
    add("block", "stone", -1.55, poleHeight / 2, 0, .42, poleHeight, .42, true);
    add("ring", "bronze", -1.55, poleHeight + .19, 0, .85, .85, .04);
    add("prism", "light", -1.55, poleHeight + .19, 0, .17, .4, .17);
    for (const side of [-1, 1]) add("block", "stone", side * 1.9, .45, .3, .5, .9, .65, true);
    for (let marker = 0; marker < 4 + style.detail * 2; marker++) {
      const angle = marker * Math.PI * 2 / (4 + style.detail * 2);
      add("block", "bronze", Math.sin(angle) * width * .45, .052, Math.cos(angle) * width * .45, .12, .018, .26 + unit(seed, 6) * .2);
    }
  } else {
    for (let index = 0; index < 3; index++) {
      const angle = index * Math.PI * 2 / 3 + Math.PI / 6, x = Math.sin(angle) * 2, z = Math.cos(angle) * 2;
      add("block", "stone", x, .45, z, .5, .9, .5, true);
      add("prism", "light", x, 1.19 + unit(seed, index + 7) * .2, z, .2, .58, .2);
    }
    add("ring", "light", 0, 1.7, 0, width * .68, width * .68, .035, false, .3 + style.detail * .25, .15);
    add("ring", "bronze", 0, 1.7, 0, width * .48, width * .48, .025, false, -.35, .65);
  }
  const names = { "stone-arch": ["The Listening Arch", "Archive of Rain", "Weathered Threshold", "The Last Waymark", "Gate of Returning", "The Stone Memory", "Arch of Quiet Footsteps", "The Mossbound Record"], compass: ["Windward Compass", "The Far Horizon", "Sunward Observatory", "The Wandering Needle", "Horizon of Reeds", "Compass of First Light", "The Stormwatch", "The Long View"], prism: ["Prism of Echoes", "The Threefold Light", "Ring of Afterglow", "The Broken Spectrum", "Lantern of Tides", "The Still Aurora", "Halo of Returning", "The Keeper's Sequence"] };
  const lore = { "stone-arch": ["Travelers carved a crossing calendar into this arch. One worn line records a season when rain held the pass closed for thirty days.", "The bronze marks name no ruler. They record the walkers who carried seed between valleys when the old paths disappeared beneath moss.", "A small inscription asks every traveler to leave the stones standing. Beneath it, another hand has added: we found our way home.", "The archivist used weather instead of dates. Each groove marks a storm survived; the last is unfinished, waiting for a quieter season.", "This threshold once marked the edge of a vanished settlement. The deep cuts are door names, preserved after the wooden houses returned to earth.", "Two builders signed opposite pillars. Their final lines meet above the opening, a record of paths brought together across the mountain.", "The smooth inner stones were polished by generations of passing hands. A shallow bronze symbol recalls the song used to guide lost walkers.", "The arch remembers a journey made without a map. Its inscription points toward water, shelter, and the first light after a long storm."], compass: ["The sight ring was aligned to the first clear dawn after the valley thawed. Look through it to follow the ridges that once guided the thaw watchers.", "Walkers shared this compass with migrating birds. Its bronze bearings point toward the open horizon, where weather can be read before it arrives.", "A keeper recorded distant fires in the compass rim. The marks preserve a route between safe camps now hidden within the changing landscape.", "This observatory measures no distance. Its careful sight lines frame the neighboring hills, inviting a patient view of the moving wilds.", "The compass needle was removed long ago, but the horizon marks remain. They trace the route used by returning travelers beneath evening light.", "A worn crescent in the rim marks the sun's winter path. The sight ring remembers the people who waited here for the year's first warm morning.", "The stormwatcher raised this ring to see beyond the trees. Its tarnished bronze still frames the places where clouds gather before rainfall.", "The outer marks were set by a traveler who walked every visible ridge. Follow the panorama to see how their horizon joined these scattered paths."], prism: ["Three prisms preserve the order of a vanished lantern signal. Align their colors to let the suspended rings remember its brief harmony.", "The keeper separated a single beam into three notes of light. Their sequence remains in the crystal, waiting for the colors to be brought together.", "A storm broke the old prism frame, but the receivers endured. Their remembered color order can wake a quiet afterglow within the rings.", "These rings were made to catch the last light before dusk. Set the prisms in their recorded order to reveal the pattern once shared across the valley.", "The crystal maker left three tones in a bronze-bound memory. Align the colors to answer the signal sent from this place many seasons ago.", "A tide watcher used this spectrum to greet distant camps. Its simple sequence survives as a gentle pulse through the suspended rings.", "The halo holds a fragment of an unfinished aurora. Bring the three prism colors into order to join its scattered light for a moment.", "The old lantern was dismantled so its light could travel. Three pieces remain here, still waiting to echo the keeper's remembered sequence."] };
  const pattern = [0, 1, 2];
  for (let index = 2; index > 0; index--) { const next = hash(`${seed}:pattern:${index}`) % (index + 1); [pattern[index], pattern[next]] = [pattern[next]!, pattern[index]!]; }
  const result = Object.freeze({ id, type, siteKey: site.key, name: names[type][hash(`${seed}:name`) % 8]!, position: point(site.entrance.x, site.entrance.y, site.entrance.z), heading, viewHeading: q(unit(seed, 8) * Math.PI * 2), lore: lore[type][hash(`${seed}:lore`) % 8]!, puzzlePattern: Object.freeze(pattern), style, parts: Object.freeze(parts), physicalSolids: Object.freeze(physicalSolids) });
  descriptorCache.set(site, result);
  return result;
}

export function projectWildsMonuments(sites: readonly WildsMonumentSite[]): readonly WildsMonumentDescriptor[] {
  const cached = listCache.get(sites);
  if (cached) return cached;
  const result = Object.freeze(sites.flatMap(site => { const monument = projectMonument(site); return monument ? [monument] : []; }).sort((a, b) => a.id.localeCompare(b.id)));
  listCache.set(sites, result);
  return result;
}

export function projectVisibleWildsMonuments(monuments: readonly WildsMonumentDescriptor[], player: Readonly<{ x: number; z: number }>) {
  if (!Number.isFinite(player.x) || !Number.isFinite(player.z)) return Object.freeze([]);
  return Object.freeze(monuments.map(monument => Object.freeze({ monument, distance: Math.hypot(monument.position.x - player.x, monument.position.z - player.z) }))
    .filter(candidate => candidate.distance <= WILDS_MONUMENT_VISIBLE_RADIUS).sort((a, b) => a.distance - b.distance || a.monument.id.localeCompare(b.monument.id)).slice(0, WILDS_MONUMENT_MAX_VISIBLE));
}

export type WildsWaterfallChute = Readonly<{
  siteKey: string;
  source: Point;
  pool: Point;
  flowPath: readonly Point[];
  width: number;
  seed: number;
  parts: readonly WildsMonumentPart[];
  physicalSolids: readonly WildsMonumentSolid[];
}>;
const chuteCache = new WeakMap<WildsDiscoverySiteProjection, WildsWaterfallChute | null>();
const physicalCache = new WeakMap<WildsDiscoveryPhysicalNeighborhood, WildsDiscoveryPhysicalNeighborhood>();

export function projectWildsWaterfallChute(site: WildsDiscoverySiteProjection): WildsWaterfallChute | null {
  if (chuteCache.has(site)) return chuteCache.get(site)!;
  if (!site.waterfall) { chuteCache.set(site, null); return null; }
  const water = site.waterfall, seed = hash(`${site.key}:chute`);
  const parts: WildsMonumentPart[] = [], physicalSolids: WildsMonumentSolid[] = [];
  const sourceHeight = water.source.y - site.entrance.y;
  function rock(x: number, bottom: number, z: number, width: number, height: number, depth: number, lane: number) {
    if (height <= .04) return;
    const position = point(q(x), q(bottom + height / 2), q(z));
    const size = point(q(width), q(height), q(depth));
    const solidId = `waterfall-chute:${site.key}:${parts.length}`;
    parts.push(Object.freeze({ shape: "block" as const, material: "stone" as const, position, size, rotation: point(0, 0, 0), tint: stoneTints[(seed + lane) % stoneTints.length]!, solidId }));
    physicalSolids.push(Object.freeze({ id: solidId, siteKey: site.key, spaceId: OUTER, center: point(site.entrance.x + position.x, site.entrance.y + position.y, site.entrance.z + position.z), halfExtents: point(size.x / 2, size.y / 2, size.z / 2) }));
  }
  // Split feet form a pass beneath the chute. The central channel remains clear
  // for the existing safe route; small hills have an open channel instead of a low roof.
  for (const side of [-1, 1]) {
    const x = side * (1.42 + unit(seed, 4) * .13);
    const foot = Math.min(-.12, sampleWildsTerrain(site.entrance.x + x, site.entrance.z + 2.35).elevation - site.entrance.y - .12);
    const top = sourceHeight + .25;
    rock(x, foot, 2.35, .68 + unit(seed, 12 + side) * .13, top - foot, .94 + unit(seed, 20 + side) * .16, side < 0 ? 0 : 1);
  }
  const roof = 2.95;
  if (sourceHeight > roof + .35) {
    rock(0, roof, 2.38, 2.24 + unit(seed, 25) * .2, sourceHeight - roof, .96, 2);
    rock(0, sourceHeight - .14, 1.94, 2.12, .2, .7, 4);
  }
  const result = Object.freeze({ siteKey: site.key, source: water.source, pool: water.pool, flowPath: water.flowPath, width: q(1.38 + unit(seed, 2) * .42), seed, parts: Object.freeze(parts), physicalSolids: Object.freeze(physicalSolids) });
  chuteCache.set(site, result);
  return result;
}

/** Call before preparing the site's collision index. Canonical water/portal/route data is retained. */
export function appendWildsDiscoveryVisualSolids(physical: WildsDiscoveryPhysicalNeighborhood): WildsDiscoveryPhysicalNeighborhood {
  const cached = physicalCache.get(physical);
  if (cached) return cached;
  const additions = [...projectWildsMonuments(physical.sites).flatMap(monument => monument.physicalSolids), ...physical.sites.flatMap(site => projectWildsWaterfallChute(site)?.physicalSolids ?? [])];
  const ids = new Set(physical.solids.map(solid => solid.id));
  const missing = additions.filter(solid => !ids.has(solid.id));
  const next = missing.length ? Object.freeze({ ...physical, solids: Object.freeze([...physical.solids, ...missing]) }) : physical;
  physicalCache.set(physical, next);
  physicalCache.set(next, next);
  return next;
}

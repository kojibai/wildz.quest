/** Navigation consumes canonical physical admission; it never grants a genome ability. */
export type WildsCrewNavigationPoint = { x: number; y: number; z: number };
export type WildsCrewNavigationMode = "walk" | "flight" | "swim";
export type WildsCrewNavigationSample = { allowed: boolean; y: number };
/**
 * Must certify the ENTIRE swept segment (including creature radius, slope, step/drop,
 * ceiling and current space), not just the endpoint. For walking, y is the admitted
 * support floor; for flight/swimming it is the admitted height. Bind canonical world
 * and exact creature capabilities in the caller. Never resolve collision by pushing
 * x/z out: a blocked segment must return allowed=false. Called with distinct points.
 */
export type WildsCrewSegmentSampler = (from: Readonly<WildsCrewNavigationPoint>, to: Readonly<WildsCrewNavigationPoint>, mode: WildsCrewNavigationMode, output: WildsCrewNavigationSample) => void;
export type WildsCrewNavigationAuthority = {
  mode: WildsCrewNavigationMode;
  permittedModes: readonly WildsCrewNavigationMode[];
  sampleSegment: WildsCrewSegmentSampler;
  /** Optional canonical local planning destination; final journey targets stay intact. */
  routeTarget?: (start:Readonly<WildsCrewNavigationPoint>,target:Readonly<WildsCrewNavigationPoint>)=>Readonly<WildsCrewNavigationPoint>;
};
export type WildsCrewPathReason = "path" | "arrived" | "unreachable" | "budget-exhausted" | "blocked-start" | "blocked-target" | "mode-not-permitted" | "invalid-input";
export type WildsCrewPath = { reason: WildsCrewPathReason; waypoints: readonly Readonly<WildsCrewNavigationPoint>[]; visitedNodes: number };
const finitePoint = (p: Readonly<WildsCrewNavigationPoint>) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const permitted = (a: WildsCrewNavigationAuthority) => (a.mode === "walk" || a.mode === "flight" || a.mode === "swim") && a.permittedModes.includes(a.mode);
function sample(a: WildsCrewNavigationAuthority, from: Readonly<WildsCrewNavigationPoint>, to: Readonly<WildsCrewNavigationPoint>, out: WildsCrewNavigationSample) {
  out.allowed = false; out.y = NaN;
  a.sampleSegment(from, to, a.mode, out);
  return Boolean(out.allowed) && Number.isFinite(out.y);
}

/** Bounded deterministic 2.5D A*. Failure never returns a partial or invented route.
 * 'unreachable' means within this grid/search radius, not proof about the whole world.
 * Nodes use canonical sampled heights; airborne routes do not search vertical detours.
 */
export function planWildsCrewPath(input: WildsCrewNavigationAuthority & {
  start: Readonly<WildsCrewNavigationPoint>; target: Readonly<WildsCrewNavigationPoint>;
  cellSize?: number; maxNodes?: number; maxDistance?: number;
}): WildsCrewPath {
  const result = (reason: WildsCrewPathReason, visitedNodes = 0, waypoints: WildsCrewNavigationPoint[] = []): WildsCrewPath => ({ reason, visitedNodes, waypoints });
  const cell = input.cellSize ?? 1, budget = input.maxNodes ?? 128, radius = input.maxDistance ?? 32;
  if (!finitePoint(input.start) || !finitePoint(input.target) || !Number.isFinite(cell) || cell < .1 || cell > 16 || !Number.isInteger(budget) || budget < 1 || budget > 4096 || !Number.isFinite(radius) || radius < cell || radius > 256) return result("invalid-input");
  if (!permitted(input)) return result("mode-not-permitted");
  const out: WildsCrewNavigationSample = { allowed: false, y: NaN };
  const start = { ...input.start }, target = { ...input.target };
  if (!sample(input, input.start, start, out)) return result("blocked-start");
  start.y = out.y;
  if (!sample(input, input.target, target, out)) return result("blocked-target");
  target.y = out.y;
  if (Math.hypot(start.x - target.x, start.z - target.z) > radius) return result("unreachable");
  if (Math.hypot(start.x - target.x, start.y - target.y, start.z - target.z) < 1e-6) return result("arrived");
  type Node = { p: WildsCrewNavigationPoint; ix: number; iz: number; cost: number; score: number; parent: Node | null; closed: boolean };
  const heuristic = (p: WildsCrewNavigationPoint) => Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
  const first: Node = { p: start, ix: 0, iz: 0, cost: 0, score: heuristic(start), parent: null, closed: false };
  const nodes = new Map<string, Node>([["0,0", first]]), open = [first];
  // Diagonals still use the same swept collision test, including corners.
  const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let visited = 0, limited = false;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i;
    const current = open.splice(best, 1)[0]; current.closed = true; visited++;
    if (Math.hypot(current.p.x - target.x, current.p.z - target.z) <= cell && sample(input, current.p, target, out) && Math.abs(out.y - target.y) < 1e-6) {
      const path: WildsCrewNavigationPoint[] = [target];
      for (let n: Node | null = current; n?.parent; n = n.parent) path.push(n.p);
      return result("path", visited, path.reverse());
    }
    for (const [dx, dz] of offsets) {
      const ix = current.ix + dx, iz = current.iz + dz, key = `${ix},${iz}`;
      if (Math.hypot(ix * cell, iz * cell) > radius) continue;
      const existing = nodes.get(key);
      if (existing?.closed) continue;
      if (!existing && nodes.size >= budget) { limited = true; continue; }
      const p = { x: start.x + ix * cell, y: current.p.y, z: start.z + iz * cell };
      if (!sample(input, current.p, p, out)) continue;
      p.y = out.y;
      const cost = current.cost + Math.hypot(p.x - current.p.x, p.y - current.p.y, p.z - current.p.z);
      if (existing) {
        if (cost < existing.cost) { existing.cost = cost; existing.score = cost + heuristic(p); existing.parent = current; existing.p = p; }
      } else {
        const node: Node = { p, ix, iz, cost, score: cost + heuristic(p), parent: current, closed: false };
        nodes.set(key, node); open.push(node);
      }
    }
  }
  return result(limited ? "budget-exhausted" : "unreachable", visited);
}

export type WildsCrewPathStepState = {
  waypointIndex: number; reason: "moving" | "arrived" | "blocked" | "mode-not-permitted" | "invalid-input";
  candidate: WildsCrewNavigationPoint; sample: WildsCrewNavigationSample;
};
export function createWildsCrewPathStepState(): WildsCrewPathStepState {
  return { waypointIndex: 0, reason: "moving", candidate: { x: 0, y: 0, z: 0 }, sample: { allowed: false, y: NaN } };
}
/** Allocation-free single-segment frame step. Reset state when replacing waypoints.
 * Revalidates current geometry, so a wall built after planning stops this step.
 */
export function writeWildsCrewPathStep(position: WildsCrewNavigationPoint, waypoints: readonly Readonly<WildsCrewNavigationPoint>[], state: WildsCrewPathStepState,
  input: WildsCrewNavigationAuthority & { speed: number; deltaSeconds: number; accompanyingSpeedLimit?: number }): void {
  if (!permitted(input)) { state.reason = "mode-not-permitted"; return; }
  if ((input.accompanyingSpeedLimit !== undefined && (!Number.isFinite(input.accompanyingSpeedLimit) || input.accompanyingSpeedLimit < 0)) || !finitePoint(position) || !Number.isFinite(input.speed) || input.speed < 0 || !Number.isFinite(input.deltaSeconds) || input.deltaSeconds < 0 || !Number.isInteger(state.waypointIndex) || state.waypointIndex < 0 || state.waypointIndex > waypoints.length) { state.reason = "invalid-input"; return; }
  const target = waypoints[state.waypointIndex];
  if (!target) { state.reason = "arrived"; return; }
  if (!finitePoint(target)) { state.reason = "invalid-input"; return; }
  const distance = Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z);
  const step = Math.min(input.speed, Math.max(24, Math.min(72, input.accompanyingSpeedLimit ?? 24))) * Math.min(input.deltaSeconds, .1);
  if (step === 0 && distance > 1e-6) { state.reason = "moving"; return; }
  let fraction = distance <= 1e-6 ? 1 : Math.min(1, step / distance);
  const p = state.candidate;
  let admitted = false;
  // Curved terrain can make the sampled floor higher than the waypoint chord.
  // Retry shorter sweeps within a fixed budget; never relax collision or speed caps.
  for (let attempt = 0; attempt < 6; attempt++) {
    p.x = position.x + (target.x - position.x) * fraction;
    p.y = position.y + (target.y - position.y) * fraction;
    p.z = position.z + (target.z - position.z) * fraction;
    if (!sample(input, position, p, state.sample)) { state.reason = "blocked"; return; }
    p.y = state.sample.y;
    const sampledDistance = Math.hypot(p.x - position.x, p.y - position.y, p.z - position.z);
    if (sampledDistance <= step + 1e-6) { admitted = true; break; }
    fraction *= Math.min(.99, step / sampledDistance * .999);
  }
  if (!admitted) { state.reason = "blocked"; return; }
  position.x = p.x; position.y = p.y; position.z = p.z;
  if (Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z) <= 1e-6) state.waypointIndex++;
  state.reason = state.waypointIndex === waypoints.length ? "arrived" : "moving";
}

/** Chase a fresh moving target every frame; planning is only a detour fallback.
 * The direct state belongs to the caller and is independent of the saved route cursor.
 */
export function writeWildsCrewFollowingStep(position: WildsCrewNavigationPoint, target: Readonly<WildsCrewNavigationPoint>, waypoints: readonly Readonly<WildsCrewNavigationPoint>[], routeState: WildsCrewPathStepState,
  directState: WildsCrewPathStepState, directWaypoints: Readonly<WildsCrewNavigationPoint>[], input: WildsCrewNavigationAuthority & { speed: number; deltaSeconds: number; accompanyingSpeedLimit?: number }): void {
  // Finish a safe detour before chasing the moving anchor again. Direct chase must
  // not continually pull the actor back into the obstacle it is walking around.
  if (routeState.reason === "moving" && routeState.waypointIndex < waypoints.length) {
    writeWildsCrewPathStep(position, waypoints, routeState, input);
    return;
  }
  directWaypoints[0] = target;
  directState.waypointIndex = 0;
  writeWildsCrewPathStep(position, directWaypoints, directState, input);
  if (directState.reason === "blocked" && waypoints.length) writeWildsCrewPathStep(position, waypoints, routeState, input);
}

/** Only stalled/completed routes may be replaced; timer ticks cannot reset progress. */
export function wildsCrewRouteNeedsReplan(waypoints: readonly Readonly<WildsCrewNavigationPoint>[], routeState: WildsCrewPathStepState, directState: WildsCrewPathStepState): boolean {
  if (routeState.reason === "moving" && routeState.waypointIndex < waypoints.length) return false;
  return routeState.reason === "blocked" || directState.reason === "blocked";
}

/** An alongside anchor may fall inside a tree. Try a bounded set of adjacent supported
 * targets and return only an actually traversable path. Never relocates the actor.
 */
export function planWildsCrewPathNearTarget(input: Parameters<typeof planWildsCrewPath>[0]): WildsCrewPath {
  if(input.routeTarget)input={...input,target:input.routeTarget(input.start,input.target)};
  const maximum = input.maxNodes ?? 192;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 4096) return { reason: "invalid-input", visitedNodes: 0, waypoints: [] };
  const exact = planWildsCrewPath({ ...input, maxNodes: Math.max(1, maximum - Math.min(48, Math.floor(maximum / 4))) });
  if (exact.reason !== "blocked-target" && exact.reason !== "unreachable" && exact.reason !== "budget-exhausted") return exact;
  let visited = exact.visitedNodes;
  const candidates: WildsCrewNavigationPoint[] = [];
  for (const radius of [.8, 1.6]) for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    candidates.push({ x: input.target.x + Math.cos(angle) * radius, y: input.target.y, z: input.target.z + Math.sin(angle) * radius });
  }
  candidates.sort((a, b) => Math.hypot(a.x - input.start.x, a.z - input.start.z) - Math.hypot(b.x - input.start.x, b.z - input.start.z));
  for (const target of candidates) {
    if (visited >= maximum) return { reason: "budget-exhausted", visitedNodes: visited, waypoints: [] };
    const planned = planWildsCrewPath({ ...input, target, maxNodes: Math.min(48, maximum - visited) });
    visited += planned.visitedNodes;
    if (planned.reason === "arrived") return { reason: "path", visitedNodes: visited, waypoints: [{ ...input.start }] };
    if (planned.reason === "path") return { ...planned, visitedNodes: visited };
  }
  return { reason: visited >= maximum ? "budget-exhausted" : "unreachable", visitedNodes: visited, waypoints: [] };
}

export type WildsCrewHeading = { playerX: number; playerZ: number; heading: number; desiredHeading: number };
/** Uses actual displacement; a stationary player retains the last travel direction. */
export function writeWildsCrewAlongsideTarget(output: WildsCrewNavigationPoint, state: WildsCrewHeading, player: Readonly<{ x: number; z: number }>, side: number, deltaSeconds: number): void {
  const dx = player.x - state.playerX, dz = player.z - state.playerZ;
  if (Math.hypot(dx, dz) > .0001) state.desiredHeading = Math.atan2(dx, dz);
  state.playerX = player.x; state.playerZ = player.z;
  const turn = Math.atan2(Math.sin(state.desiredHeading - state.heading), Math.cos(state.desiredHeading - state.heading));
  state.heading += turn * (1 - Math.exp(-Math.max(0, Math.min(.1, deltaSeconds)) * 12));
  output.x = player.x + Math.cos(state.heading) * side;
  output.z = player.z - Math.sin(state.heading) * side;
}

/** Call only for a changed, explicitly admitted party transport token. This validates
 * destination occupancy; follow recovery uses its separate validated regroup policy. */
export function writeWildsCrewTransportPosition(position: WildsCrewNavigationPoint, destination: Readonly<WildsCrewNavigationPoint>, scratch: WildsCrewNavigationSample, authority: WildsCrewNavigationAuthority): boolean {
  if (!finitePoint(destination) || !permitted(authority) || !sample(authority, destination, destination, scratch)) return false;
  position.x = destination.x; position.y = scratch.y; position.z = destination.z;
  return true;
}

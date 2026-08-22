import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsMountainFieldValue } from "../src/features/play/wilds-discovery-sites";
import { enterWildsSiteRuntime, exitWildsSiteRuntime, prepareWildsSiteRuntime, projectWildsSitePortalCue, wildsSiteRuntimeCameraIsFlooded, wildsSiteRuntimeDiagnostics, writeWildsSiteRuntimeAerialCollision, writeWildsSiteRuntimeCamera, writeWildsSiteRuntimeDiscovery, writeWildsSiteRuntimeEncounter, writeWildsSiteRuntimeLanding, writeWildsSiteRuntimeMovement } from "../src/features/play/wilds-site-runtime";
import { createWildsVerticalTraversalState, writeWildsVerticalTraversalStep } from "../src/features/play/wilds-vertical-traversal";

describe("production Wilds site runtime", () => {
  it("makes cave entrances legible before the interaction radius", () => {
    assert.equal(projectWildsSitePortalCue(14.01), null);
    assert.deepEqual(projectWildsSitePortalCue(6), { label: "Cave entrance", action: null });
    assert.deepEqual(projectWildsSitePortalCue(3), { label: "Enter", action: "enter" });
  });
  it("retains the exact immutable physical authority", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(3, 2);
    const runtime = prepareWildsSiteRuntime(physical);
    assert.equal(prepareWildsSiteRuntime(physical), runtime);
    assert.equal(runtime.physical, physical);
    assert.equal(runtime.sites, physical.sites);
    assert.equal(Object.isFrozen(runtime), true);
  });

  it("enters and exits through the exact portal", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(3, 2));
    const portal = runtime.physical.portals[0]!;
    const entered = enterWildsSiteRuntime(runtime, portal.siteKey, portal.position)!;
    assert.equal(entered.spaceId, portal.toSpaceId);
    assert.equal(entered.siteKey, portal.siteKey);
    assert.ok(entered.surfaceId);
    assert.equal(exitWildsSiteRuntime(runtime, entered, `${portal.siteKey}:wrong`), null);
    assert.equal(exitWildsSiteRuntime(runtime, { ...entered, position: { x: entered.position.x + 20, y: entered.position.y, z: entered.position.z } }, portal.siteKey), null);
    const exited = exitWildsSiteRuntime(runtime, entered, portal.siteKey)!;
    assert.equal(exited.spaceId, portal.fromSpaceId);
    assert.deepEqual(exited.position, portal.position);
    assert.equal(enterWildsSiteRuntime(runtime, portal.siteKey, { x: portal.position.x + 20, y: portal.position.y, z: portal.position.z }), null);
  });

  it("shares floors, solids, ceilings, encounters, and discovery", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(3, 2));
    const portal = runtime.physical.portals[0]!;
    const entered = enterWildsSiteRuntime(runtime, portal.siteKey, portal.position)!;
    const movement = { x: 0, z: 0, floorY: 0, ceilingY: 0, surfaceId: null as string | null, flooded: false, blocked: false };
    assert.equal(writeWildsSiteRuntimeMovement(movement, runtime, entered.spaceId, entered.position.x, entered.position.y, entered.position.z, entered.position.x + .1, entered.position.z + .1, .38), movement);
    assert.ok(movement.surfaceId);
    const camera = { floorY: 0, ceilingY: 0, flooded: false, waterSurfaceY: Number.NaN };
    assert.equal(writeWildsSiteRuntimeCamera(camera, runtime, entered.spaceId, movement.x, movement.floorY, movement.z), camera);
    assert.equal(camera.ceilingY, movement.ceilingY);
    const aerial = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
    assert.equal(writeWildsSiteRuntimeAerialCollision(aerial, runtime, entered.spaceId, movement.x, movement.floorY, movement.z, 1.55, .38), aerial);
    assert.equal(aerial.ceilingY, movement.ceilingY);
    const ceiling = runtime.physical.ceilings.find((candidate) => candidate.spaceId === entered.spaceId)!;
    const underside = ceiling.center.y - ceiling.halfExtents.y;
    writeWildsSiteRuntimeAerialCollision(aerial, runtime, entered.spaceId, ceiling.center.x, underside - 1, ceiling.center.z, 1.55, .38);
    assert.ok(Number.isFinite(aerial.ceilingY));
    assert.ok(aerial.ceilingY <= underside);
    assert.equal(aerial.protectedAirspace, true);
    assert.ok(aerial.blockerId?.startsWith(`ceiling:${portal.siteKey}:`));
    const encounter = { siteKey: null as string | null, spaceId: "", layer: "ground" as "ground" | "surface" | "water-column" | "seabed" | "air", minY: 0, maxY: 0 };
    assert.equal(writeWildsSiteRuntimeEncounter(encounter, runtime, entered.spaceId, movement.x, movement.floorY + 1, movement.z), encounter);
    assert.equal(encounter.siteKey, portal.siteKey);
    const discovery = { siteKey: null as string | null };
    assert.equal(writeWildsSiteRuntimeDiscovery(discovery, runtime, entered.spaceId, movement.x, movement.floorY, movement.z), discovery);
    assert.equal(discovery.siteKey, portal.siteKey);
    const landing = { x: 0, z: 0, floorY: 0, found: false };
    assert.equal(writeWildsSiteRuntimeLanding(landing, runtime, entered.spaceId, movement.x, movement.floorY, movement.z), landing);
    assert.equal(landing.found, true);

    const outerSolid = runtime.physical.solids.find((solid) => solid.spaceId === "wildz.space.outer.v1")!;
    const reroutedLanding = { x: 0, z: 0, floorY: 0, found: false };
    writeWildsSiteRuntimeLanding(reroutedLanding, runtime, outerSolid.spaceId, outerSolid.center.x, outerSolid.center.y, outerSolid.center.z);
    assert.equal(reroutedLanding.found, true);
    assert.ok(Number.isFinite(reroutedLanding.floorY));

    const flooded = runtime.physical.waterVolumes.find((water) => water.kind === "flooded-interior");
    assert.ok(flooded);
    const floodedCamera = { floorY: 0, ceilingY: 0, flooded: false, waterSurfaceY: Number.NaN };
    writeWildsSiteRuntimeCamera(floodedCamera, runtime, flooded.spaceId, flooded.center.x, flooded.center.y, flooded.center.z);
    assert.equal(floodedCamera.flooded, true);
    assert.equal(floodedCamera.waterSurfaceY, flooded.center.y + flooded.halfExtents.y);
  });

  it("lets everyone reach foothills, reserves upper slopes for climbers, and always permits descent", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const field = runtime.physical.mountainFields[0]!;
    const edge = field.nodes[0]!;
    const center = field.nodes[Math.floor(field.nodes.length / 2)]!;
    const movement = { x: 0, z: 0, floorY: 0, ceilingY: 0, surfaceId: null as string | null, flooded: false, blocked: false };

    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, edge.x - .2, edge.baseY, edge.z, edge.x, edge.z, .38, edge.baseY, false);
    assert.equal(movement.blocked, false);
    assert.equal(movement.floorY, edge.topY);

    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, center.x - .2, center.baseY, center.z, center.x, center.z, .38, center.baseY, false);
    assert.equal(movement.blocked, true);
    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, center.x - .2, center.baseY, center.z, center.x, center.z, .38, center.baseY, true);
    assert.equal(movement.blocked, false);
    assert.equal(movement.floorY, center.topY);

    const outwardX = center.x + Math.sign(center.x - field.center.x || 1) * .5;
    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, center.x, center.topY, center.z, outwardX, center.z, .38, center.topY, false);
    assert.notEqual(movement.x, center.x);
    assert.equal(movement.blocked, false);

    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, center.x, center.baseY, center.z, outwardX, center.z, .38, center.baseY, false);
    assert.notEqual(movement.x, center.x);
    assert.equal(movement.blocked, false);
  });

  it("lets powered flight rise from a mountain slope instead of treating nearby terrain as a ceiling", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-2, -2));
    const field = runtime.physical.mountainFields.find((candidate) => candidate.nodes.some((node) => {
      const rise = node.topY - node.baseY;
      return rise > .4 && rise < 2;
    }))!;
    const launch = field.nodes.find((node) => {
      const rise = node.topY - node.baseY;
      return rise > .4 && rise < 2;
    })!;
    const vertical = createWildsVerticalTraversalState();
    const aerial = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null, floorY: Number.NaN, flooded: false, waterSurfaceY: Number.NaN };
    writeWildsVerticalTraversalStep(vertical, {
      deltaSeconds: 0,
      initialOffset: .35,
      intent: 0,
      layer: "air",
      liftPotential: .2,
      powered: true,
      stamina: 100,
      terrainElevation: launch.topY
    });
    for (let frame = 0; frame < 30; frame += 1) {
      writeWildsSiteRuntimeAerialCollision(aerial, runtime, field.spaceId, launch.x, vertical.worldY, launch.z, 1.55, .38);
      writeWildsVerticalTraversalStep(vertical, {
        ceilingY: aerial.ceilingY,
        deltaSeconds: .1,
        intent: 0,
        layer: "air",
        liftPotential: .2,
        obstacleTopY: aerial.obstacleTopY,
        powered: true,
        stamina: 100,
        terrainElevation: aerial.floorY
      });
    }
    assert.equal(vertical.offset, 6);
    assert.equal(aerial.protectedAirspace, false);
  });

  it("lets a flyer clear a mountain by world height without requiring climb anatomy", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const field = runtime.physical.mountainFields[0]!;
    const center = field.nodes[Math.floor(field.nodes.length / 2)]!;
    const movement = { x: 0, z: 0, floorY: 0, ceilingY: 0, surfaceId: null as string | null, flooded: false, blocked: false };
    writeWildsSiteRuntimeMovement(
      movement,
      runtime,
      field.spaceId,
      center.x - .2,
      center.baseY,
      center.z,
      center.x,
      center.z,
      .38,
      center.baseY,
      false,
      center.topY + 1
    );
    assert.equal(movement.blocked, false);
  });

  it("uses the same triangle plane for rendered and physical mountain height", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const field = runtime.physical.mountainFields[0]!;
    const northwest = field.nodes[0]!;
    const northeast = field.nodes[1]!;
    const southwest = field.nodes[field.columns]!;
    const amountX = .25;
    const amountZ = .25;
    const x = northwest.x + (northeast.x - northwest.x) * amountX;
    const z = northwest.z + (southwest.z - northwest.z) * amountZ;
    const expected = Math.round((northwest.topY + (northeast.topY - northwest.topY) * amountX + (southwest.topY - northwest.topY) * amountZ) * 1_000_000) / 1_000_000;
    const camera = { floorY: 0, ceilingY: 0, flooded: false, waterSurfaceY: Number.NaN };
    writeWildsSiteRuntimeCamera(camera, runtime, field.spaceId, x, northwest.baseY, z);
    assert.equal(camera.floorY, expected);
  });

  it("does not misreport a ridge triangle as an overhead flight obstacle", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const field = runtime.physical.mountainFields[0]!;
    const x = field.center.x + field.halfExtents.x + .2;
    const z = field.center.z;
    const aerial = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
    writeWildsSiteRuntimeAerialCollision(aerial, runtime, field.spaceId, x, field.center.y, z, 1.55, .38);
    assert.equal(Number.isFinite(aerial.obstacleTopY), false);
  });

  it("keeps ridge corners in the ground authority rather than inventing a ceiling", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const field = runtime.physical.mountainFields[0]!;
    const x = field.center.x + field.halfExtents.x + .34;
    const z = field.center.z + field.halfExtents.z + .10;
    const aerial = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
    writeWildsSiteRuntimeAerialCollision(aerial, runtime, field.spaceId, x, field.center.y, z, 1.55, .38);
    assert.equal(Number.isFinite(aerial.obstacleTopY), false);
  });

  it("gates climb from the maximum local rise instead of unrelated height maxima", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-5, -5));
    const field = runtime.physical.mountainFields.find((candidate) => candidate.id === "mountain-field:wildz.site.v1:-5:-5:0:bdae1732b2b0974e:west")!;
    const x = -638.928744;
    const z = -640.502925;
    const y = wildsMountainFieldValue(field, x, z, "baseY");
    const movement = { x, z, floorY: y, ceilingY: Number.POSITIVE_INFINITY, surfaceId: null as string | null, flooded: false, blocked: false };
    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, x, y, z, x, z, .38, y, false);
    assert.equal(movement.blocked, true);
    writeWildsSiteRuntimeMovement(movement, runtime, field.spaceId, x, y, z, x, z, .38, y, true);
    assert.equal(movement.blocked, false);
  });

  it("treats a mountain floor above overlapping water as dry camera space", () => {
    assert.equal(wildsSiteRuntimeCameraIsFlooded({ flooded: true, floorY: 2, waterSurfaceY: 1 }), false);
    assert.equal(wildsSiteRuntimeCameraIsFlooded({ flooded: true, floorY: .9, waterSurfaceY: 1 }), true);
  });

  it("runs ten thousand warmed live-writer frames without rebuilding", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-12, 18));
    const site = runtime.sites[0]!;
    const movement = { x: 0, z: 0, floorY: 0, ceilingY: 0, surfaceId: null as string | null, flooded: false, blocked: false };
    const camera = { floorY: 0, ceilingY: 0, flooded: false, waterSurfaceY: Number.NaN };
    const aerial = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
    const encounter = { siteKey: null as string | null, spaceId: "", layer: "ground" as "ground" | "surface" | "water-column" | "seabed" | "air", minY: 0, maxY: 0 };
    const discovery = { siteKey: null as string | null };
    const before = wildsSiteRuntimeDiagnostics();
    for (let frame = 0; frame < 10_000; frame += 1) {
      assert.equal(writeWildsSiteRuntimeMovement(movement, runtime, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z, site.entrance.x, site.entrance.z, .38), movement);
      assert.equal(writeWildsSiteRuntimeCamera(camera, runtime, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z), camera);
      assert.equal(writeWildsSiteRuntimeAerialCollision(aerial, runtime, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z, 1.55, .38), aerial);
      assert.equal(writeWildsSiteRuntimeEncounter(encounter, runtime, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z), encounter);
      assert.equal(writeWildsSiteRuntimeDiscovery(discovery, runtime, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z), discovery);
    }
    const after = wildsSiteRuntimeDiagnostics();
    assert.equal(after.runtimeBuilds, before.runtimeBuilds);
    assert.equal(after.indexBuilds, before.indexBuilds);
    assert.equal(after.authorityBuilds, before.authorityBuilds);
  });

  it("wires one prepared runtime through every production consumer", async () => {
    const [campaign, canvas, environment, renderer] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"), readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/WildsEnvironment.tsx", "utf8"), readFile("src/features/play/WildsDiscoverySites.tsx", "utf8")
    ]);
    assert.match(campaign, /prepareWildsSiteRuntime/);
    assert.match(campaign, /writeWildsSiteRuntimeDiscovery/);
    assert.match(canvas, /writeWildsSiteRuntimeAerialCollision/);
    assert.match(canvas, /writeWildsSiteRuntimeCamera/);
    assert.match(canvas, /writeWildsSiteRuntimeEncounter/);
    assert.match(canvas, /wildsSiteRuntimeDiagnostics/);
    assert.match(environment, /<WildsDiscoverySites/);
    assert.match(renderer, /runtime\.physical/);
    assert.match(renderer, /projectWildsDiscoverySiteApproach/);
    assert.match(renderer, /<MountainSurface/);
    assert.match(canvas, /const activeFloorY = siteSpace\.position\.y/);
    assert.match(canvas, /terrainElevation=\{activeFloorY\}/);
    assert.match(canvas, /const siteWorldY = siteSpace\.position\.y/);
    assert.match(renderer, /key=\{site\.key\}/);
    assert.match(renderer, /waterfall\.flowPath/);
    assert.doesNotMatch(renderer, /siteSolids\.map/);
    assert.doesNotMatch(renderer, /water\.halfExtents\.y \* 2/);
    assert.match(renderer, /portalDistance = portal \? Math\.hypot\(portal\.position\.x - player\.x, portal\.position\.z - player\.z\)/);
    assert.match(renderer, /projectWildsSitePortalCue\(portalDistance\)/);
    assert.doesNotMatch(renderer, /admitWildsDiscoveryPhysicalNeighborhood/);
    assert.doesNotMatch(campaign, /wildsSiteRuntimeDiscoveredKeys/);
  });
});

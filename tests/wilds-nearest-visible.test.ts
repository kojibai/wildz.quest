import test from "node:test";
import assert from "node:assert/strict";
import { nearestWildsVisible } from "../src/features/play/wilds-nearest-visible";

test("nearby selection keeps the original closest candidate and stable equal-distance order", () => {
  const sites = Array.from({ length: 120 }, (_, index) => ({
    id: `site:${index}`,
    position: { x: (index % 12 - 6) * 7, z: (Math.floor(index / 12) - 5) * 7 },
    radius: index % 3 ? 8 : 16
  }));
  sites.unshift(
    { id: "first-tie", position: { x: -3, z: 0 }, radius: 8 },
    { id: "second-tie", position: { x: 3, z: 0 }, radius: 8 }
  );
  const positions = [{ x: 0, z: 0 }, ...Array.from({ length: 200 }, (_, index) => ({ x: index * .43 - 43, z: (index * 13 % 80) - 40 }))];
  for (const player of positions) {
    const expected = sites
      .map(site => ({ candidate: site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
      .filter(({ candidate, distance }) => distance <= candidate.radius + 8)
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
    assert.deepEqual(nearestWildsVisible(sites, player, site => site.radius + 8), expected);
  }
  assert.equal(nearestWildsVisible(sites.slice(0, 2), { x: 0, z: 0 }, site => site.radius)?.candidate.id, "first-tie");
  assert.equal(nearestWildsVisible(sites, { x: Number.NaN, z: 0 }, site => site.radius), null);
});

test("grove selection retains the id tie-break at equal distance", () => {
  const groves = [
    { groveId: "z", position: { x: -4, z: 0 } },
    { groveId: "a", position: { x: 4, z: 0 } },
    { groveId: "too-far", position: { x: 17, z: 0 } }
  ];
  const player = { x: 0, z: 0 };
  const expected = groves
    .map(grove => ({ candidate: grove, distance: Math.hypot(grove.position.x - player.x, grove.position.z - player.z) }))
    .filter(({ distance }) => distance <= 16)
    .sort((left, right) => left.distance - right.distance || left.candidate.groveId.localeCompare(right.candidate.groveId))[0];
  assert.deepEqual(nearestWildsVisible(groves, player, 16, (left, right) => left.groveId.localeCompare(right.groveId)), expected);
});

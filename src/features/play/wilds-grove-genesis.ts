import type { KaiKlokMoment } from "./kai-klok-moment";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { projectWildsRegenerativeGrove } from "./wilds-regenerative-grove";
import { projectWildsRegionalWeather } from "./wilds-regional-weather";
import { createWildsWorldEmissionGenesis, WILDS_REGION_EMISSION_CAPACITY_PHI_MICRO } from "./wilds-world-emission";

const REGION_RADIUS = 2;
export const WILDS_EMISSION_REGION_SIZE = 64;
const REGION_CAPACITY_PHI_MICRO = BigInt(WILDS_REGION_EMISSION_CAPACITY_PHI_MICRO);

function bareDigest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value)).replace(/^sha256:/, "");
}

export function projectWildsGroveGenesis(moment: KaiKlokMoment) {
  const groves = [];
  const regionCapacityPhiMicro: Record<string, string> = {};
  for (let x = -REGION_RADIUS; x <= REGION_RADIUS; x += 1) {
    for (let z = -REGION_RADIUS; z <= REGION_RADIUS; z += 1) {
      const regionId = `region:${x}:${z}`;
      const regionHead = bareDigest({ schema: "wildz.living-region-genesis.v1", regionId });
      const weather = projectWildsRegionalWeather({
        moment,
        region: { x, z },
        biome: "grove",
        elevation: 0.18,
        waterProximity: 0.42,
        ecologyHead: regionHead
      });
      groves.push(projectWildsRegenerativeGrove({
        regionId,
        regionHead,
        position: { x: x * WILDS_EMISSION_REGION_SIZE + WILDS_EMISSION_REGION_SIZE / 2, z: z * WILDS_EMISSION_REGION_SIZE + WILDS_EMISSION_REGION_SIZE / 2 },
        moment,
        weather
      }));
      regionCapacityPhiMicro[regionId] = REGION_CAPACITY_PHI_MICRO.toString();
    }
  }
  const globalCapacity = BigInt(groves.length) * REGION_CAPACITY_PHI_MICRO;
  const emission = createWildsWorldEmissionGenesis({
    epochId: `epoch:living-world:${moment.year}`,
    epochEndsAtKaiUPulse: moment.uPulse + 10_000_000_000,
    globalCapacityPhiMicro: globalCapacity.toString(),
    regionCapacityPhiMicro,
    classCapacityPhiMicro: {
      ecology: (globalCapacity * 7n / 10n).toString(),
      construction: (globalCapacity * 3n / 10n).toString()
    },
    policyDigest: bareDigest({
      schema: "wildz.world-emission-policy.v1",
      epoch: moment.year,
      rightRelation: true,
      boundedCapacityPhiMicro: globalCapacity.toString()
    })
  });
  return Object.freeze({ groves: Object.freeze(groves), emission });
}

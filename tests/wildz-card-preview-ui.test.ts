import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition.js";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy.js";
import { sealDiscoveredCard } from "../src/features/play/portable-card.js";
import { WildzCreatureDrawer } from "../src/features/play/WildzCreatureDrawer.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function card(formId: string, suffix: string) {
  const form = creatureForm(formId)!;
  const discoveredAt = `2026-07-28T20:0${suffix}:00.000Z`;
  return sealDiscoveredCard({
    identity: discoverLivingCreature({
      encounterId: `encounter:preview:${suffix}`,
      form,
      discoveredAt,
      location: { x: Number(suffix), z: -Number(suffix) },
      ownerScope: "preview_owner",
      moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" })
    }),
    formId,
    ownerReceizId: "preview_owner",
    capturedAt: discoveredAt
  });
}

test("creature selectors render living and dead entries as framed cards instead of avatar dots", () => {
  const living = card("mintcub-1", "1");
  const dead = card("voltray-1", "2");
  const deadCondition = {
    ...emptyAdventureCondition(dead.id),
    life: "dead" as const,
    retiredAt: "2026-07-28T21:00:00.000Z",
    retirementCauseEventId: "arena:death:preview",
    receiptDigests: ["sha256:preview-death"]
  };

  const html = renderToStaticMarkup(React.createElement(WildzCreatureDrawer, {
    nearbyCards: [living, dead],
    activeCard: living,
    companionProgress: {
      [living.manifest.familyId]: { level: 2, xp: 80, bond: 12 },
      [dead.manifest.familyId]: { level: 1, xp: 20, bond: 4 }
    },
    cardConditions: {
      [living.id]: emptyAdventureCondition(living.id),
      [dead.id]: deadCondition
    },
    cardOrder: "rarity",
    onCardOrderChange: () => {},
    onSelectCard: () => {}
  }));

  assert.equal((html.match(/class="wilds-card-preview [^"]*" data-life=/g) ?? []).length, 2);
  assert.match(html, /wilds-card-preview[^"]*" data-life="alive"/);
  assert.match(html, /wilds-card-preview[^"]*is-dead[^"]*" data-life="dead"/);
  assert.match(html, />STAGE 1</);
  assert.match(html, />Memorial</);
  assert.match(html, />Deceased</);
});

import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition.js";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy.js";
import { sealDiscoveredCard } from "../src/features/play/portable-card.js";
import { WildsCardPreview } from "../src/features/play/WildsCardPreview.js";

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

test("creature selectors reuse the complete living and dead collectible card face", () => {
  const living = card("mintcub-1", "1");
  const dead = card("voltray-1", "2");
  const deadCondition = {
    ...emptyAdventureCondition(dead.id),
    life: "dead" as const,
    retiredAt: "2026-07-28T21:00:00.000Z",
    retirementCauseEventId: "arena:death:preview",
    receiptDigests: ["sha256:preview-death"]
  };

  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(WildsCardPreview, {
      asset: living,
      condition: emptyAdventureCondition(living.id)
    }),
    React.createElement(WildsCardPreview, {
      asset: dead,
      condition: deadCondition
    })
  ));

  assert.equal((html.match(/class="wilds-collectible-card/g) ?? []).length, 2);
  for (const stat of ["Health", "Power", "Guard", "Speed", "Bond"]) {
    assert.equal((html.match(new RegExp(`<dt>${stat}</dt>`, "g")) ?? []).length, 2);
  }
  assert.equal((html.match(/class="wilds-card-abilities"/g) ?? []).length, 2);
  assert.match(html, />Grove Pulse</);
  assert.match(html, />STAGE 1</);
  assert.match(html, />Memorial</);
  assert.match(html, />Deceased</);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderWildsCardSvg } from "../src/features/play/card-export.js";
import { projectLivingCardStory } from "../src/features/play/living-card-dossier.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { canonicalPortableCardJson } from "../src/features/play/portable-card.js";
import { admitLegacyCard, appendLivingCardHistory, verifyLivingCard } from "../src/features/play/living-card-proof.js";

test("downloaded card front carries its deterministic living story", () => {
  const asset = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "story-owner",
    encounterId: "story-export",
    capturedAt: "2026-08-17T12:00:00.000Z"
  });
  const story = projectLivingCardStory(asset).excerpt;
  const svg = renderWildsCardSvg(asset);

  assert.match(svg, /data-card-story="right-half"/);
  assert.match(svg, />LIVING STORY</);
  assert.ok(svg.includes(story.split(" ").slice(0, 3).join(" ")));
});

test("saved front level and story evolve from exact earned history and survive reopening", () => {
  const born = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "story_keeper", encounterId: "lived-story", capturedAt: "2026-08-17T12:00:00.000Z" }), "2026-08-17T12:00:00.000Z");
  const before = canonicalPortableCardJson(born);
  const grown = appendLivingCardHistory({ asset: born, event: {
    eventId: "training:story:1", rulesetVersion: "wildz.progression.v1", occurredAt: "2026-08-17T12:01:00.000Z",
    source: { mode: "training", activityId: "training:story:1", actorId: "story_keeper", authority: "local" }, evidence: {},
    effects: [{ kind: "progress", xpDelta: 100, growthEvents: [] }]
  } });
  const story = projectLivingCardStory(grown);
  assert.notEqual(story.excerpt, projectLivingCardStory(born).excerpt);
  assert.match(story.excerpt, /level 2/);
  assert.match(story.full, /100 XP/);
  const svg = renderWildsCardSvg(grown);
  assert.match(svg, /LV\. 2/);
  assert.match(svg, /level 2/);
  const reopened = JSON.parse(canonicalPortableCardJson(grown));
  assert.equal(verifyLivingCard(reopened).ok, true);
  assert.deepEqual(projectLivingCardStory(reopened), story);
  assert.equal(renderWildsCardSvg(reopened), svg);
  assert.equal(canonicalPortableCardJson(born), before);
});

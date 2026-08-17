import assert from "node:assert/strict";
import { test } from "node:test";
import { renderWildsCardSvg } from "../src/features/play/card-export.js";
import { projectLivingCardStory } from "../src/features/play/living-card-dossier.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

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

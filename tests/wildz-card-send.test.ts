import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import {
  createWildsCardSendDraft,
  normalizeWildsCardSendTarget
} from "../src/features/play/card-export";

test("card send targets accept Receiz usernames and email addresses", () => {
  assert.deepEqual(normalizeWildsCardSendTarget("@Fern_Path"), {
    kind: "receiz-username",
    value: "fern_path",
    label: "@fern_path"
  });
  assert.deepEqual(normalizeWildsCardSendTarget("fern_path.receiz.id"), {
    kind: "receiz-username",
    value: "fern_path",
    label: "@fern_path"
  });
  assert.deepEqual(normalizeWildsCardSendTarget("collector@example.com"), {
    kind: "email",
    value: "collector@example.com",
    label: "collector@example.com"
  });
  assert.equal(normalizeWildsCardSendTarget("bad target"), null);
});

test("card send draft carries the standalone card URL and a mailto handoff for email", () => {
  const asset = initialPlayState.inventory[0]!;
  const draft = createWildsCardSendDraft(asset, "collector@example.com", "https://wildz.quest");

  assert.equal(draft.target.kind, "email");
  assert.equal(draft.filename, `${asset.manifest.formId}.receized.png`);
  assert.match(draft.url, /^https:\/\/wildz\.quest\/cards\/wilds%3A[a-f0-9]{24}$/);
  assert.match(draft.text, /verified Wildz card image/i);
  assert.match(draft.text, /Upload or open the attached image/);
  assert.match(draft.href, /^mailto:collector%40example\.com\?/);
  assert.match(decodeURIComponent(draft.href), new RegExp(asset.id));
});

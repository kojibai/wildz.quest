import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeferredProfileCardPreview } from "../src/features/profile/DeferredProfileCardPreview.js";

test("a 34-card profile initially renders two expensive previews and retains every card button", () => {
  let cardMounts = 0;
  function ExpensiveCard() {
    cardMounts++;
    return createElement("article", null, "Detailed card artwork and stats");
  }
  const markup = renderToStaticMarkup(createElement("section", null,
    Array.from({ length: 34 }, (_, index) => createElement("button", { key: index, type: "button", "aria-label": `Open Companion ${index} card` },
      <DeferredProfileCardPreview eager={index < 2}><ExpensiveCard /></DeferredProfileCardPreview>,
      createElement("strong", null, `Companion ${index}`)))));
  assert.equal(cardMounts, 2);
  assert.equal((markup.match(/data-profile-preview="deferred"/g) ?? []).length, 32);
  assert.equal((markup.match(/<button/g) ?? []).length, 34);
  assert.match(markup, /Open Companion 33 card/);
  assert.match(markup, /<strong>Companion 33<\/strong>/);
});

test("deferred preview does not execute a child render before becoming visible", () => {
  function MustNotMount(): never { throw new Error("Offscreen card details were mounted"); }
  assert.doesNotThrow(() => renderToStaticMarkup(<DeferredProfileCardPreview><MustNotMount /></DeferredProfileCardPreview>));
});

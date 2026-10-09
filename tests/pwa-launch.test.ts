import assert from "node:assert/strict";
import { test } from "node:test";

test("a normal installed launch preserves the running game and explicit links still navigate", async () => {
  const events = await import("../src/features/pwa/pwa-events") as typeof import("../src/features/pwa/pwa-events") & {
    pwaLaunchNavigationTarget?: (targetUrl: string, currentUrl: string) => string | null;
  };
  assert.equal(typeof events.pwaLaunchNavigationTarget, "function");
  const target = events.pwaLaunchNavigationTarget!;
  assert.equal(target("https://wildz.quest/", "https://wildz.quest/"), null);
  assert.equal(target("https://wildz.quest/", "https://wildz.quest/?wildzResume=pending#identity"), null);
  assert.equal(target("https://wildz.quest/?wildzResume=new", "https://wildz.quest/"), "https://wildz.quest/?wildzResume=new");
  assert.equal(target("https://wildz.quest/cards/card-1", "https://wildz.quest/"), "https://wildz.quest/cards/card-1");
  assert.equal(target("https://wildz.quest/", "https://wildz.quest/u/alice"), "https://wildz.quest/");
  assert.equal(target("https://other.example/", "https://wildz.quest/"), null);
  assert.equal(target("invalid URL", "https://wildz.quest/"), null);
});

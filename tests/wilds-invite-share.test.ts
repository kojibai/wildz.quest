import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shareWildzInvite } from "../src/features/play/wilds-invite-share.js";

const url = "https://wildz.quest/?wildsJoin=invite%3A0123456789abcdef#play";

describe("Wildz invite sharing", () => {
  it("opens native share with a valuable invitation and does not copy first", async () => {
    const shared: ShareData[] = [];
    let copies = 0;
    const result = await shareWildzInvite(url, {
      copy: async () => { copies += 1; },
      share: async (data) => { shared.push(data); }
    });

    assert.equal(result, "shared");
    assert.equal(copies, 0);
    assert.deepEqual(shared, [{
      title: "Join me in Wildz",
      text: "Explore the living Wildz with me.",
      url
    }]);
  });

  it("treats dismissing the native share sheet as a neutral cancellation", async () => {
    let copies = 0;
    const result = await shareWildzInvite(url, {
      copy: async () => { copies += 1; },
      share: async () => { throw new DOMException("cancelled", "AbortError"); }
    });

    assert.equal(result, "cancelled");
    assert.equal(copies, 0);
  });

  it("copies when native sharing is missing or fails", async () => {
    const copied: string[] = [];
    assert.equal(await shareWildzInvite(url, {
      copy: async (value) => { copied.push(value); }
    }), "copied");
    assert.equal(await shareWildzInvite(url, {
      copy: async (value) => { copied.push(value); },
      share: async () => { throw new Error("share_failed"); }
    }), "copied");
    assert.deepEqual(copied, [url, url]);
  });

  it("fails clearly when neither native share nor copy is available", async () => {
    await assert.rejects(
      shareWildzInvite(url, {}),
      /wilds_invite_share_unavailable/
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWildsPortableClaim } from "../src/features/play/wilds-portable-claim.js";
import { WildsPortableClaimPanel } from "../src/features/play/WildsPortableClaimPanel.js";

const digest = (character: string) => character.repeat(64);

function claim() {
  return createWildsPortableClaim({
    kind: "resource",
    title: "12 moonwood",
    source: { ownerReceizId: "kai", subjectId: "wildz:inventory:kai", head: digest("a"), proofObjectDigest: digest("b") },
    recipient: { handle: "nova" },
    issuedAtKai: 42,
    expiresAtKai: 542,
    carrier: { kind: "portable-execution", exactPlanDigest: digest("c"), transitionSet: { schema: "receiz.portable-execution-transition-set.v124", applicationId: "wildz", exactPlanDigest: digest("c"), expectedParticipantHeads: { "wildz:inventory:kai": digest("a") }, proposedParticipantHeads: { "wildz:inventory:kai": digest("d") }, members: [], authority: { transitionSetIsProofAuthority: false, committed: false, strongerTruth: "sealed-receiz-proof-object" } } }
  });
}

describe("native playable claim surface", () => {
  it("shows the carried value and one clear claim action without exposing proof URLs", () => {
    const html = renderToStaticMarkup(<WildsPortableClaimPanel claim={claim()} onClaim={() => undefined} status="ready" />);
    assert.match(html, /12 moonwood/);
    assert.match(html, /Claim into your Receiz ID/);
    assert.match(html, /Source proof verified at claim time/);
    assert.doesNotMatch(html, /wildz\.quest\/claim|#proof=/);
  });

  it("makes a committed claim visibly final", () => {
    const html = renderToStaticMarkup(<WildsPortableClaimPanel claim={claim()} onClaim={() => undefined} status="committed" />);
    assert.match(html, /Claim committed/);
    assert.doesNotMatch(html, />Claim into your Receiz ID</);
  });
});

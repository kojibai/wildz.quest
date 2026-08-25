import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWildsPortableClaim,
  createWildsCardPortableClaim,
  decodeWildsPortableClaim,
  encodeWildsPortableClaim,
  wildsPortableClaimUrl
} from "../src/features/play/wilds-portable-claim.js";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";

const digest = (character: string) => character.repeat(64);

function transitionClaim() {
  return createWildsPortableClaim({
    kind: "resource",
    title: "12 moonwood",
    source: {
      ownerReceizId: "receiz:sender",
      subjectId: "wildz:inventory:sender",
      head: digest("a"),
      proofObjectDigest: digest("b")
    },
    recipient: { handle: "nova" },
    issuedAtKai: 42,
    expiresAtKai: 542,
    carrier: {
      kind: "portable-execution",
      exactPlanDigest: digest("c"),
      transitionSet: {
        schema: "receiz.portable-execution-transition-set.v124",
        applicationId: "wildz",
        exactPlanDigest: digest("c"),
        expectedParticipantHeads: { "wildz:inventory:sender": digest("a") },
        proposedParticipantHeads: { "wildz:inventory:sender": digest("d") },
        members: [],
        authority: {
          transitionSetIsProofAuthority: false,
          committed: false,
          strongerTruth: "sealed-receiz-proof-object"
        }
      }
    }
  });
}

describe("universal playable proof claims", () => {
  it("makes a deterministic self-contained claim whose source remains authority", () => {
    const claim = transitionClaim();
    assert.match(claim.claimId, /^wildz-claim:[a-f0-9]{64}$/);
    assert.equal(claim.authority.claimIsProofAuthority, false);
    assert.equal(claim.authority.strongerTruth, "sealed-receiz-proof-object");
    assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(claim)), claim);
  });

  it("round-trips through the native browser codec even when a Buffer shim exists", () => {
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    try {
      const claim = transitionClaim();
      assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(claim)), claim);
    } finally {
      if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("rejects mutation of the carried claim instead of trusting URL metadata", () => {
    const claim = transitionClaim();
    const encoded = Buffer.from(JSON.stringify({ ...claim, title: "999 moonwood" }), "utf8").toString("base64url");
    assert.throws(() => decodeWildsPortableClaim(encoded), /wilds_portable_claim_digest_invalid/);
  });

  it("binds the recipient and exact transition-set digest", () => {
    const claim = transitionClaim();
    assert.throws(() => createWildsPortableClaim({
      ...claim,
      claimId: undefined,
      carrier: { ...claim.carrier, exactPlanDigest: digest("e") }
    } as never), /wilds_portable_claim_carrier_invalid/);
    assert.throws(() => createWildsPortableClaim({
      ...claim,
      claimId: undefined,
      recipient: { handle: "" }
    } as never), /wilds_portable_claim_recipient_invalid/);
  });

  it("creates a native same-origin claim URL without a discovery lookup", () => {
    const claim = transitionClaim();
    const url = new URL(wildsPortableClaimUrl("https://wildz.quest", claim));
    assert.equal(url.origin, "https://wildz.quest");
    assert.equal(url.pathname, "/claim");
    assert.deepEqual(decodeWildsPortableClaim(url.hash.slice("#proof=".length)), claim);
  });

  it("carries an exact one-use card instrument without replacing its custody authority", () => {
    const card = createOwnerBoundInitialPlayState("kai").inventory[0]!;
    const offer = {
      schema: "receiz.wilds.card-transfer-offer.v1" as const,
      card,
      subjectId: "wildz:creature:one",
      sourceHandle: "kai",
      targetHandle: "nova",
      instrument: {
        schema: "receiz.bearer.instrument.v1" as const,
        plan: {
          schema: "receiz.bearer.transfer_plan.v1" as const,
          transferId: digest("1"), transferDigest: digest("1"), subjectId: "wildz:creature:one",
          subjectDigest: digest("2"), expectedSubjectHead: digest("3"), expectedOwnershipHead: digest("4"),
          currentOwnerReceizId: "receiz:kai", policy: { recipientReceizId: null, openBearer: true, expiresAtKai: "542", requiresRecipientAcceptance: true, priorOwnerConversationPolicy: "encrypted-evidence" as const, inventoryDisposition: {} },
          policyDigest: digest("5"), registryDigest: digest("6"), reducerDigest: digest("7")
        },
        oneTimeClaimDigest: digest("8"), issuedAtKai: "42", exactBytesB64u: "ZXhhY3Q", artifactDigest: digest("9"), status: "pending-acceptance" as const
      }
    };
    const claim = createWildsPortableClaim({
      kind: "card",
      title: card.manifest.name,
      source: { ownerReceizId: "receiz:kai", subjectId: offer.subjectId, head: digest("3"), proofObjectDigest: digest("2") },
      recipient: { handle: "nova" },
      issuedAtKai: 42,
      expiresAtKai: 542,
      carrier: { kind: "bearer-card", offer }
    });
    assert.equal(claim.carrier.kind, "bearer-card");
    assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(claim)), claim);
    assert.equal(createWildsCardPortableClaim(offer).claimId, claim.claimId);
    assert.throws(() => createWildsPortableClaim({ ...claim, claimId: undefined, recipient: { handle: "sol" } } as never), /wilds_portable_claim_carrier_invalid/);
  });
});

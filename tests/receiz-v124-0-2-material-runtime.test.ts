import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECEIZ_SDK_VERSION,
  buildReceizMaterialCompositeTransport,
  encodeReceizMaterialCapsuleBytes,
  readReceizMaterialCompositePackageDigest
} from "@receiz/sdk";

describe("Receiz 124.0.3 material runtime", () => {
  it("carries exact material bytes beneath sealed proof-object authority", async () => {
    assert.equal(RECEIZ_SDK_VERSION, "124.0.3");
    const capsuleBytes = encodeReceizMaterialCapsuleBytes({
      exactArtifactBytes: new Uint8Array([1, 2, 3]),
      filename: "grove-seed.receiz",
      mimeType: "application/vnd.receiz.proof+json"
    });
    const carried = await buildReceizMaterialCompositeTransport({
      capsuleBytes,
      sealedArtifactSha256: "a".repeat(64),
      sealedArtifactByteLength: 3,
      sealedFilename: "grove-seed.receiz",
      sealedMimeType: "application/vnd.receiz.proof+json",
      verifyPath: "/v/wildz/grove-seed/proof",
      issuedAtKaiPulse: "1",
      issuedAtKaiUPulse: "1000000"
    });

    assert.equal(
      readReceizMaterialCompositePackageDigest(carried.token),
      carried.manifest.packageDigest
    );
    assert.equal(carried.manifest.authority.strongerTruth, "sealed-receiz-proof-object");
    assert.equal(carried.manifest.authority.transportIsProofAuthority, false);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReceizIdentityKeyFile, appendReceizIdentityPortableState,
  verifyReceizIdentityPortableStateProof, projectReceizIdentityAccount,
  segmentedReceizPortableStateRef, signReceizIdentityLoginProof,
  receizBase64UrlEncode, sha256ReceizBytes
} from "@receiz/sdk";
import { serializeReceizCompositeCanonical } from "@receiz/sdk";

test("segmented identity verification materializes the held snapshot once and still rejects invalid child signatures", async () => {
  const { keyFile: identity } = await createReceizIdentityKeyFile({ owner: { uid: "scaling-fixture", username: "scaling_fixture" } });
  const keyFile = await appendReceizIdentityPortableState({ keyFile: identity,
    snapshot: { retained: "x".repeat(2 * 1024 * 1024) } });
  const descriptor = Object.getOwnPropertyDescriptor(Uint8Array, "from");
  const from = Uint8Array.from;
  let largeDecodes = 0;
  Object.defineProperty(Uint8Array, "from", { configurable: true, writable: true, value: function (this: typeof Uint8Array, source: unknown, ...rest: unknown[]) {
    if (typeof source === "string" && source.length >= 512 * 1024) largeDecodes++;
    return Reflect.apply(from, this, [source, ...rest]);
  } });
  try {
    assert.equal(await verifyReceizIdentityPortableStateProof(keyFile), "verified");
  } finally {
    if (descriptor) Object.defineProperty(Uint8Array, "from", descriptor);
    else Reflect.deleteProperty(Uint8Array, "from");
  }
  const composite = keyFile.portableState!.segmented!;
  assert.ok(largeDecodes <= composite.segmentCount * 3, `decoded large segments ${largeDecodes} times for ${composite.segmentCount} carried segments`);
  assert.deepEqual((await projectReceizIdentityAccount(keyFile)).snapshot, keyFile.portableState!.snapshot);

  const tampered = structuredClone(keyFile);
  tampered.portableState!.proof!.digestSha256Hex = "0".repeat(64);
  assert.equal(await verifyReceizIdentityPortableStateProof(tampered), "invalid");

  // The parent is authentically signed by the disposable owner. Its invalid
  // child must still be rejected by independent segment signature admission.
  const invalidChild = structuredClone(composite);
  const first = invalidChild.segments[0]!;
  Object.assign(first, { signatureB64u: `${first.signatureB64u[0] === "A" ? "B" : "A"}${first.signatureB64u.slice(1)}` });
  const envelope = keyFile.portableState!;
  const canonical = serializeReceizCompositeCanonical({ schema: envelope.schema, exportedAt: envelope.exportedAt,
    snapshot: segmentedReceizPortableStateRef(invalidChild) });
  const signature = await signReceizIdentityLoginProof({ keyFile: identity, challengeB64Url: receizBase64UrlEncode(canonical) });
  const bad = structuredClone(keyFile);
  Object.assign(bad.portableState!, { segmented: invalidChild, proof: { ...envelope.proof!,
    digestSha256Hex: await sha256ReceizBytes(canonical), signatureB64u: signature.signatureB64Url } });
  assert.equal(await verifyReceizIdentityPortableStateProof(bad), "invalid");
});

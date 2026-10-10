import {
  parseReceizPortableAssetDocument, receizBase64UrlEncode, sha256ReceizBytes,
  type ReceizPortableAssetDocument, type ReceizPortableAssetInput,
} from "@receiz/sdk";

/** Prepare the documented current carrier for assets.createProofObject. This
 * prepares a document only; the SDK Record/Seal operation supplies its truth. */
export async function prepareWildsPortableDocumentV128(input: ReceizPortableAssetInput): Promise<ReceizPortableAssetDocument> {
  const bytes = input.payload.bytes.slice();
  return parseReceizPortableAssetDocument({
    schema: "receiz.portable_asset.v1", assetType: input.assetType,
    payload: { mimeType: input.payload.mimeType, bytesBase64Url: receizBase64UrlEncode(bytes), sha256: await sha256ReceizBytes(bytes) },
    ownership: structuredClone(input.ownership), provenance: structuredClone(input.provenance), settlement: structuredClone(input.settlement),
  });
}

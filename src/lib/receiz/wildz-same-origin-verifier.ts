import type { DocumentVerifyResponse } from "@receiz/sdk";

export type WildzVerifierFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function isDocumentVerifyResponse(value: unknown): value is DocumentVerifyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<DocumentVerifyResponse>;
  return typeof candidate.ok === "boolean"
    && typeof candidate.kind === "string"
    && Array.isArray(candidate.errors)
    && candidate.errors.every((error) => typeof error === "string")
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every((warning) => typeof warning === "string");
}

export async function verifyWildzArtifactSameOrigin(
  file: Blob,
  fetchImpl: WildzVerifierFetch = fetch
): Promise<DocumentVerifyResponse> {
  const form = new FormData();
  form.set("file", file, "wildz-vault.receized.png");
  const response = await fetchImpl("/api/document-verify", {
    method: "POST",
    body: form,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "x-wildz-proof-login": "vault" }
  });
  if (!response.ok) throw new Error(`receiz_document_verify_http_${response.status}`);
  const payload: unknown = await response.json();
  if (!isDocumentVerifyResponse(payload)) throw new Error("receiz_document_verify_response_invalid");
  return payload;
}

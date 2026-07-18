import type { DocumentVerifyResponse } from "@receiz/sdk";
import type { WildzAdmittedArtifact } from "./wildz-artifact-custody";

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

type WildzArtifactOpenResponse = Omit<WildzAdmittedArtifact, "artifactBytes" | "payloadBytes"> & {
  payloadBase64Url: string;
};

function isArtifactOpenResponse(value: unknown): value is WildzArtifactOpenResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WildzArtifactOpenResponse>;
  return typeof candidate.artifactSha256 === "string"
    && typeof candidate.payloadSha256 === "string"
    && typeof candidate.payloadBase64Url === "string"
    && typeof candidate.filename === "string"
    && typeof candidate.mimeType === "string"
    && typeof candidate.ownerReceizId === "string"
    && typeof candidate.claimId === "string"
    && typeof candidate.verifyPath === "string"
    && (candidate.recordId === null || typeof candidate.recordId === "string")
    && (candidate.compatibility === "current-native" || candidate.compatibility === "verified-legacy-read");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function openWildzArtifactSameOrigin(
  input: { bytes: Uint8Array; mimeType: string; name?: string },
  fetchImpl: WildzVerifierFetch = fetch
): Promise<WildzAdmittedArtifact> {
  const form = new FormData();
  form.set("file", new Blob([input.bytes.slice().buffer], { type: input.mimeType }), input.name ?? "wildz.receized");
  const response = await fetchImpl("/api/document-verify", {
    method: "POST",
    body: form,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "x-wildz-artifact-open": "v108" }
  });
  if (!response.ok) throw new Error(`receiz_artifact_open_http_${response.status}`);
  const payload: unknown = await response.json();
  if (!isArtifactOpenResponse(payload)) throw new Error("receiz_artifact_open_response_invalid");
  const { payloadBase64Url, ...coordinates } = payload;
  return {
    ...coordinates,
    artifactBytes: input.bytes.slice(),
    payloadBytes: decodeBase64Url(payloadBase64Url)
  };
}

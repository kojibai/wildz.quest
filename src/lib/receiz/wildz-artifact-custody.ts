import type {
  ReceizClient,
  ReceizOpenedArtifact,
  ReceizSealedArtifact
} from "@receiz/sdk";

export type WildzArtifactPort = Pick<ReceizClient["artifacts"], "verifyAndOpen" | "download">;

export type WildzAdmittedArtifact = Readonly<{
  artifactBytes: Uint8Array;
  artifactSha256: string;
  payloadBytes: Uint8Array;
  payloadSha256: string;
  filename: string;
  mimeType: string;
  ownerReceizId: string;
  claimId: string;
  verifyPath: string;
  recordId: string | null;
  compatibility: "current-native" | "verified-legacy-read";
}>;

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

export async function sha256WildzArtifactBytes(bytes: Uint8Array) {
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", strictArrayBuffer(bytes)));
  return Array.from(result, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nonEmpty(value: string) {
  return value.trim().length > 0;
}

function requireOpenedArtifact(opened: ReceizOpenedArtifact) {
  const sealed = opened.sealedArtifact;
  if (opened.verification.ok !== true
    || sealed.verification.ok !== true
    || sealed.verification.integrity.ok !== true
    || sealed.verification.errors.length > 0
    || sealed.continuity.signatureVersion !== 4
    || !nonEmpty(sealed.continuity.ownerReceizId)
    || !nonEmpty(sealed.continuity.claimId)
    || !sealed.continuity.verifyPath.startsWith("/v/")
    || !/^[a-f0-9]{64}$/.test(sealed.artifactSha256)
    || !/^[a-f0-9]{64}$/.test(sealed.payloadSha256)
    || opened.verifiedPayload.sha256 !== sealed.payloadSha256) {
    throw new Error("wildz_artifact_verification_failed");
  }
}

export async function openWildzArtifact(
  file: Blob,
  filename: string,
  port: WildzArtifactPort
): Promise<WildzAdmittedArtifact> {
  return (await openWildzArtifactEvidence(file, filename, port)).admitted;
}

export async function openWildzArtifactEvidence(
  file: Blob,
  filename: string,
  port: Pick<WildzArtifactPort, "verifyAndOpen">
): Promise<{ admitted: WildzAdmittedArtifact; sealedArtifact: ReceizOpenedArtifact["sealedArtifact"] }> {
  let opened: ReceizOpenedArtifact;
  try {
    opened = await port.verifyAndOpen(file);
  } catch {
    throw new Error("wildz_artifact_verification_failed");
  }
  requireOpenedArtifact(opened);
  const artifactBytes = new Uint8Array(await file.arrayBuffer());
  const artifactSha256 = await sha256WildzArtifactBytes(artifactBytes);
  if (artifactSha256 !== opened.sealedArtifact.artifactSha256) {
    throw new Error("wildz_artifact_digest_mismatch");
  }
  const continuity = opened.sealedArtifact.continuity;
  const admitted: WildzAdmittedArtifact = {
    artifactBytes: artifactBytes.slice(),
    artifactSha256,
    payloadBytes: opened.verifiedPayload.bytes.slice(),
    payloadSha256: opened.verifiedPayload.sha256,
    filename: opened.sealedArtifact.filename || filename,
    mimeType: opened.sealedArtifact.mimeType,
    ownerReceizId: continuity.ownerReceizId,
    claimId: continuity.claimId,
    verifyPath: continuity.verifyPath,
    recordId: continuity.carrier === "native-record-seal" ? continuity.recordId : null,
    compatibility: opened.legacyCompatibility
  };
  return { admitted, sealedArtifact: opened.sealedArtifact };
}

export async function downloadAndReopenWildzArtifact(
  artifact: ReceizSealedArtifact,
  port: WildzArtifactPort
): Promise<WildzAdmittedArtifact> {
  let evidence;
  try {
    evidence = await port.download(artifact);
  } catch {
    throw new Error("wildz_artifact_download_failed");
  }
  const artifactBytes = new Uint8Array(await artifact.artifact.arrayBuffer());
  const artifactSha256 = await sha256WildzArtifactBytes(artifactBytes);
  if (!evidence.ok
    || evidence.size !== artifactBytes.byteLength
    || evidence.artifactSha256 !== artifact.artifactSha256
    || artifactSha256 !== artifact.artifactSha256) {
    throw new Error("wildz_artifact_download_digest_mismatch");
  }
  const admitted = await openWildzArtifact(
    new Blob([strictArrayBuffer(artifactBytes)], { type: artifact.mimeType }),
    artifact.filename,
    port
  );
  if (admitted.compatibility !== "current-native"
    || admitted.artifactSha256 !== artifact.artifactSha256
    || admitted.payloadSha256 !== artifact.payloadSha256) {
    throw new Error("wildz_artifact_round_trip_failed");
  }
  return admitted;
}

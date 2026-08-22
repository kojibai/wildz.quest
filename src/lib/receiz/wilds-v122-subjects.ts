import {
  RECEIZ_V122_REGISTRY_DIGEST,
  deriveReceizSubjectIdV122,
  snapshotReceizArtifactInput,
  validateReceizSubjectAdmissionResultV122,
  type ReceizSubjectStateV122
} from "@receiz/sdk";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import type { ReceizCommerceAdapter } from "./adapter";

type SubjectPort = Pick<ReceizCommerceAdapter, "admitSubjectV122" | "subjectStateV122">;

function isMissingSubject(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  return status === 404 || /(?:^|\b)(?:404|not_found|subject_not_found)(?:\b|$)/i.test(message);
}

export async function projectWildsCreatureSubjectAdmissionV122(card: PortableCardAsset, ownerReceizId: string) {
  const exactBytes = new TextEncoder().encode(canonicalPortableCardJson(card));
  const proofObject = new Blob([exactBytes], { type: "application/json" });
  const snapshot = await snapshotReceizArtifactInput(proofObject);
  const subjectId = await deriveReceizSubjectIdV122(snapshot.artifactDigest.value);
  return Object.freeze({
    subjectId,
    admittedProofDigest: snapshot.artifactDigest.value,
    input: Object.freeze({
      proofObject,
      ownerReceizId,
      idempotencyKey: `wildz:creature-subject:v122:${subjectId}`,
      expectedAbsent: true as const
    })
  });
}

function assertBoundState(
  state: ReceizSubjectStateV122,
  expected: Readonly<{ subjectId: string; admittedProofDigest: string; ownerReceizId: string }>
) {
  if (state.schema !== "receiz.subject.state.v122"
    || state.subjectId !== expected.subjectId
    || state.admittedProofDigest !== expected.admittedProofDigest
    || state.ownerReceizId !== expected.ownerReceizId
    || state.registryDigest !== RECEIZ_V122_REGISTRY_DIGEST) {
    throw new Error("receiz_v122_subject_binding_invalid");
  }
  return state;
}

export async function admitWildsCreatureSubjectV122(input: Readonly<{
  card: PortableCardAsset;
  ownerReceizId: string;
  rail: SubjectPort;
}>) {
  const projected = await projectWildsCreatureSubjectAdmissionV122(input.card, input.ownerReceizId);
  try {
    return assertBoundState(await input.rail.subjectStateV122(projected.subjectId), {
      ...projected,
      ownerReceizId: input.ownerReceizId
    });
  } catch (cause) {
    if (!isMissingSubject(cause)) throw cause;
  }
  const result = await validateReceizSubjectAdmissionResultV122(await input.rail.admitSubjectV122(projected.input));
  if (!result.ok) throw new Error(`receiz_v122_subject_admission_${result.code.toLowerCase()}`);
  if (result.subjectId !== projected.subjectId || result.proofDigest !== projected.admittedProofDigest) {
    throw new Error("receiz_v122_subject_admission_binding_invalid");
  }
  return assertBoundState(await input.rail.subjectStateV122(projected.subjectId), {
    ...projected,
    ownerReceizId: input.ownerReceizId
  });
}

import type { AdventureCardCondition } from "../adventure/card-condition";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { MarketCardCapability } from "./card-role";
import {
  projectMarketConsequences,
  type MarketConsequenceSet,
  type MarketMortalConsent,
} from "./consequences";
import type { MarketContractDefinition } from "./contract-director";
import type { MarketTerms } from "./negotiation-resolver";
import { replayMarketTranscript, type MarketTranscript } from "./transcript";

export type MarketReceipt = Readonly<{
  schema: "receiz.wilds.market_receipt.v1";
  contract: MarketContractDefinition;
  terms: MarketTerms;
  transcript: MarketTranscript;
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  mortalConsent: MarketMortalConsent | null;
  consequences: MarketConsequenceSet;
  actorId: string;
  publicationRevision: number;
  createdAt: string;
  digest: string;
}>;

export type SealMarketReceiptInput = Readonly<{
  contract: MarketContractDefinition;
  terms: MarketTerms;
  transcript: MarketTranscript;
  squad: readonly MarketCardCapability[];
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  mortalConsent: MarketMortalConsent | null;
  actorId: string;
  publicationRevision: number;
  createdAt: string;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function unsignedReceipt(receipt: MarketReceipt) {
  const { digest: _digest, ...unsigned } = receipt;
  return unsigned;
}

export function sealMarketReceipt(input: SealMarketReceiptInput): MarketReceipt {
  if (!input.actorId.trim()) throw new Error("market_receipt_actor_invalid");
  if (!Number.isSafeInteger(input.publicationRevision) || input.publicationRevision < 1) throw new Error("market_receipt_revision_invalid");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("market_receipt_time_invalid");
  const replay = replayMarketTranscript(input.contract, input.terms, input.squad, input.transcript);
  const consequences = projectMarketConsequences({
    contract: input.contract,
    terms: input.terms,
    replay,
    priorConditions: input.priorConditions,
    mortalConsent: input.mortalConsent,
  });
  const unsigned = {
    schema: "receiz.wilds.market_receipt.v1" as const,
    contract: input.contract,
    terms: input.terms,
    transcript: input.transcript,
    priorConditions: input.priorConditions,
    mortalConsent: input.mortalConsent,
    consequences,
    actorId: input.actorId,
    publicationRevision: input.publicationRevision,
    createdAt: input.createdAt,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function verifyMarketReceipt(receipt: MarketReceipt, squad: readonly MarketCardCapability[]) {
  const errors: string[] = [];
  try {
    if (receipt.schema !== "receiz.wilds.market_receipt.v1") throw new Error("schema");
    if (!receipt.actorId.trim()) throw new Error("actor");
    if (!Number.isSafeInteger(receipt.publicationRevision) || receipt.publicationRevision < 1) throw new Error("revision");
    if (!Number.isFinite(Date.parse(receipt.createdAt))) throw new Error("time");
    if (digest(unsignedReceipt(receipt)) !== receipt.digest) throw new Error("digest");
    const replay = replayMarketTranscript(receipt.contract, receipt.terms, squad, receipt.transcript);
    const expected = projectMarketConsequences({
      contract: receipt.contract,
      terms: receipt.terms,
      replay,
      priorConditions: receipt.priorConditions,
      mortalConsent: receipt.mortalConsent,
    });
    if (canonicalPortableCardJson(expected) !== canonicalPortableCardJson(receipt.consequences)) throw new Error("consequences");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "market_receipt_invalid");
  }
  return { ok: errors.length === 0, errors };
}

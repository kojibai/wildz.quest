import { canonicalPortableCardJson, sha256PortableBasis } from '../../features/play/portable-card';
import type { ReceizPortableSealedArtifactV124 } from '@receiz/sdk';
import type { WildzMarketSourceArchiveReferenceV128, WildzMarketSourceProofV128 } from './wildz-market-source-types-v128';

export const WILDZ_MARKET_SOURCE_PAGE_BYTES_V128 = 192 * 1024;
export const WILDZ_MARKET_SOURCE_PAGE_COUNT_V128 = 32;
export type WildzMarketSourceArchivePageV128 = Readonly<{
 schema: 'wildz.market-source-page.v128';
 predecessorPage: WildzMarketSourceArchiveReferenceV128 | null;
 sourceArtifacts: readonly ReceizPortableSealedArtifactV124[];
}>;
const bytes = (value: unknown) => new TextEncoder().encode(canonicalPortableCardJson(value));
function fail(reason: string): never { throw Error(`wildz_market_source_${reason}`); }
function assertReference(value: WildzMarketSourceArchiveReferenceV128) {
 if (!value || Object.keys(value).sort().join() !== 'count,digest' || !/^[a-f0-9]{64}$/.test(value.digest)
  || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > WILDZ_MARKET_SOURCE_PAGE_COUNT_V128) fail('archive_reference_invalid');
}
function assertPage(page: WildzMarketSourceArchivePageV128) {
 if (!page || page.schema !== 'wildz.market-source-page.v128' || Object.keys(page).sort().join() !== 'predecessorPage,schema,sourceArtifacts'
  || !Array.isArray(page.sourceArtifacts) || !page.sourceArtifacts.length || page.sourceArtifacts.length > WILDZ_MARKET_SOURCE_PAGE_COUNT_V128
  || bytes(page).length > WILDZ_MARKET_SOURCE_PAGE_BYTES_V128 || page.sourceArtifacts.some(source => !source || source.schema !== 'receiz.sealed-artifact-bytes.v124'
   || typeof source.exactBytesB64u !== 'string' || !/^[a-f0-9]{64}$/.test(source.artifactSha256) || !/^[a-f0-9]{64}$/.test(source.payloadSha256))) fail('archive_page_invalid');
 if (page.predecessorPage !== null) assertReference(page.predecessorPage);
}
/** Only a byte locator. Every Original and predecessor still undergo native
 * root admission and full law replay; the page grants no source authority. */
export function createWildzMarketSourceArchivePageV128(sourceArtifacts: readonly ReceizPortableSealedArtifactV124[], predecessorPage: WildzMarketSourceArchiveReferenceV128 | null = null): WildzMarketSourceArchivePageV128 {
 const page: WildzMarketSourceArchivePageV128 = { schema: 'wildz.market-source-page.v128', predecessorPage, sourceArtifacts: [...sourceArtifacts] };
 assertPage(page); return page;
}
export function describeWildzMarketSourceArchivePageV128(page: WildzMarketSourceArchivePageV128): WildzMarketSourceArchiveReferenceV128 {
 assertPage(page); return { digest: sha256PortableBasis(canonicalPortableCardJson(page)).slice(7), count: page.sourceArtifacts.length };
}
export function readWildzMarketSourceArchivePageV128(value: unknown, reference: WildzMarketSourceArchiveReferenceV128) {
 const page = value as WildzMarketSourceArchivePageV128; assertPage(page); assertReference(reference);
 if (reference.count !== page.sourceArtifacts.length) fail('archive_count');
 if (reference.digest !== describeWildzMarketSourceArchivePageV128(page).digest) fail('archive_digest');
 return page.sourceArtifacts;
}
/** Read before CAS too. Oversized Originals cannot enter a source chain whose
 * exact predecessor history could no longer be publicly located afterwards. */
export function assertWildzMarketSourceArchiveCapacityV128(sourceArtifacts: readonly ReceizPortableSealedArtifactV124[]) {
 for (const source of sourceArtifacts) {
  if (bytes({ schema: 'wildz.market-source-page.v128', predecessorPage: { digest: 'f'.repeat(64), count: 32 }, sourceArtifacts: [source] }).length > WILDZ_MARKET_SOURCE_PAGE_BYTES_V128) fail('archive_original_too_large');
  createWildzMarketSourceArchivePageV128([source]);
 }
}
export async function compactWildzMarketSourceProofV128(proof: WildzMarketSourceProofV128, publishPage: (page: WildzMarketSourceArchivePageV128, reference: WildzMarketSourceArchiveReferenceV128) => Promise<void>): Promise<WildzMarketSourceProofV128> {
 if (!Array.isArray(proof.archivePages) || proof.archivePages.length > 1) fail('archive_reference_invalid');
 let predecessorPage = proof.archivePages[0] ?? null;
 if (predecessorPage) assertReference(predecessorPage);
 const sourceArtifacts = [...proof.sourceArtifacts];
 assertWildzMarketSourceArchiveCapacityV128(sourceArtifacts);
 while (sourceArtifacts.length > WILDZ_MARKET_SOURCE_PAGE_COUNT_V128 || bytes({ schema: 'wildz.market-source-page.v128', predecessorPage, sourceArtifacts }).length > WILDZ_MARKET_SOURCE_PAGE_BYTES_V128) {
  let count = Math.min(WILDZ_MARKET_SOURCE_PAGE_COUNT_V128, sourceArtifacts.length - 1);
  while (count > 0 && bytes({ schema: 'wildz.market-source-page.v128', predecessorPage, sourceArtifacts: sourceArtifacts.slice(0, count) }).length > WILDZ_MARKET_SOURCE_PAGE_BYTES_V128) count--;
  if (count < 1) fail('archive_original_too_large');
  const page = createWildzMarketSourceArchivePageV128(sourceArtifacts.slice(0, count), predecessorPage), reference = describeWildzMarketSourceArchivePageV128(page);
  await publishPage(page, reference); predecessorPage = reference; sourceArtifacts.splice(0, count);
 }
 createWildzMarketSourceArchivePageV128(sourceArtifacts, predecessorPage);
 return { ...proof, archivePages: predecessorPage ? [predecessorPage] : [], sourceArtifacts };
}
export async function* iterateWildzMarketSourceOriginalsV128(proof: WildzMarketSourceProofV128, readPage: (reference: WildzMarketSourceArchiveReferenceV128) => Promise<unknown>) {
 if (!Array.isArray(proof.archivePages) || proof.archivePages.length > 1 || !Array.isArray(proof.sourceArtifacts) || !proof.sourceArtifacts.length) fail('source_proof_invalid');
 // Retain only bounded digest references while locating the backwards chain.
 // Re-read each immutable content-addressed page in forward causal order.
 const ordered: WildzMarketSourceArchiveReferenceV128[] = [], seen = new Set<string>();
 let reference = proof.archivePages[0] ?? null;
 while (reference) {
  assertReference(reference); if (seen.has(reference.digest)) fail('archive_reference_invalid'); seen.add(reference.digest);
  const page = await readPage(reference) as WildzMarketSourceArchivePageV128;
  readWildzMarketSourceArchivePageV128(page, reference); ordered.push(reference); reference = page.predecessorPage;
 }
 for (const locator of ordered.reverse()) {
  const page = await readPage(locator) as WildzMarketSourceArchivePageV128;
  for (const source of readWildzMarketSourceArchivePageV128(page, locator)) yield source;
 }
 for (const source of createWildzMarketSourceArchivePageV128(proof.sourceArtifacts).sourceArtifacts) yield source;
}

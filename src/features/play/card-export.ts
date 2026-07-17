import { creatureForm } from "./creature-catalog";
import QRCode from "qrcode";
import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { receizBase64UrlDecode } from "@receiz/sdk";
import {
  extractLegacyReceizPortableAssetDocument,
  type LegacyReceizPortableAssetDocument
} from "../../lib/receiz/legacy-receiz-portable-asset";
import {
  attemptPublicWildsCardRegistration,
  canonicalPublicCardPath
} from "./public-card-registry";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "./portable-card";
import { verifyWildsPlayerVault, type WildsPlayerVaultPayload } from "./wilds-player-vault";

export type PortableCardPngProof = {
  schema: "receiz.wilds_png_proof.v1" | "receiz.wilds_png_proof.v2";
  imageDigest: string;
  asset: PortableCardAsset;
};

export type PortableVaultPngProof = {
  schema: "receiz.wilds_vault_png_proof.v1" | "receiz.wilds_vault_png_proof.v2" | "receiz.wilds_vault_png_proof.v3";
  imageDigest: string;
  vaultDigest: string;
  assets: PortableCardAsset[];
  player?: WildsPlayerVaultPayload;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PROOF_CHUNK_TYPE = "rzCd";
const VAULT_CHUNK_TYPE = "rzVt";
const PROOF_OBJECT_CHUNK_TYPE = "rzPo";

function xml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function statRow(label: string, value: number, x: number, color: string) {
  return `<g transform="translate(${x} 0)"><rect width="116" height="70" rx="18" fill="#071c26" fill-opacity=".88" stroke="${xml(color)}" stroke-opacity=".55"/><text x="58" y="26" text-anchor="middle" fill="#8da9b3" font-family="system-ui,sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">${label}</text><text x="58" y="55" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="27" font-weight="850">${value}</text></g>`;
}

function premiumQrSvg(value: string, x: number, y: number, accent: string) {
  const size = 66;
  const qr = QRCode.create(value, { errorCorrectionLevel: "L" });
  const modules = qr.modules.size;
  const quiet = 4;
  const cell = size / (modules + quiet * 2);
  const path: string[] = [];
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.modules.get(row, col)) path.push(`M${(x + (col + quiet) * cell).toFixed(3)} ${(y + (row + quiet) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`);
    }
  }
  return `<g id="card-qr" aria-label="QR link to standalone card page" data-premium-qr="true" data-module-grid="crisp-vector" data-qr-size="${size}"><rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" rx="9" fill="#031018" stroke="${xml(accent)}" stroke-opacity=".58"/><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="#fff"/><path d="${path.join("")}" fill="#07141c" shape-rendering="crispEdges"/><circle cx="${x + size - 3}" cy="${y + 3}" r="2" fill="${xml(accent)}"/></g>`;
}

export function standaloneCardUrl(assetId: string, origin: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("wilds_card_origin_invalid");
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) throw new Error("wilds_card_id_invalid");
  return new URL(canonicalPublicCardPath(assetId), base.origin).toString();
}

export function renderWildsCardSvg(asset: PortableCardAsset, options: { origin?: string } = {}) {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_card_form_unknown");
  const stats = asset.manifest.stats;
  const palette = asset.manifest.variant.traits.palette;
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant: asset.manifest.variant.traits });
  const heartboundArt = renderHeartboundSvg(genome, "card", { width: 640, height: 405, title: asset.manifest.name });
  const foilOpacity = form.foil === "standard" ? 0.08 : form.foil === "shimmer" ? 0.2 : 0.32;
  const statRows = [
    statRow("HEALTH", stats.health, 0, palette.primary),
    statRow("POWER", stats.power, 126, palette.accent),
    statRow("GUARD", stats.guard, 252, palette.primary),
    statRow("SPEED", stats.speed, 378, palette.accent),
    statRow("BOND", stats.bond, 504, palette.primary)
  ].join("");
  const abilityOne = form.abilities[0];
  const abilityTwo = form.abilities[1];
  const cardPath = standaloneCardUrl(asset.id, options.origin ?? "https://receiz.com");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050" role="img" aria-labelledby="title description">
  <title id="title">${xml(asset.manifest.name)} Wilds card</title><desc id="description">Stage ${asset.manifest.stage} ${xml(asset.manifest.rarity)} portable Receiz card</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#06151e"/><stop offset=".5" stop-color="#103345"/><stop offset="1" stop-color="#07141c"/></linearGradient>
    <linearGradient id="foil" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#ff5ead"/><stop offset=".22" stop-color="#ffd75e"/><stop offset=".45" stop-color="#70ffcc"/><stop offset=".7" stop-color="#71a9ff"/><stop offset="1" stop-color="#c772ff"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="18"/></filter>
    <clipPath id="art"><rect x="55" y="164" width="640" height="405" rx="35"/></clipPath>
  </defs>
  <rect x="12" y="12" width="726" height="1026" rx="50" fill="url(#bg)" stroke="${xml(palette.accent)}" stroke-width="18"/>
  <rect x="35" y="35" width="680" height="980" rx="34" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
  <path d="M55 132h640" stroke="${xml(palette.primary)}" stroke-width="4"/>
  <text x="58" y="94" fill="#fff" font-family="system-ui,sans-serif" font-size="42" font-weight="900">${xml(asset.manifest.name)}</text>
  <text x="692" y="75" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="18" font-weight="800">STAGE ${asset.manifest.stage}</text>
  <text x="692" y="104" text-anchor="end" fill="#b9d1da" font-family="system-ui,sans-serif" font-size="16" font-weight="700">${xml(asset.manifest.cardNumber)}</text>
  <g clip-path="url(#art)"><rect x="55" y="164" width="640" height="405" fill="#0d2632"/><circle cx="358" cy="330" r="230" fill="${xml(palette.glow)}" opacity=".2" filter="url(#glow)"/><g transform="translate(55 164)">${heartboundArt}</g><rect x="55" y="164" width="640" height="405" fill="url(#foil)" opacity="${foilOpacity}"/></g>
  <rect x="55" y="164" width="640" height="405" rx="35" fill="none" stroke="${xml(palette.accent)}" stroke-width="5"/>
  <text x="70" y="604" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="17" font-weight="850" letter-spacing="2">${xml(asset.manifest.rarity.toUpperCase())} · ${xml(asset.manifest.foil.toUpperCase())}</text>
  <text x="680" y="604" text-anchor="end" fill="#b9d1da" font-family="system-ui,sans-serif" font-size="17" font-weight="700">${xml(form.species)}</text>
  <g transform="translate(65 630)">${statRows}</g>
  <g transform="translate(65 727)"><rect width="620" height="88" rx="22" fill="#0a202b" stroke="${xml(palette.primary)}" stroke-opacity=".52"/><text x="24" y="32" fill="#fff" font-family="system-ui,sans-serif" font-size="23" font-weight="850">${xml(abilityOne.name)}</text><text x="590" y="32" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="23" font-weight="900">${abilityOne.power}</text><text x="24" y="63" fill="#a9c2cb" font-family="system-ui,sans-serif" font-size="16">${xml(abilityOne.text)}</text></g>
  <g transform="translate(65 829)"><rect width="620" height="88" rx="22" fill="#0a202b" stroke="${xml(palette.accent)}" stroke-opacity=".52"/><text x="24" y="32" fill="#fff" font-family="system-ui,sans-serif" font-size="23" font-weight="850">${xml(abilityTwo.name)}</text><text x="590" y="32" text-anchor="end" fill="${xml(palette.primary)}" font-family="system-ui,sans-serif" font-size="23" font-weight="900">${abilityTwo.power}</text><text x="24" y="63" fill="#a9c2cb" font-family="system-ui,sans-serif" font-size="16">${xml(abilityTwo.text)}</text></g>
  <text x="65" y="960" fill="#7896a1" font-family="ui-monospace,monospace" font-size="12">${xml(asset.proof.digest)}</text>${premiumQrSvg(cardPath, 621, 927, palette.accent)}
  <text x="65" y="990" fill="#fff" font-family="system-ui,sans-serif" font-size="15" font-weight="750">RECEIZ WILDS · PORTABLE PROOF CARD</text><text x="600" y="990" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="15" font-weight="850">${xml(asset.status.replace("_", " ").toUpperCase())}</text>
</svg>`;
}

export function renderWildsVaultSvg(assets: PortableCardAsset[]) {
  const verified = assets.filter((asset) => verifyAnyWildsCard(asset).ok);
  if (!verified.length || verified.length !== assets.length) throw new Error("wilds_vault_cards_invalid");
  const featured = verified.slice(0, 12);
  const tiles = featured.map((asset, index) => {
    const palette = asset.manifest.variant.traits.palette;
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 62 + col * 270;
    const y = 246 + row * 190;
    return `<g transform="translate(${x} ${y})"><rect width="238" height="156" rx="24" fill="#102733" stroke="${xml(palette.accent)}" stroke-width="3"/><circle cx="54" cy="62" r="35" fill="${xml(palette.primary)}"/><circle cx="54" cy="62" r="47" fill="none" stroke="${xml(palette.glow)}" stroke-opacity=".5"/><text x="104" y="50" fill="#fff" font-family="system-ui,sans-serif" font-size="19" font-weight="850">${xml(asset.manifest.name)}</text><text x="104" y="77" fill="#94b2bc" font-family="system-ui,sans-serif" font-size="13">STAGE ${asset.manifest.stage} · ${xml(asset.manifest.rarity.toUpperCase())}</text><text x="22" y="128" fill="${xml(palette.accent)}" font-family="ui-monospace,monospace" font-size="11">${xml(asset.manifest.variant.traits.visualFingerprint)}</text></g>`;
  }).join("");
  const vaultDigest = sha256PortableBasis(canonicalPortableCardJson(verified.map((asset) => ({ id: asset.id, proof: asset.proof.digest }))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="vault-title vault-description"><title id="vault-title">Receiz Wilds Vault</title><desc id="vault-description">A portable showcase containing ${verified.length} offline-verifiable creature cards.</desc><defs><radialGradient id="vault-bg"><stop stop-color="#153f4f"/><stop offset="1" stop-color="#06141d"/></radialGradient><linearGradient id="vault-line"><stop stop-color="#71e8c3"/><stop offset=".5" stop-color="#f7c948"/><stop offset="1" stop-color="#ff72bf"/></linearGradient></defs><rect width="1200" height="900" rx="54" fill="url(#vault-bg)"/><rect x="22" y="22" width="1156" height="856" rx="40" fill="none" stroke="url(#vault-line)" stroke-width="5"/><text x="62" y="86" fill="#71e8c3" font-family="system-ui,sans-serif" font-size="17" font-weight="850" letter-spacing="5">RECEIZ · PROOF-SEALED COLLECTION</text><text x="62" y="150" fill="#fff" font-family="system-ui,sans-serif" font-size="54" font-weight="900">WILDS VAULT</text><text x="1138" y="146" text-anchor="end" fill="#f7c948" font-family="system-ui,sans-serif" font-size="42" font-weight="900">${verified.length}</text><text x="1138" y="175" text-anchor="end" fill="#94b2bc" font-family="system-ui,sans-serif" font-size="14">SEALED CARDS</text>${tiles}${verified.length > featured.length ? `<text x="600" y="824" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="18" font-weight="750">+ ${verified.length - featured.length} more cards sealed inside this image</text>` : ""}<text x="62" y="856" fill="#7896a1" font-family="ui-monospace,monospace" font-size="12">${xml(vaultDigest)}</text><text x="1138" y="856" text-anchor="end" fill="#71e8c3" font-family="system-ui,sans-serif" font-size="13" font-weight="800">OFFLINE RECOVERABLE · ONE IMAGE</text></svg>`;
}

type PngChunk = { type: string; data: Uint8Array };

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

function uint32Bytes(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concatBytes(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePng(bytes: Uint8Array): PngChunk[] {
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) throw new Error("png_signature_invalid");
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("png_chunk_truncated");
    const length = uint32(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("png_chunk_truncated");
    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = new TextDecoder().decode(typeBytes);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("png_chunk_type_invalid");
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const expectedCrc = uint32(bytes, offset + 8 + length);
    if (crc32(concatBytes([typeBytes, data])) !== expectedCrc) throw new Error(`png_crc_invalid:${type}`);
    chunks.push({ type, data });
    offset = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length) throw new Error("png_end_invalid");
  if (!chunks.some((chunk) => chunk.type === "IHDR") || !chunks.some((chunk) => chunk.type === "IDAT")) throw new Error("png_critical_chunks_missing");
  return chunks;
}

function makeChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([uint32Bytes(data.length), typeBytes, data, uint32Bytes(crc32(concatBytes([typeBytes, data])))]);
}

function imageDigest(chunks: readonly PngChunk[]) {
  const basis = chunks
    .filter((chunk) => chunk.type === "IHDR" || chunk.type === "PLTE" || chunk.type === "IDAT")
    .map((chunk) => `${chunk.type}:${Array.from(chunk.data, (byte) => byte.toString(16).padStart(2, "0")).join("")}`)
    .join("|");
  return sha256PortableBasis(basis);
}

function pngFromChunks(chunks: readonly PngChunk[]) {
  return concatBytes([
    PNG_SIGNATURE,
    ...chunks.map((chunk) => makeChunk(chunk.type, chunk.data))
  ]);
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export type EmbeddedReceizProofObject = {
  artifactBytes: Uint8Array;
  artifactBasisSha256: string;
  document: LegacyReceizPortableAssetDocument;
  payloadBytes: Uint8Array;
  proofClaimId: string;
};

/** Read-only compatibility for Wildz PNGs issued with the v102 `rzPo` carrier. */
export async function readReceizProofObjectFromPng(source: Uint8Array): Promise<EmbeddedReceizProofObject> {
  const chunks = parsePng(source);
  const proofChunks = chunks.filter((chunk) => chunk.type === PROOF_OBJECT_CHUNK_TYPE);
  if (proofChunks.length !== 1) {
    throw new Error(proofChunks.length ? "wildz_png_proof_object_duplicate" : "wildz_png_proof_object_missing");
  }
  const artifactBytes = proofChunks[0]!.data.slice();
  const extracted = await extractLegacyReceizPortableAssetDocument(artifactBytes);
  const payloadBytes = receizBase64UrlDecode(extracted.document.payload.bytesBase64Url);
  const pngBasis = pngFromChunks(chunks.filter((chunk) => chunk.type !== PROOF_OBJECT_CHUNK_TYPE));
  if (extracted.document.assetType !== "proof_object"
    || extracted.document.payload.mimeType !== "image/png"
    || !equalBytes(payloadBytes, pngBasis)) {
    throw new Error("wildz_png_proof_object_binding_invalid");
  }
  return {
    artifactBytes,
    artifactBasisSha256: extracted.artifactBasisSha256,
    document: extracted.document,
    payloadBytes,
    proofClaimId: extracted.proofClaimId
  };
}

/** @deprecated Legacy fixture/interoperability helper. V103 native artifacts must never be wrapped. */
export async function embedReceizProofObjectInPng(source: Uint8Array, artifactBytes: Uint8Array) {
  const chunks = parsePng(source);
  if (chunks.some((chunk) => chunk.type === PROOF_OBJECT_CHUNK_TYPE)) {
    throw new Error("wildz_png_proof_object_duplicate");
  }
  const extracted = await extractLegacyReceizPortableAssetDocument(artifactBytes);
  const payloadBytes = receizBase64UrlDecode(extracted.document.payload.bytesBase64Url);
  if (extracted.document.assetType !== "proof_object"
    || extracted.document.payload.mimeType !== "image/png"
    || !equalBytes(payloadBytes, source)) {
    throw new Error("wildz_png_proof_object_binding_invalid");
  }
  const output: Uint8Array[] = [PNG_SIGNATURE];
  for (const chunk of chunks) {
    if (chunk.type === "IEND") output.push(makeChunk(PROOF_OBJECT_CHUNK_TYPE, artifactBytes));
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

export function embedPortableCardInPng(source: Uint8Array, asset: PortableCardAsset) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_card_proof_invalid");
  const sourceChunks = parsePng(source).filter((chunk) => chunk.type !== PROOF_CHUNK_TYPE);
  const proof: PortableCardPngProof = {
    schema: "receiz.wilds_png_proof.v2",
    imageDigest: imageDigest(sourceChunks),
    asset
  };
  const proofData = new TextEncoder().encode(canonicalPortableCardJson(proof));
  const output = [PNG_SIGNATURE];
  for (const chunk of sourceChunks) {
    if (chunk.type === "IEND") output.push(makeChunk(PROOF_CHUNK_TYPE, proofData));
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

export function readPortableCardFromPng(source: Uint8Array): PortableCardPngProof {
  const chunks = parsePng(source);
  const proofs = chunks.filter((chunk) => chunk.type === PROOF_CHUNK_TYPE);
  if (proofs.length !== 1) throw new Error(proofs.length ? "wilds_png_proof_duplicate" : "wilds_png_proof_missing");
  const decoded = JSON.parse(new TextDecoder().decode(proofs[0]!.data)) as Partial<PortableCardPngProof>;
  if ((decoded.schema !== "receiz.wilds_png_proof.v1" && decoded.schema !== "receiz.wilds_png_proof.v2") || typeof decoded.imageDigest !== "string" || !decoded.asset || typeof decoded.asset !== "object") throw new Error("wilds_png_proof_invalid");
  return decoded as PortableCardPngProof;
}

export function verifyPortableCardPng(source: Uint8Array): { ok: boolean; errors: string[]; asset: PortableCardAsset | null } {
  try {
    const chunks = parsePng(source);
    const proof = readPortableCardFromPng(source);
    const errors = [...verifyAnyWildsCard(proof.asset).errors];
    if (proof.imageDigest !== imageDigest(chunks)) errors.push("png_image_digest_mismatch");
    return { ok: errors.length === 0, errors, asset: errors.length ? null : proof.asset };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "wilds_png_proof_invalid"], asset: null };
  }
}

export function embedPortableVaultInPng(source: Uint8Array, assets: PortableCardAsset[], player?: WildsPlayerVaultPayload) {
  if (!assets.length || assets.some((asset) => !verifyAnyWildsCard(asset).ok)) throw new Error("wilds_vault_cards_invalid");
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length) throw new Error("wilds_vault_duplicate_card");
  const sourceChunks = parsePng(source).filter((chunk) => chunk.type !== VAULT_CHUNK_TYPE && chunk.type !== PROOF_CHUNK_TYPE);
  if (player && !verifyWildsPlayerVault(player).ok) throw new Error("wilds_player_vault_invalid");
  const cardBasis = assets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }));
  const vaultDigest = sha256PortableBasis(canonicalPortableCardJson(player
    ? { assets: cardBasis, playerDigest: player.payloadDigest }
    : cardBasis));
  const proof: PortableVaultPngProof = {
    schema: player ? "receiz.wilds_vault_png_proof.v3" : "receiz.wilds_vault_png_proof.v2",
    imageDigest: imageDigest(sourceChunks),
    vaultDigest,
    assets,
    ...(player ? { player } : {})
  };
  const proofData = new TextEncoder().encode(canonicalPortableCardJson(proof));
  const output = [PNG_SIGNATURE];
  for (const chunk of sourceChunks) {
    if (chunk.type === "IEND") output.push(makeChunk(VAULT_CHUNK_TYPE, proofData));
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

export function readPortableVaultFromPng(source: Uint8Array): PortableVaultPngProof {
  const chunks = parsePng(source);
  const proofs = chunks.filter((chunk) => chunk.type === VAULT_CHUNK_TYPE);
  if (proofs.length !== 1) throw new Error(proofs.length ? "wilds_vault_proof_duplicate" : "wilds_vault_proof_missing");
  const decoded = JSON.parse(new TextDecoder().decode(proofs[0]!.data)) as Partial<PortableVaultPngProof>;
  if ((decoded.schema !== "receiz.wilds_vault_png_proof.v1"
    && decoded.schema !== "receiz.wilds_vault_png_proof.v2"
    && decoded.schema !== "receiz.wilds_vault_png_proof.v3")
    || typeof decoded.imageDigest !== "string"
    || typeof decoded.vaultDigest !== "string"
    || !Array.isArray(decoded.assets)
    || (decoded.schema === "receiz.wilds_vault_png_proof.v3" && !decoded.player)
    || (decoded.schema !== "receiz.wilds_vault_png_proof.v3" && decoded.player !== undefined)) {
    throw new Error("wilds_vault_proof_invalid");
  }
  return decoded as PortableVaultPngProof;
}

export function verifyPortableVaultPng(source: Uint8Array): {
  ok: boolean;
  errors: string[];
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload | null;
} {
  try {
    const chunks = parsePng(source);
    const proof = readPortableVaultFromPng(source);
    const errors: string[] = [];
    if (!proof.assets.length) errors.push("wilds_vault_empty");
    const canonicalById = new Map<string, string>();
    proof.assets.forEach((asset, index) => {
      verifyAnyWildsCard(asset).errors.forEach((error) => errors.push(`card_${index}:${error}`));
      const canonical = canonicalPortableCardJson(asset);
      const prior = canonicalById.get(asset.id);
      if (prior !== undefined && prior !== canonical) errors.push("wilds_vault_duplicate_card_conflict");
      canonicalById.set(asset.id, canonical);
    });
    if (proof.player) verifyWildsPlayerVault(proof.player).errors.forEach((error) => errors.push(`player:${error}`));
    const cardBasis = proof.assets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }));
    const expectedVaultDigest = sha256PortableBasis(canonicalPortableCardJson(proof.player
      ? { assets: cardBasis, playerDigest: proof.player.payloadDigest }
      : cardBasis));
    if (proof.vaultDigest !== expectedVaultDigest) errors.push("wilds_vault_digest_mismatch");
    if (proof.imageDigest !== imageDigest(chunks)) errors.push("png_image_digest_mismatch");
    return {
      ok: errors.length === 0,
      errors,
      assets: errors.length ? [] : proof.assets,
      player: errors.length ? null : proof.player ?? null
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "wilds_vault_proof_invalid"],
      assets: [],
      player: null
    };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function requestReceizProofObject(artifact: Blob, filename: string, kind: "card" | "vault") {
  const form = new FormData();
  form.set("file", artifact, filename);
  form.set("kind", kind);
  let response: Response;
  try {
    response = await fetch("/api/receiz/proof-object", { method: "POST", body: form });
  } catch {
    return null;
  }
  if (response.status === 401 || response.status === 502 || response.status === 503 || response.status === 504) {
    return null;
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "receiz_proof_object_failed");
  }
  const proofObject = new Uint8Array(await response.arrayBuffer());
  if (!proofObject.byteLength) throw new Error("receiz_proof_object_empty");
  return proofObject;
}

async function svgPngBlob(svg: string, width = 750, height = 1050) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("wilds_card_canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("wilds_card_png_failed")), "image/png"));
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function downloadPortableCard(asset: PortableCardAsset) {
  if (typeof document === "undefined") throw new Error("wilds_card_download_browser_required");
  const filename = asset.manifest.formId;
  const publication = await attemptCardPublication(asset);
  const portable = await renderPortableCardPngBlob(asset);
  const portableBytes = new Uint8Array(await portable.arrayBuffer());
  const remoteProof = await requestReceizProofObject(portable, `${filename}.png`, "card");
  const exported = remoteProof ?? portableBytes;
  downloadBlob(new Blob([exported.slice().buffer], { type: "image/png" }), `${filename}.receized.png`);
  return { published: publication.published };
}

export async function portableCardPngBlob(asset: PortableCardAsset) {
  if (typeof document === "undefined") throw new Error("wilds_card_png_browser_required");
  await attemptCardPublication(asset);
  return renderPortableCardPngBlob(asset);
}

function attemptCardPublication(asset: PortableCardAsset) {
  return attemptPublicWildsCardRegistration(asset);
}

async function renderPortableCardPngBlob(asset: PortableCardAsset) {
  const rendered = await svgPngBlob(renderWildsCardSvg(asset, { origin: window.location.origin }));
  const portable = embedPortableCardInPng(new Uint8Array(await rendered.arrayBuffer()), asset);
  return new Blob([portable.slice().buffer], { type: "image/png" });
}

export async function portableVaultPngBlob(assets: PortableCardAsset[], player?: WildsPlayerVaultPayload) {
  if (typeof document === "undefined") throw new Error("wilds_vault_png_browser_required");
  const rendered = await svgPngBlob(renderWildsVaultSvg(assets), 1200, 900);
  const portable = embedPortableVaultInPng(new Uint8Array(await rendered.arrayBuffer()), assets, player);
  return new Blob([portable.slice().buffer], { type: "image/png" });
}

export async function downloadPortableVault(assets: PortableCardAsset[], player?: WildsPlayerVaultPayload) {
  if (!assets.length) throw new Error("wilds_vault_empty");
  const digest = sha256PortableBasis(canonicalPortableCardJson(assets.map((asset) => asset.id))).slice(7, 19);
  const portable = await portableVaultPngBlob(assets, player);
  const portableBytes = new Uint8Array(await portable.arrayBuffer());
  const remoteProof = await requestReceizProofObject(portable, "wilds-vault.png", "vault");
  const exported = remoteProof && verifyPortableVaultPng(remoteProof).ok
    ? remoteProof
    : portableBytes;
  downloadBlob(new Blob([exported.slice().buffer], { type: "image/png" }), `wilds-vault-${digest}.receized.png`);
}

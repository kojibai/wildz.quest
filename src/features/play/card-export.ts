import {renderWildsCardSvg} from "./card-svg";
import {standaloneCardUrl} from "./card-url";
export {renderWildsCardSvg} from "./card-svg";
export {standaloneCardUrl} from "./card-url";
import { PNG_SIGNATURE, PROOF_CHUNK_TYPE, parsePng, uint32Bytes, concatBytes, imageDigest, type PortableCardPngProof } from "./portable-card-png-proof";
export { readPortableCardFromPng, verifyPortableCardPng } from "./portable-card-png-proof";
import type { WildzGameImageKind } from "../../lib/receiz/wildz-game-image-export";
import { verifyAndAdmitWildsCard, retainAdmittedWildsInventory } from "./admitted-inventory";
import { createRetainedProofJson, freezeProofValue } from "./retained-proof-json";
import { pngCrc32 as crc32 } from "../../lib/png-crc32";
import { wildzSealedDownloadFilename } from "../../lib/receiz/wildz-sealed-document";
import { parseWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import {
  requireGloballyAvailablePublicWildsCard
} from "./public-card-registry";
import { WILDZ_PRODUCT } from "../../lib/wildz/product";
import {
  canonicalPortableCardJson,
  portableCardBaseProofAsset,
  requiresPortableCardProofAppend,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "./portable-card";
import {
  cardArtifactFingerprint,
  type PreparedCardArtifact
} from "./prepared-card-artifact";
import { normalizeWildsPlayerVaultInput, verifyWildsPlayerVault, type createWildsPlayerVault, type WildsPlayerVaultPayload } from "./wilds-player-vault";

export type { PortableCardPngProof } from "./portable-card-png-proof";

export type PortableVaultPngProof = {
  schema: "receiz.wilds_vault_png_proof.v1" | "receiz.wilds_vault_png_proof.v2" | "receiz.wilds_vault_png_proof.v3";
  imageDigest: string;
  vaultDigest: string;
  assets: PortableCardAsset[];
  player?: WildsPlayerVaultPayload;
};

export type WildsCardSendTarget =
  | { kind: "receiz-username"; value: string; label: `@${string}` }
  | { kind: "email"; value: string; label: string };

export type WildsCardSendDraft = {
  target: WildsCardSendTarget;
  url: string;
  title: string;
  text: string;
  href: string;
  filename: string;
};

const VAULT_CHUNK_TYPE = "rzVt";
const PROOF_OBJECT_CHUNK_TYPE = "rzPo";
const WILDZ_PROOF_APPEND_CHUNK_TYPE = "rzWx";

export type WildzProofAppendV1 = {
  schema: "receiz.wildz_proof_append.v1";
  kind?: "card";
  base: {
    assetId: string;
    proofDigest: string;
  };
  asset: PortableCardAsset;
} | {
  schema: "receiz.wildz_proof_append.v1";
  kind: "player-vault";
  base: {
    vaultDigest: string;
  };
  player: WildsPlayerVaultPayload;
};

function xml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function normalizeWildsCardSendTarget(value: string): WildsCardSendTarget | null {
  const normalized = value.trim().replace(/^mailto:/i, "");
  if (!normalized) return null;
  const email = normalized.toLowerCase();
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return { kind: "email", value: email, label: email };
  }
  const coordinate = parseWildzPlayerCoordinate(normalized);
  return coordinate
    ? { kind: "receiz-username", value: coordinate.actorId, label: `@${coordinate.actorId}` }
    : null;
}

export function createWildsCardSendDraft(
  asset: PortableCardAsset,
  targetValue: string,
  origin: string
): WildsCardSendDraft {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_card_proof_invalid");
  const target = normalizeWildsCardSendTarget(targetValue);
  if (!target) throw new Error("wilds_card_send_target_invalid");
  const url = standaloneCardUrl(asset.id, origin);
  const title = `Wildz card: ${asset.manifest.name}`;
  const text = [
    `${target.label}, here is a verified Wildz Receiz proof object.`,
    `Open the attached Receiz-sealed artifact in Wildz, Receiz, or another v120-compatible application.`,
    `The sealed proof object and its append-only ownership history remain the authority.`,
    `Standalone card link: ${url}`,
    `Card: ${asset.id}`
  ].join("\n");
  const mailto = target.kind === "email"
    ? `mailto:${encodeURIComponent(target.value)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`
    : `https://receiz.com/${encodeURIComponent(target.value)}`;
  return {
    target,
    url,
    title,
    text,
    href: mailto,
    filename: `${portableCreatureFilename(asset.manifest.name)}.receized`
  };
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

function makeChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([uint32Bytes(data.length), typeBytes, data, uint32Bytes(crc32(typeBytes, data))]);
}

/** Lossless application payload chunk; never use this to modify a sealed artifact. */
export function withWildzPngPayloadChunk(source: Uint8Array, keyword: string, value: string | null) {
  const prefix = `${keyword}\0`;
  const chunks = parsePng(source).filter(chunk => !(chunk.type === "tEXt"
    && new TextDecoder().decode(chunk.data).startsWith(prefix)));
  if (value !== null) chunks.splice(chunks.length - 1, 0, { type: "tEXt", data: new TextEncoder().encode(prefix + value) });
  return concatBytes([PNG_SIGNATURE, ...chunks.map(chunk => makeChunk(chunk.type, chunk.data))]);
}

export function readWildzPngPayloadChunks(source: Uint8Array, keyword: string) {
  const prefix = `${keyword}\0`;
  return parsePng(source).filter(chunk => chunk.type === "tEXt")
    .map(chunk => new TextDecoder().decode(chunk.data)).filter(text => text.startsWith(prefix))
    .map(text => text.slice(prefix.length));
}

export type EmbeddedReceizProofObject = {
  artifactBytes: Uint8Array;
};

/** Extracts the opaque legacy carrier. Only the v120 SDK may open these bytes. */
export function readReceizProofObjectFromPng(source: Uint8Array): EmbeddedReceizProofObject {
  const chunks = parsePng(source);
  const proofChunks = chunks.filter((chunk) => chunk.type === PROOF_OBJECT_CHUNK_TYPE);
  if (proofChunks.length !== 1) {
    throw new Error(proofChunks.length ? "wildz_png_proof_object_duplicate" : "wildz_png_proof_object_missing");
  }
  const artifactBytes = proofChunks[0]!.data.slice();
  return { artifactBytes };
}

/** @deprecated Test-only carrier helper. Native v120 artifacts must never be wrapped. */
export function embedReceizProofObjectInPng(source: Uint8Array, artifactBytes: Uint8Array) {
  const chunks = parsePng(source);
  if (chunks.some((chunk) => chunk.type === PROOF_OBJECT_CHUNK_TYPE)) {
    throw new Error("wildz_png_proof_object_duplicate");
  }
  const output: Uint8Array[] = [PNG_SIGNATURE];
  for (const chunk of chunks) {
    if (chunk.type === "IEND") output.push(makeChunk(PROOF_OBJECT_CHUNK_TYPE, artifactBytes));
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

function wildzProofAppendFor(asset: PortableCardAsset, base: PortableCardAsset): WildzProofAppendV1 | null {
  if (!requiresPortableCardProofAppend(asset)) return null;
  return {
    schema: "receiz.wildz_proof_append.v1",
    kind: "card",
    base: {
      assetId: base.id,
      proofDigest: base.proof.digest
    },
    asset
  };
}

export function readWildzProofAppendsFromPng(source: Uint8Array): WildzProofAppendV1[] {
  const chunks = parsePng(source);
  return chunks
    .filter((chunk) => chunk.type === WILDZ_PROOF_APPEND_CHUNK_TYPE)
    .map((chunk) => {
      const decoded = JSON.parse(new TextDecoder().decode(chunk.data)) as Record<string, unknown>;
      const base = decoded.base && typeof decoded.base === "object" && !Array.isArray(decoded.base)
        ? decoded.base as Record<string, unknown>
        : null;
      if (decoded.schema !== "receiz.wildz_proof_append.v1"
        || !base
        || (decoded.kind === "player-vault"
          ? (typeof base.vaultDigest !== "string"
            || !decoded.player
            || typeof decoded.player !== "object")
          : (typeof base.assetId !== "string"
            || typeof base.proofDigest !== "string"
            || !decoded.asset
            || typeof decoded.asset !== "object"))) {
        throw new Error("wildz_png_proof_append_invalid");
      }
      return decoded as WildzProofAppendV1;
    });
}

export function readWildzPlayerVaultAppendFromPng(source: Uint8Array): {
  base: { vaultDigest: string };
  player: WildsPlayerVaultPayload;
} {
  const appends = readWildzProofAppendsFromPng(source).filter((append) => append.kind === "player-vault");
  if (appends.length !== 1) throw new Error(appends.length ? "wildz_player_vault_append_duplicate" : "wildz_player_vault_append_missing");
  const append = appends[0]!;
  if (append.kind !== "player-vault") throw new Error("wildz_player_vault_append_missing");
  return { base: append.base, player: append.player };
}

export function embedPortableCardInPng(source: Uint8Array, asset: PortableCardAsset) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_card_proof_invalid");
  const baseAsset = portableCardBaseProofAsset(asset);
  const append = wildzProofAppendFor(asset, baseAsset);
  const sourceChunks = parsePng(source).filter((chunk) => chunk.type !== PROOF_CHUNK_TYPE && chunk.type !== WILDZ_PROOF_APPEND_CHUNK_TYPE);
  const proof: PortableCardPngProof = {
    schema: "receiz.wilds_png_proof.v2",
    imageDigest: imageDigest(sourceChunks),
    asset: baseAsset
  };
  const proofData = new TextEncoder().encode(canonicalPortableCardJson(proof));
  const appendData = append ? new TextEncoder().encode(canonicalPortableCardJson(append)) : null;
  const output = [PNG_SIGNATURE];
  for (const chunk of sourceChunks) {
    if (chunk.type === "IEND") {
      if (appendData) output.push(makeChunk(WILDZ_PROOF_APPEND_CHUNK_TYPE, appendData));
      output.push(makeChunk(PROOF_CHUNK_TYPE, proofData));
    }
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

/** Build a new public roaming image, without device metadata or private Vault
 * append data. This is only for freshly rendered pixels, never retained seals. */
export function embedRoamingCardInPng(rendered: Uint8Array, asset: PortableCardAsset) {
  const publicImageChunks = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "cHRM", "pHYs"]);
  const pixels = concatBytes([PNG_SIGNATURE, ...parsePng(rendered)
    .filter(chunk => publicImageChunks.has(chunk.type))
    .map(chunk => makeChunk(chunk.type, chunk.data))]);
  return embedPortableCardInPng(pixels, asset);
}

export function embedPortableVaultInPng(source: Uint8Array, assets: PortableCardAsset[], player?: WildsPlayerVaultPayload) {
  if (!assets.length || assets.some((asset) => !verifyAnyWildsCard(asset).ok)) throw new Error("wilds_vault_cards_invalid");
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length) throw new Error("wilds_vault_duplicate_card");
  const baseAssets = assets.map(portableCardBaseProofAsset);
  const appends = assets
    .map((asset, index) => wildzProofAppendFor(asset, baseAssets[index]!))
    .filter((append): append is WildzProofAppendV1 => append !== null);
  const sourceChunks = parsePng(source).filter((chunk) => chunk.type !== VAULT_CHUNK_TYPE && chunk.type !== PROOF_CHUNK_TYPE && chunk.type !== WILDZ_PROOF_APPEND_CHUNK_TYPE);
  if (player && !verifyWildsPlayerVault(player).ok) throw new Error("wilds_player_vault_invalid");
  const cardBasis = baseAssets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }));
  const vaultDigest = sha256PortableBasis(canonicalPortableCardJson(cardBasis));
  const proof: PortableVaultPngProof = {
    schema: "receiz.wilds_vault_png_proof.v2",
    imageDigest: imageDigest(sourceChunks),
    vaultDigest,
    assets: baseAssets
  };
  const proofData = new TextEncoder().encode(canonicalPortableCardJson(proof));
  const appendData = [
    ...appends,
    ...(player ? [{
      schema: "receiz.wildz_proof_append.v1" as const,
      kind: "player-vault" as const,
      base: { vaultDigest },
      player
    }] : [])
  ].map((append) => new TextEncoder().encode(canonicalPortableCardJson(append)));
  const output = [PNG_SIGNATURE];
  for (const chunk of sourceChunks) {
    if (chunk.type === "IEND") {
      appendData.forEach((data) => output.push(makeChunk(WILDZ_PROOF_APPEND_CHUNK_TYPE, data)));
      output.push(makeChunk(VAULT_CHUNK_TYPE, proofData));
    }
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return concatBytes(output);
}

/** Opaque same-runtime custody of an export built from validated proof inputs.
 * Parsed uploads cannot manufacture this handle or substitute its exact bytes. */
export type PreparedPortableVaultPng = Readonly<{ kind: "wildz.prepared-vault-png" }>;
const preparedVaultContents = new WeakMap<PreparedPortableVaultPng, {
  bytes: Uint8Array; vaultDigest: string; playerId: string; playerPayloadDigest: string;
}>();
export function withPreparedPortableVaultPng<T>(prepared: PreparedPortableVaultPng,
  consume: (contents: { bytes: Uint8Array; vaultDigest: string; playerId: string; playerPayloadDigest: string }) => T): T {
  const contents = preparedVaultContents.get(prepared);
  if (!contents) throw new Error("wildz_prepared_vault_custody_missing");
  // Consume custody before exposing bytes; mutated bytes cannot be signed again.
  preparedVaultContents.delete(prepared);
  return consume(contents);
}

/** Retain immutable carried proof sections. A new player append never rebuilds
 * existing card proofs. New card revisions acquire their own retained sections. */
export function createRetainedPortableVaultWriter() {
  const json = createRetainedProofJson();
  const sections = new WeakMap<PortableCardAsset, { base: PortableCardAsset; append: Uint8Array | null }>();
  let cardSectionsPrepared = 0;
  let previousAssets: readonly PortableCardAsset[] = [];
  let cardSections: { base: PortableCardAsset; append: Uint8Array | null }[] = [];
  let vaultDigest = "";
  let previousImageDigest = "";
  let vaultChunk: Uint8Array | null = null;
  const encoder = new TextEncoder();
  return {
    diagnostics: () => ({ cardSectionsPrepared }),
    prepare(source: Uint8Array, assets: PortableCardAsset[], input: WildsPlayerVaultPayload | Parameters<typeof createWildsPlayerVault>[0]) {
      if (!assets.length) throw new Error("wilds_vault_cards_invalid");
      const changed = previousAssets.length !== assets.length || assets.some((asset, index) => asset !== previousAssets[index]);
      if (changed) {
        if (new Set(assets.map(asset => asset.id)).size !== assets.length) throw new Error("wilds_vault_duplicate_card");
        cardSections = assets.map(asset => {
          const held = sections.get(asset);
          if (held) return held;
          if (!verifyAndAdmitWildsCard(asset)) throw new Error("wilds_vault_cards_invalid");
          freezeProofValue(asset);
          const base = freezeProofValue(portableCardBaseProofAsset(asset));
          const append = wildzProofAppendFor(asset, base);
          const section = { base, append: append ? makeChunk(WILDZ_PROOF_APPEND_CHUNK_TYPE, encoder.encode(json(freezeProofValue(append)))) : null };
          sections.set(asset, section);
          cardSectionsPrepared++;
          return section;
        });
        previousAssets = assets.slice();
        vaultDigest = sha256PortableBasis(json(cardSections.map(section => ({ id: section.base.id, proof: section.base.proof.digest }))));
        vaultChunk = null;
      }
      retainAdmittedWildsInventory(input.playState.inventory);
      let player: WildsPlayerVaultPayload;
      if ("payloadDigest" in input) {
        // Externally supplied payloads still enter through the complete verifier.
        if (!verifyWildsPlayerVault(input).ok) throw new Error("wilds_player_vault_invalid");
        player = freezeProofValue(structuredClone(input));
      } else {
        const basis = freezeProofValue({ schema: "receiz.wilds_player_vault.v3" as const, ...normalizeWildsPlayerVaultInput(input) });
        player = freezeProofValue({ ...basis, payloadDigest: sha256PortableBasis(json(basis)) });
      }
      const sourceChunks = parsePng(source).filter(chunk => chunk.type !== VAULT_CHUNK_TYPE && chunk.type !== PROOF_CHUNK_TYPE && chunk.type !== WILDZ_PROOF_APPEND_CHUNK_TYPE);
      const currentImageDigest = imageDigest(sourceChunks);
      if (!vaultChunk || previousImageDigest !== currentImageDigest) {
        vaultChunk = makeChunk(VAULT_CHUNK_TYPE, encoder.encode(json({ schema: "receiz.wilds_vault_png_proof.v2", imageDigest: currentImageDigest, vaultDigest, assets: cardSections.map(section => section.base) })));
        previousImageDigest = currentImageDigest;
      }
      const playerChunk = makeChunk(WILDZ_PROOF_APPEND_CHUNK_TYPE, encoder.encode(json({ schema: "receiz.wildz_proof_append.v1", kind: "player-vault", base: { vaultDigest }, player })));
      const output: Uint8Array[] = [PNG_SIGNATURE];
      for (const chunk of sourceChunks) {
        if (chunk.type === "IEND") {
          for (const section of cardSections) if (section.append) output.push(section.append);
          output.push(playerChunk, vaultChunk);
        }
        output.push(makeChunk(chunk.type, chunk.data));
      }
      const prepared: PreparedPortableVaultPng = Object.freeze({ kind: "wildz.prepared-vault-png" });
      preparedVaultContents.set(prepared, { bytes: concatBytes(output), vaultDigest, playerId: player.playerId, playerPayloadDigest: player.payloadDigest });
      return { prepared, playerPayloadDigest: player.payloadDigest };
    }
  };
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
    || !Array.isArray(decoded.assets)) {
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
    const cardBasis = proof.assets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }));
    const expectedVaultDigest = sha256PortableBasis(canonicalPortableCardJson(
      proof.schema === "receiz.wilds_vault_png_proof.v3" && proof.player
        ? { assets: cardBasis, playerDigest: proof.player.payloadDigest }
        : cardBasis
    ));
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
  // Safari may preview a blob instead of honoring download. Keep that fallback
  // out of the running game, including when an async save lost user activation.
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    // Safari can consume the download URL after the click task has returned.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Opens the platform save/share sheet when file sharing is available (notably
 * iPhone/iPad), with the classic download rail as the desktop fallback. */
export async function saveBlobToDevice(blob: Blob, filename: string) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      // Construct synchronously so iOS still sees the Save tap's user activation.
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const data: ShareData = { files: [file] };
      if (typeof navigator.canShare !== "function" || navigator.canShare(data)) {
        await navigator.share(data);
        return "native-share" as const;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw new Error("wilds_native_save_cancelled");
      }
      // Capability probing and sharing can both reject. Keep downloads usable.
    }
  }
  downloadBlob(blob, filename);
  return "download" as const;
}

export function portableCreatureFilename(name: string) {
  const normalized = name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!normalized) throw new Error("wilds_card_name_invalid");
  return normalized;
}

export type WildzDownloadedProofObjectVerifier = (
  artifactBytes: Uint8Array,
  artifactMimeType: string,
  artifactFilename: string,
  expectedPayloadBytes: Uint8Array
) => Promise<void>;

export async function createReceizProofObjectArtifact(
  payload: Blob,
  filename: string,
  kind: WildzGameImageKind,
  verifyProofObject?: WildzDownloadedProofObjectVerifier,
  options: { allowEnrollment?: boolean } = {}
) {
  const { sealWildzOwnedCardBlob } = await import("../../lib/receiz/local-seal/browser");
  const artifact = await sealWildzOwnedCardBlob(payload, filename, kind, options);
  const { bytes: proofObject, mimeType, filename: artifactFilename } = artifact;
  // sealWildzOwnedCardBlob verifies the exact artifact and original payload
  // before returning. Do not repeat the same cryptographic round trip here.
  if (verifyProofObject) {
    await verifyProofObject(
      proofObject,
      mimeType,
      artifactFilename,
      new Uint8Array(await payload.arrayBuffer())
    );
  }
  return { bytes: proofObject, filename: artifactFilename, mimeType };
}

export async function downloadReceizProofObject(
  payload: Blob,
  filename: string,
  kind: "card" | "vault",
  options: { verifyProofObject?: WildzDownloadedProofObjectVerifier; outputFilename?: string } = {}
) {
  const artifact = await createReceizProofObjectArtifact(
    payload,
    filename,
    kind,
    options.verifyProofObject
  );
  await saveBlobToDevice(
    new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }),
    wildzSealedDownloadFilename(options.outputFilename ?? artifact.filename, artifact.mimeType)
  );
  return artifact;
}

async function svgPngBlob(svg: string, width = 750, height = 1050) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  let image: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    image = new Image();
    const rasterImage = image;
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      rasterImage.onload = () => resolve();
      rasterImage.onerror = () => reject(new Error("wilds_card_svg_load_failed"));
    });
    image.src = source;
    // Chromium can leave decode() pending indefinitely for a large SVG blob
    // after the image has already loaded. Either completed signal is sufficient
    // before drawing the exact same source bytes to the canvas.
    await Promise.race([
      image.decode().catch(() => loaded),
      loaded
    ]);
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("wilds_card_canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const rasterCanvas = canvas;
    return await new Promise<Blob>((resolve, reject) => rasterCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("wilds_card_png_failed")), "image/png"));
  } finally {
    if (image) { image.onload = null; image.onerror = null; image.removeAttribute("src"); }
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    URL.revokeObjectURL(source);
  }
}

async function serverArtifactPng(kind: "card" | "vault", assets: PortableCardAsset[]) {
  const response = await fetch("/api/wildz/artifact-image", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, assets })
  });
  if (!response.ok || response.headers.get("x-wildz-raster-authority") !== "verified-card-projection") {
    throw new Error("wildz_artifact_image_failed");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) throw new Error("wildz_artifact_image_empty");
  return new Blob([bytes.slice().buffer], { type: "image/png" });
}

export async function downloadPortableCard(
  asset: PortableCardAsset,
  options: { verifyProofObject?: WildzDownloadedProofObjectVerifier } = {}
) {
  if (typeof document === "undefined") throw new Error("wilds_card_download_browser_required");
  const prepared = await preparePortableCardArtifact(asset, options);
  downloadPreparedCardArtifact(prepared);
  return { published: true as const };
}

export async function preparePortableCardArtifact(
  asset: PortableCardAsset,
  options: { verifyProofObject?: WildzDownloadedProofObjectVerifier } = {}
): Promise<PreparedCardArtifact> {
  if (typeof document === "undefined") throw new Error("wilds_card_download_browser_required");
  const filename = portableCreatureFilename(asset.manifest.name);
  await requireGloballyAvailablePublicWildsCard(asset);
  const portable = await renderPortableCardPngBlob(asset);
  const artifact = await createReceizProofObjectArtifact(
    portable,
    `${filename}.png`,
    "card",
    options.verifyProofObject
  );
  return {
    ...artifact,
    fingerprint: cardArtifactFingerprint(asset)
  };
}

export function downloadPreparedCardArtifact(artifact: PreparedCardArtifact) {
  downloadBlob(
    new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }),
    artifact.filename
  );
}

export async function portableCardPngBlob(asset: PortableCardAsset) {
  if (typeof document === "undefined") throw new Error("wilds_card_png_browser_required");
  await requireGloballyAvailablePublicWildsCard(asset);
  return renderPortableCardPngBlob(asset);
}

export async function portableCardPngBlobForIdentityOwnership(asset: PortableCardAsset) {
  if (typeof document === "undefined") throw new Error("wilds_card_png_browser_required");
  return renderPortableCardPngBlob(asset);
}

export async function portableRoamingCardPngBlob(asset: PortableCardAsset) {
  if (typeof document === "undefined") throw new Error("wilds_card_png_browser_required");
  const rendered = await svgPngBlob(renderWildsCardSvg(asset, { origin: WILDZ_PRODUCT.origin }))
    .catch(() => serverArtifactPng("card", [asset]));
  const bytes = embedRoamingCardInPng(new Uint8Array(await rendered.arrayBuffer()), asset);
  return new Blob([bytes.slice().buffer], { type: "image/png" });
}

async function renderPortableCardPngBlob(asset: PortableCardAsset) {
  const rendered = await svgPngBlob(renderWildsCardSvg(asset, { origin: WILDZ_PRODUCT.origin }))
    .catch(() => serverArtifactPng("card", [asset]));
  const portable = embedPortableCardInPng(new Uint8Array(await rendered.arrayBuffer()), asset);
  return new Blob([portable.slice().buffer], { type: "image/png" });
}

export async function portableVaultPngBlob(assets: PortableCardAsset[], player?: WildsPlayerVaultPayload) {
  if (typeof document === "undefined") throw new Error("wilds_vault_png_browser_required");
  const rendered = await svgPngBlob(renderWildsVaultSvg(assets), 1200, 900)
    .catch(() => serverArtifactPng("vault", assets));
  const portable = embedPortableVaultInPng(new Uint8Array(await rendered.arrayBuffer()), assets, player);
  return new Blob([portable.slice().buffer], { type: "image/png" });
}

export async function downloadPortableVault(
  assets: PortableCardAsset[],
  player?: WildsPlayerVaultPayload,
  options: { verifyProofObject?: WildzDownloadedProofObjectVerifier } = {}
) {
  if (!assets.length) throw new Error("wilds_vault_empty");
  const digest = sha256PortableBasis(canonicalPortableCardJson(assets.map((asset) => asset.id))).slice(7, 19);
  const portable = await portableVaultPngBlob(assets, player);
  await downloadReceizProofObject(
    portable,
    "wilds-vault.png",
    "vault",
    { ...options, outputFilename: `wilds-vault-${digest}.receized.png` }
  );
}

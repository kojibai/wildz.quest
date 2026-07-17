import {
  appendReceizIdentityArtifactTrailerToPng,
  type ReceizKeyFile
} from "@receiz/sdk";
import type { WildzIdentitySession } from "./wildz-identity-repository";

const SEAL_SIZE = 900;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

type WildzIdentitySealArtworkIdentity = Pick<
  WildzIdentitySession,
  "keyId" | "username" | "displayName"
>;

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function concatBytes(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function uint32Bytes(value: number) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([
    uint32Bytes(data.byteLength),
    typeBytes,
    data,
    uint32Bytes(crc32(concatBytes([typeBytes, data])))
  ]);
}

async function renderPortableSealArtwork() {
  if (typeof CompressionStream === "undefined") {
    throw new Error("identity_seal_png_compression_unavailable");
  }

  const stride = 1 + SEAL_SIZE * 3;
  const pixels = new Uint8Array(stride * SEAL_SIZE);
  for (let y = 0; y < SEAL_SIZE; y += 1) {
    const row = y * stride;
    pixels[row] = 0;
    for (let x = 0; x < SEAL_SIZE; x += 1) {
      const progress = (x + y) / (SEAL_SIZE * 2);
      const firstHalf = progress <= 0.52;
      const mix = firstHalf ? progress / 0.52 : (progress - 0.52) / 0.48;
      const from = firstHalf ? [0, 27, 45] : [0, 165, 138];
      const to = firstHalf ? [0, 165, 138] : [255, 255, 255];
      const offset = row + 1 + x * 3;
      pixels[offset] = Math.round(from[0]! + (to[0]! - from[0]!) * mix);
      pixels[offset + 1] = Math.round(from[1]! + (to[1]! - from[1]!) * mix);
      pixels[offset + 2] = Math.round(from[2]! + (to[2]! - from[2]!) * mix);

      if (x >= 86 && x < 814 && y >= 86 && y < 814) {
        pixels[offset] = Math.round(pixels[offset]! * 0.08 + 255 * 0.92);
        pixels[offset + 1] = Math.round(pixels[offset + 1]! * 0.08 + 255 * 0.92);
        pixels[offset + 2] = Math.round(pixels[offset + 2]! * 0.08 + 255 * 0.92);
      }
      const sealBorder = x >= 320 && x < 580 && y >= 300 && y < 560
        && !(x >= 338 && x < 562 && y >= 318 && y < 542);
      if (sealBorder) {
        pixels[offset] = 0;
        pixels[offset + 1] = 165;
        pixels[offset + 2] = 138;
      }
    }
  }

  const compressed = new Uint8Array(await new Response(
    new Blob([strictArrayBuffer(pixels)]).stream().pipeThrough(new CompressionStream("deflate"))
  ).arrayBuffer());
  const header = new Uint8Array(13);
  header.set(uint32Bytes(SEAL_SIZE), 0);
  header.set(uint32Bytes(SEAL_SIZE), 4);
  header.set([8, 2, 0, 0, 0], 8);
  return concatBytes([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array())
  ]);
}

async function renderWildzIdentitySealArtwork(identity: WildzIdentitySealArtworkIdentity) {
  if (typeof document === "undefined") return renderPortableSealArtwork();

  const canvas = document.createElement("canvas");
  canvas.width = SEAL_SIZE;
  canvas.height = SEAL_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("identity_seal_canvas_required");

  const gradient = context.createLinearGradient(0, 0, SEAL_SIZE, SEAL_SIZE);
  gradient.addColorStop(0, "#001b2d");
  gradient.addColorStop(0.52, "#00a58a");
  gradient.addColorStop(1, "#ffffff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, SEAL_SIZE, SEAL_SIZE);

  context.fillStyle = "rgba(255,255,255,0.92)";
  roundedRectPath(context, 86, 86, 728, 728, 74);
  context.fill();

  context.fillStyle = "#001b2d";
  context.font = "900 28px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.letterSpacing = "8px";
  context.textAlign = "center";
  context.fillText("RECEIZ ID", 450, 190);

  context.fillStyle = "#00a58a";
  context.font = "800 18px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.letterSpacing = "4px";
  context.fillText("PORTABLE ACCOUNT", 450, 228);

  context.strokeStyle = "#00a58a";
  context.lineWidth = 18;
  roundedRectPath(context, 320, 300, 260, 260, 74);
  context.stroke();

  context.beginPath();
  context.moveTo(390, 424);
  context.lineTo(438, 472);
  context.lineTo(524, 374);
  context.lineWidth = 28;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();

  const identityLabel = identity.username?.trim() ? `@${identity.username.trim().replace(/^@+/, "")}` : identity.displayName?.trim() || identity.keyId;
  context.fillStyle = "#001b2d";
  context.font = "800 42px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.letterSpacing = "0px";
  context.fillText(identityLabel, 450, 650);

  context.fillStyle = "#667085";
  context.font = "800 18px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.letterSpacing = "3px";
  context.fillText("BEARER CREDENTIAL", 450, 700);
  context.font = "700 16px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.letterSpacing = "1px";
  context.fillText(`KEY ${identity.keyId.slice(0, 8).toUpperCase()} · FULL CONTINUITY`, 450, 742);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("identity_seal_canvas_export_failed"));
    }, "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function appendWildzIdentitySealAuthority(pngBytes: Uint8Array, keyFile: ReceizKeyFile) {
  return appendReceizIdentityArtifactTrailerToPng(pngBytes, keyFile);
}

export async function createWildzIdentityCardArtworkPng(session: WildzIdentitySession) {
  return renderWildzIdentitySealArtwork({
    keyId: session.keyId,
    username: session.username,
    displayName: session.displayName
  });
}

export async function createWildzIdentitySealPng(
  keyFile: ReceizKeyFile,
  session: WildzIdentitySession
) {
  if (keyFile.keyId !== session.keyId) throw new Error("wildz_identity_seal_key_id_mismatch");
  const artwork = await createWildzIdentityCardArtworkPng(session);
  return appendWildzIdentitySealAuthority(artwork, keyFile);
}

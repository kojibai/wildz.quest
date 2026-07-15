import type {
  JsonObject,
  ReceizMediaUploadOptions,
  ReceizMediaUploadResponse
} from "@receiz/sdk";
import type { BlogPost, CommerceState, MediaProofReference, Product } from "@/types/domain";

export type PublishPayloadMediaUpload = (
  file: Blob,
  options?: ReceizMediaUploadOptions
) => Promise<ReceizMediaUploadResponse | JsonObject>;

export type PublishPayloadMediaCompressor = (
  dataUrl: string,
  path: string[],
  maxChars: number
) => Promise<string | null>;

export type PreparePublishPayloadMediaOptions = {
  tenantHost: string;
  merchantReceizId?: string;
  upload?: PublishPayloadMediaUpload;
  compress?: PublishPayloadMediaCompressor;
  itemMaxChars?: number;
  totalMaxChars?: number;
};

export type PreparedPublishPayloadMedia = {
  state: CommerceState;
  uploaded: number;
  compressed: number;
  stripped: number;
  inlineChars: number;
  warnings: string[];
};

export type PreparePublishRequestBodyOptions<TStatePayload> = {
  action: string;
  extra?: Record<string, unknown>;
  maxBodyChars?: number;
  media: PreparePublishPayloadMediaOptions;
  merchantProof: unknown;
  state: CommerceState;
  statePayload: (state: CommerceState) => TStatePayload;
};

export type PreparedPublishRequestBody<TStatePayload> = Record<string, unknown> & {
  action: string;
  merchantProof: unknown;
  state: TStatePayload;
};

const INLINE_IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+)(;base64)?,([\s\S]*)$/i;
export const PUBLISH_INLINE_MEDIA_ITEM_MAX_CHARS = 120_000;
export const PUBLISH_INLINE_MEDIA_TOTAL_MAX_CHARS = 900_000;
export const PUBLISH_REQUEST_BODY_MAX_CHARS = 3_000_000;

const MEDIA_URL_KEYS = [
  "url",
  "publicUrl",
  "mediaUrl",
  "src",
  "href",
  "absoluteUrl",
  "durableUrl",
  "cdnUrl"
];
const PROOF_ID_KEYS = ["receizClaimId", "proofObjectId", "proofId", "id", "anchorId", "appendAnchorId"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isInlineImageDataUrl(value: string) {
  return INLINE_IMAGE_DATA_URL.test(value);
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/svg+xml") return "svg";
  const subtype = mimeType.split("/")[1]?.split("+")[0]?.toLowerCase();
  return subtype && /^[a-z0-9]+$/.test(subtype) ? subtype : "img";
}

function decodeBase64(payload: string) {
  if (typeof atob === "function") {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  const bufferCtor = (globalThis as unknown as { Buffer?: { from(value: string, encoding: "base64"): Uint8Array } }).Buffer;
  if (bufferCtor) return Uint8Array.from(bufferCtor.from(payload, "base64"));
  throw new Error("receiz_media_base64_decoder_unavailable");
}

function decodeTextPayload(payload: string) {
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(INLINE_IMAGE_DATA_URL);
  if (!match) throw new Error("receiz_media_invalid_data_url");

  const mimeType = match[1].toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const bytes = isBase64 ? decodeBase64(payload) : decodeTextPayload(payload);

  return {
    blob: new Blob([bytes], { type: mimeType }),
    extension: extensionForMime(mimeType),
    mimeType
  };
}

function mediaPurpose(path: string[]) {
  const joined = path.join(".");

  if (joined === "brand.logoImageUrl") return "store.logo";
  if (/^products\.\d+\.(imageUrl|seo\.socialImageUrl)$/.test(joined)) return "product.image";
  if (/^blogPosts\.\d+\.(coverImageUrl|seo\.socialImageUrl)$/.test(joined)) return "blog.cover";
  if (/^pages\.\d+\.seo\.socialImageUrl$/.test(joined)) return "page.social";
  if (joined.includes(".seo.socialImageUrl")) return "seo.social";

  return "store.media";
}

function filenameFor(path: string[], extension: string, hash: string) {
  const label = path
    .join("-")
    .replace(/\d+/g, "item")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${label || "media"}-${hash}.${extension}`;
}

function findMediaUrl(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  if (typeof value === "string") return value.startsWith("data:") ? null : value;
  if (!isRecord(value)) return null;

  for (const key of MEDIA_URL_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && !candidate.startsWith("data:")) {
      return candidate;
    }
  }

  for (const key of ["media", "asset", "file", "image", "result"]) {
    const nested = findMediaUrl(value[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

function findNestedRecord(value: unknown, keys: string[], depth = 0): Record<string, unknown> | null {
  if (depth > 4 || !isRecord(value)) return null;

  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) return candidate;
  }

  for (const candidate of Object.values(value)) {
    const nested = findNestedRecord(candidate, keys, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function findStringByKeys(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 4) return null;
  if (!isRecord(value)) return null;

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  for (const candidate of Object.values(value)) {
    const nested = findStringByKeys(candidate, keys, depth + 1);
    if (nested) return nested;
  }

  return null;
}

async function stableHash(value: string) {
  const input = new TextEncoder().encode(value);
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    return `${input.byteLength.toString(16)}${value.slice(0, 16).replace(/[^a-z0-9]/gi, "")}`.slice(0, 20);
  }

  const digest = await subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function dataUrlHash(value: string) {
  return `sha256:${await stableHash(value)}`;
}

async function blobToDataUrl(blob: Blob) {
  if (typeof FileReader !== "undefined") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("receiz_media_read_failed"));
      });
      reader.addEventListener("error", () => reject(new Error("receiz_media_read_failed")));
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const bufferCtor = (globalThis as unknown as { Buffer?: { from(value: Uint8Array): { toString(encoding: "base64"): string } } }).Buffer;
  const encoded = typeof btoa === "function" ? btoa(binary) : bufferCtor?.from(bytes).toString("base64");
  if (!encoded) throw new Error("receiz_media_base64_encoder_unavailable");
  return `data:${blob.type || "application/octet-stream"};base64,${encoded}`;
}

function drawImageToCanvas(image: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("receiz_media_canvas_unavailable");
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function loadImageSource(blob: Blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new Error("receiz_media_image_loader_unavailable");
  }

  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("receiz_media_image_loader_failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement) {
  return {
    width: source.width,
    height: source.height
  };
}

export async function compressInlineImageDataUrlForPublish(
  dataUrl: string,
  _path: string[],
  maxChars = PUBLISH_INLINE_MEDIA_ITEM_MAX_CHARS
) {
  if (dataUrl.length <= maxChars) return dataUrl;
  if (typeof document === "undefined") return null;

  const { blob, mimeType } = dataUrlToBlob(dataUrl);
  if (mimeType === "image/svg+xml") return dataUrl.length <= maxChars ? dataUrl : null;

  const image = await loadImageSource(blob);
  const { width, height } = sourceSize(image);
  const largestSide = Math.max(width, height);
  const dimensions = [960, 720, 540, 420, 320, 240];
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];

  try {
    for (const maxSide of dimensions) {
      const scale = largestSide > maxSide ? maxSide / largestSide : 1;
      const nextWidth = Math.max(1, Math.round(width * scale));
      const nextHeight = Math.max(1, Math.round(height * scale));
      const canvas = drawImageToCanvas(image, nextWidth, nextHeight);

      for (const quality of qualities) {
        const webp = await canvasToBlob(canvas, "image/webp", quality);
        if (webp) {
          const webpDataUrl = await blobToDataUrl(webp);
          if (webpDataUrl.length <= maxChars) return webpDataUrl;
        }

        const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
        if (jpeg) {
          const jpegDataUrl = await blobToDataUrl(jpeg);
          if (jpegDataUrl.length <= maxChars) return jpegDataUrl;
        }
      }
    }
  } finally {
    if ("close" in image && typeof image.close === "function") {
      image.close();
    }
  }

  return null;
}

function mediaProofReferenceFromUpload(
  response: unknown,
  mediaUrl: string | null,
  sourceHashSha256: string
): MediaProofReference {
  const proof = findNestedRecord(response, ["proof", "appendProof", "proofBundle", "bundle"]);
  const media = findNestedRecord(response, ["media", "asset", "file", "image", "result"]);
  const proofObjectId =
    findStringByKeys(proof, PROOF_ID_KEYS) ||
    findStringByKeys(media, PROOF_ID_KEYS) ||
    findStringByKeys(response, PROOF_ID_KEYS) ||
    sourceHashSha256;

  return {
    schema: "receiz.media_proof_reference.v1",
    proofObjectId,
    sourceHashSha256,
    mediaUrl,
    kaiPulse:
      findStringByKeys(response, ["kaiPulse", "kaiPulseEternal", "kai", "pulse"]) ??
      findStringByKeys(proof, ["kaiPulse", "kaiPulseEternal", "kai", "pulse"]),
    appendAnchorId:
      findStringByKeys(response, ["appendAnchorId", "anchorId"]) ??
      findStringByKeys(proof, ["appendAnchorId", "anchorId"]),
    proof: proof ?? null
  };
}

function applyMediaProofReference(root: unknown, path: string[], reference: MediaProofReference) {
  if (!isRecord(root)) return;

  const [topLevel, index, field, nestedField] = path;

  if (topLevel === "brand" && field === undefined && path[1] === "logoImageUrl") {
    (root as CommerceState).brand.logoImageProof = reference;
    return;
  }

  if (topLevel === "products" && typeof index === "string" && field === "imageUrl") {
    const product = (root as CommerceState).products[Number(index)] as Product | undefined;
    if (product) product.imageProof = reference;
    return;
  }

  if (topLevel === "products" && typeof index === "string" && field === "seo" && nestedField === "socialImageUrl") {
    const product = (root as CommerceState).products[Number(index)] as Product | undefined;
    if (product?.seo) product.seo.socialImageProof = reference;
    return;
  }

  if (topLevel === "blogPosts" && typeof index === "string" && field === "coverImageUrl") {
    const post = (root as CommerceState).blogPosts[Number(index)] as BlogPost | undefined;
    if (post) post.coverImageProof = reference;
    return;
  }

  if (topLevel === "blogPosts" && typeof index === "string" && field === "seo" && nestedField === "socialImageUrl") {
    const post = (root as CommerceState).blogPosts[Number(index)] as BlogPost | undefined;
    if (post?.seo) post.seo.socialImageProof = reference;
  }
}

async function uploadInlineImage(
  dataUrl: string,
  path: string[],
  options: PreparePublishPayloadMediaOptions
): Promise<{ mediaUrl: string; proofReference: MediaProofReference } | null> {
  if (!options.upload) return null;

  const { blob, extension, mimeType } = dataUrlToBlob(dataUrl);
  const hash = await stableHash(`${options.tenantHost}:${path.join(".")}:${dataUrl}`);
  const sourceHashSha256 = await dataUrlHash(dataUrl);
  const response = await options.upload(blob, {
    tenantHost: options.tenantHost,
    purpose: mediaPurpose(path),
    filename: filenameFor(path, extension, hash),
    idempotencyKey: `receiz-media:${options.tenantHost}:${hash}`,
    metadata: {
      path: path.join("."),
      merchantReceizId: options.merchantReceizId,
      mimeType
    }
  });

  if (isRecord(response) && response.ok === false) {
    throw new Error(String(response.error ?? "receiz_media_upload_failed"));
  }

  const mediaUrl = findMediaUrl(response);
  if (!mediaUrl) throw new Error(`receiz_media_url_missing:${path.join(".")}`);

  return {
    mediaUrl,
    proofReference: mediaProofReferenceFromUpload(response, mediaUrl, sourceHashSha256)
  };
}

function shouldDropInlineMediaPath(path: string[]) {
  return path.at(-1) === "socialImageUrl";
}

function stripInlineMediaForRequestBudget<T>(value: T): T {
  if (typeof value === "string") {
    return (isInlineImageDataUrl(value) ? null : value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripInlineMediaForRequestBudget(item)) as T;
  }

  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, stripInlineMediaForRequestBudget(item)])
  ) as T;
}

export async function prepareStoreStateMediaForPublishPayload(
  state: CommerceState,
  options: PreparePublishPayloadMediaOptions
): Promise<PreparedPublishPayloadMedia> {
  const itemMaxChars = options.itemMaxChars ?? PUBLISH_INLINE_MEDIA_ITEM_MAX_CHARS;
  const totalMaxChars = options.totalMaxChars ?? PUBLISH_INLINE_MEDIA_TOTAL_MAX_CHARS;
  const uploaded = new Map<string, Promise<{ mediaUrl: string; proofReference: MediaProofReference } | null>>();
  const proofReferences: Array<{ path: string[]; reference: MediaProofReference }> = [];
  const warnings = new Set<string>();
  const counters = {
    uploaded: 0,
    compressed: 0,
    stripped: 0,
    inlineChars: 0
  };

  const admitInline = (value: string) => {
    if (value.length > itemMaxChars) return false;
    if (counters.inlineChars + value.length > totalMaxChars) return false;
    counters.inlineChars += value.length;
    return true;
  };

  const replace = async (value: unknown, path: string[]): Promise<unknown> => {
    if (typeof value === "string") {
      if (!isInlineImageDataUrl(value)) return value;
      if (shouldDropInlineMediaPath(path)) {
        counters.stripped += 1;
        return null;
      }

      try {
        let uploadedUrl = uploaded.get(value);
        if (!uploadedUrl && options.upload) {
          uploadedUrl = uploadInlineImage(value, path, options);
          uploaded.set(value, uploadedUrl);
        }

        if (uploadedUrl) {
          const media = await uploadedUrl;
          if (media) {
            counters.uploaded += 1;
            proofReferences.push({ path, reference: media.proofReference });
            return media.mediaUrl;
          }
        }
      } catch (error) {
        warnings.add(error instanceof Error ? error.message : "receiz_media_upload_failed");
      }

      if (options.compress) {
        try {
          const compressed = await options.compress(value, path, itemMaxChars);
          if (compressed && !compressed.startsWith("data:")) {
            counters.compressed += 1;
            return compressed;
          }
          if (compressed && admitInline(compressed)) {
            counters.compressed += 1;
            return compressed;
          }
        } catch (error) {
          warnings.add(error instanceof Error ? error.message : "receiz_media_compress_failed");
        }
      }

      if (admitInline(value)) return value;

      counters.stripped += 1;
      return null;
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map((item, index) => replace(item, [...path, String(index)])));
    }

    if (!isRecord(value)) return value;

    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await replace(item, [...path, key])] as const)
    );

    return Object.fromEntries(entries);
  };

  const preparedState = (await replace(structuredClone(state), [])) as CommerceState;

  for (const { path, reference } of proofReferences) {
    applyMediaProofReference(preparedState, path, reference);
  }

  return {
    state: preparedState,
    uploaded: counters.uploaded,
    compressed: counters.compressed,
    stripped: counters.stripped,
    inlineChars: counters.inlineChars,
    warnings: Array.from(warnings)
  };
}

export async function preparePublishRequestBody<TStatePayload>({
  action,
  extra = {},
  maxBodyChars = PUBLISH_REQUEST_BODY_MAX_CHARS,
  media,
  merchantProof,
  state,
  statePayload
}: PreparePublishRequestBodyOptions<TStatePayload>): Promise<PreparedPublishRequestBody<TStatePayload>> {
  const buildBody = (payloadState: TStatePayload) => ({
    ...extra,
    action,
    merchantProof,
    state: payloadState
  }) as PreparedPublishRequestBody<TStatePayload>;
  const strippedPayload = statePayload(stripInlineMediaForRequestBudget(state));
  const strippedBodyChars = JSON.stringify(buildBody(strippedPayload)).length;
  const reservedForEnvelope = Math.max(0, strippedBodyChars + 8_192);
  const envelopeMediaBudget = Math.max(0, maxBodyChars - reservedForEnvelope);
  const prepared = await prepareStoreStateMediaForPublishPayload(state, {
    ...media,
    totalMaxChars: Math.min(media.totalMaxChars ?? PUBLISH_INLINE_MEDIA_TOTAL_MAX_CHARS, envelopeMediaBudget)
  });
  let body = buildBody(statePayload(prepared.state));
  let serializedBody = JSON.stringify(body);

  if (serializedBody.length > maxBodyChars) {
    const stripped = await prepareStoreStateMediaForPublishPayload(state, {
      ...media,
      itemMaxChars: 0,
      totalMaxChars: 0
    });
    body = buildBody(statePayload(stripInlineMediaForRequestBudget(stripped.state)));
    serializedBody = JSON.stringify(body);
  }

  assertPublishRequestBodySize(serializedBody, maxBodyChars);
  return body;
}

export function assertPublishRequestBodySize(
  serializedBody: string,
  maxBodyChars = PUBLISH_REQUEST_BODY_MAX_CHARS
) {
  if (serializedBody.length <= maxBodyChars) return;

  throw new Error(
    "Publish media is still too large after Receiz media preparation. Remove or replace the largest image, then publish again."
  );
}

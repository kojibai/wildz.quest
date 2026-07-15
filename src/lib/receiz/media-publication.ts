import { createHash } from "node:crypto";
import type {
  JsonObject,
  ReceizMediaUploadOptions,
  ReceizMediaUploadResponse
} from "@receiz/sdk";
import type { CommerceState } from "@/types/domain";

export type ReceizMediaUploadLike = (
  file: Blob,
  options?: ReceizMediaUploadOptions
) => Promise<ReceizMediaUploadResponse | JsonObject>;

type PrepareStoreMediaOptions = {
  merchantReceizId?: string;
  tenantHost: string;
  upload: ReceizMediaUploadLike;
};

const INLINE_IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+)(;base64)?,([\s\S]*)$/i;

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

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(INLINE_IMAGE_DATA_URL);
  if (!match) throw new Error("receiz_media_invalid_data_url");

  const mimeType = match[1].toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

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

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
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
  if (typeof value === "string") {
    return value.startsWith("data:") ? null : value;
  }
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

async function uploadInlineImage(
  dataUrl: string,
  path: string[],
  options: PrepareStoreMediaOptions
) {
  const { blob, extension, mimeType } = dataUrlToBlob(dataUrl);
  const hash = stableHash(`${options.tenantHost}:${path.join(".")}:${dataUrl}`);
  const purpose = mediaPurpose(path);
  const response = await options.upload(blob, {
    tenantHost: options.tenantHost,
    purpose,
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

  return mediaUrl;
}

async function replaceInlineMedia(
  value: unknown,
  path: string[],
  options: PrepareStoreMediaOptions,
  uploaded: Map<string, Promise<string>>
): Promise<unknown> {
  if (typeof value === "string") {
    if (!isInlineImageDataUrl(value)) return value;
    const cached = uploaded.get(value);
    if (cached) return cached;
    const mediaUrl = uploadInlineImage(value, path, options);
    uploaded.set(value, mediaUrl);
    return mediaUrl;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item, index) => replaceInlineMedia(item, [...path, String(index)], options, uploaded)));
  }

  if (!isRecord(value)) return value;

  const entries = await Promise.all(
    Object.entries(value).map(async ([key, item]) => [
      key,
      await replaceInlineMedia(item, [...path, key], options, uploaded)
    ] as const)
  );

  return Object.fromEntries(entries);
}

export async function prepareStoreStateMediaForPublish(
  state: CommerceState,
  options: PrepareStoreMediaOptions
): Promise<CommerceState> {
  return replaceInlineMedia(state, [], options, new Map()) as Promise<CommerceState>;
}

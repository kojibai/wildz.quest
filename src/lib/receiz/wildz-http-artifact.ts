const SAFE_FILENAME = /^[a-zA-Z0-9._-]{1,220}$/;

function artifactFilename(value: string | null | undefined, fallback: string) {
  const decoded = (() => {
    if (!value) return "";
    try { return decodeURIComponent(value); } catch { return ""; }
  })();
  return SAFE_FILENAME.test(decoded) ? decoded : fallback;
}

export function wildzBinaryArtifactHeaders(file: Pick<File, "name" | "type">) {
  return {
    "content-type": file.type || "application/octet-stream",
    "x-wildz-artifact-filename": encodeURIComponent(file.name)
  };
}

export async function readWildzHttpArtifact(
  request: Request,
  input: Readonly<{ fallbackFilename: string; maximumBytes: number }>
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new Error("wildz_artifact_upload_malformed");
    }
    const value = form.get("file");
    if (!(value instanceof Blob) || value.size <= 0 || value.size > input.maximumBytes) {
      throw new Error("wildz_artifact_upload_invalid");
    }
    const filename = value instanceof File
      ? artifactFilename(encodeURIComponent(value.name), input.fallbackFilename)
      : input.fallbackFilename;
    return {
      bytes: new Uint8Array(await value.arrayBuffer()),
      filename,
      mimeType: value.type || "application/octet-stream",
      form
    };
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > input.maximumBytes) {
    throw new Error("wildz_artifact_upload_invalid");
  }
  return {
    bytes,
    filename: artifactFilename(request.headers.get("x-wildz-artifact-filename"), input.fallbackFilename),
    mimeType: contentType.split(";", 1)[0]?.trim() || "application/octet-stream",
    form: null
  };
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function joinBytes(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/**
 * Emits a fixed-length multipart body. This avoids runtime-dependent streamed
 * FormData framing when Wildz forwards exact proof bytes to Receiz.
 */
export function encodeWildzMultipartFile(input: Readonly<{
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  fields?: Readonly<Record<string, string>>;
}>) {
  const seed = crypto.randomUUID().replaceAll("-", "");
  const boundary = `wildz-${seed}`;
  const escapedName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 220) || "artifact";
  const parts: Uint8Array[] = [];
  for (const [name, value] of Object.entries(input.fields ?? {})) {
    parts.push(utf8(`--${boundary}\r\nContent-Disposition: form-data; name="${name.replace(/[^a-zA-Z0-9_-]/g, "")}"\r\n\r\n${value}\r\n`));
  }
  parts.push(utf8(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${escapedName}"\r\nContent-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`));
  parts.push(input.bytes.slice());
  parts.push(utf8(`\r\n--${boundary}--\r\n`));
  const body = joinBytes(parts);
  return {
    body,
    headers: {
      "content-length": String(body.byteLength),
      "content-type": `multipart/form-data; boundary=${boundary}`
    }
  };
}

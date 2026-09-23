export const CSP_NONCE_REQUEST_HEADER = "x-nonce";
export const CSP_NONCE_META_NAME = "receiz-csp-nonce";

export function readCspNonceFromDocument(doc: Document | null = typeof document === "undefined" ? null : document): string | null {
  if (!doc) return null;
  const meta = doc.head.querySelector<HTMLMetaElement>(`meta[name="${CSP_NONCE_META_NAME}"]`);
  const nonce = meta?.content?.trim() ?? "";
  return nonce || null;
}

export function applyCspNonce<T extends HTMLScriptElement>(element: T, doc?: Document | null): T {
  const nonce = readCspNonceFromDocument(doc);
  if (nonce) {
    element.nonce = nonce;
  }
  return element;
}

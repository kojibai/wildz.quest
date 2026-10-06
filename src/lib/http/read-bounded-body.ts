export class RequestBodyTooLargeError extends Error {
    constructor() { super('request_body_too_large'); this.name = 'RequestBodyTooLargeError'; }
}
/** Cap wire bytes before decoding; Content-Length is only an early rejection hint. */
export async function readBoundedRequestText(request: Readonly<{
    body: ReadableStream<Uint8Array> | null;
    headers: Pick<Headers, 'get'>;
    signal: AbortSignal;
}>, maximumBytes: number): Promise<string> {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0)
        throw Error('request_body_limit_invalid');
    const declared = request.headers.get('content-length');
    if (declared !== null && /^[0-9]+$/.test(declared)) {
        const significant = declared.replace(/^0+/, '') || '0', maximum = String(maximumBytes);
        if (significant.length > maximum.length || significant.length === maximum.length && significant > maximum) {
            if (request.body)
                void request.body.cancel().catch(() => { });
            throw new RequestBodyTooLargeError();
        }
    }
    if (request.signal.aborted) {
        if (request.body)
            void request.body.cancel().catch(() => { });
        request.signal.throwIfAborted();
    }
    if (!request.body)
        return '';
    const reader = request.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), parts: string[] = [];
    let bytes = 0, completed = false, cancelled = false;
    const cancel = () => { if (!cancelled && !completed) {
        cancelled = true;
        void reader.cancel().catch(() => { });
    } };
    request.signal.addEventListener('abort', cancel, { once: true });
    try {
        while (true) {
            request.signal.throwIfAborted();
            const chunk = await reader.read();
            request.signal.throwIfAborted();
            if (chunk.done) {
                completed = true;
                parts.push(decoder.decode());
                return parts.join('');
            }
            bytes += chunk.value.byteLength;
            if (bytes > maximumBytes) {
                cancel();
                throw new RequestBodyTooLargeError();
            }
            parts.push(decoder.decode(chunk.value, { stream: true }));
        }
    }
    finally {
        request.signal.removeEventListener('abort', cancel);
        if (!completed)
            cancel();
        reader.releaseLock();
    }
}

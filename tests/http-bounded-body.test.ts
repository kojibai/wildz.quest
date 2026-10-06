import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBoundedRequestText, RequestBodyTooLargeError } from '../src/lib/http/read-bounded-body';
function fixture(chunks: readonly Uint8Array[], length?: string) {
    let reads = 0, cancelled = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { if (reads >= chunks.length) {
            controller.close();
            return;
        } controller.enqueue(chunks[reads++]); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    const request = { body, headers: new Headers(length ? { 'content-length': length } : {}), signal: new AbortController().signal };
    return { request, reads: () => reads, cancelled: () => cancelled };
}
test('request byte cap rejects and cancels before reading the remainder of an oversized stream', async () => {
    const f = fixture([new Uint8Array(4), new Uint8Array(5), new Uint8Array(10000)]);
    await assert.rejects(readBoundedRequestText(f.request, 8), RequestBodyTooLargeError);
    assert.equal(f.reads(), 2);
    assert.equal(f.cancelled(), 1);
});
test('declared over-limit body is rejected without pulling or decoding any chunk', async () => {
    const f = fixture([new Uint8Array(10000)], '10000');
    await assert.rejects(readBoundedRequestText(f.request, 8), RequestBodyTooLargeError);
    assert.equal(f.reads(), 0);
    assert.equal(f.cancelled(), 1);
});
test('byte cap counts multibyte UTF8 and survives split code points', async () => {
    const bytes = new TextEncoder().encode('🌿🌿');
    const good = fixture([bytes.slice(0, 2), bytes.slice(2, 5), bytes.slice(5)]);
    assert.equal(await readBoundedRequestText(good.request, 8), '🌿🌿');
    assert.equal(good.cancelled(), 0);
    const bad = fixture([bytes]);
    await assert.rejects(readBoundedRequestText(bad.request, 7), RequestBodyTooLargeError);
    assert.equal(bad.cancelled(), 1);
});
test('missing or dishonest content length cannot bypass the streaming cap', async () => {
    for (const length of [undefined, '1', 'broken']) {
        const f = fixture([new Uint8Array(10)], length);
        await assert.rejects(readBoundedRequestText(f.request, 8), RequestBodyTooLargeError);
    }
});
test('bounded body handles empty input, aborted requests and read errors without leaking a lock', async () => {
    const f = fixture([]);
    assert.equal(await readBoundedRequestText(f.request, 8), '');
    assert.equal(f.request.body.locked, false);
    const signal = AbortSignal.abort();
    const aborted = fixture([new Uint8Array(5)]);
    await assert.rejects(readBoundedRequestText({ ...aborted.request, signal }, 8));
    assert.equal(aborted.reads(), 0);
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({ pull() { throw Error('broken stream'); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    await assert.rejects(readBoundedRequestText({ body, headers: new Headers(), signal: new AbortController().signal }, 8), /broken stream/);
    assert.equal(body.locked, false);
    assert.ok(cancelled <= 1);
});
test('the creation POST returns 413 before unauthenticated oversized input is fully buffered', async () => {
    const { NextRequest } = await import('next/server');
    const { POST } = await import('../app/api/wilds/creation/propose/route');
    let pulled = 0, cancelled = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(524289)); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    const request = new NextRequest('http://localhost/api/wilds/creation/propose', { method: 'POST', body, duplex: 'half' } as ConstructorParameters<typeof NextRequest>[1]);
    const response = await POST(request);
    assert.equal(response.status, 413);
    assert.equal((await response.json()).status, 'blocked');
    assert.equal(pulled, 2);
    assert.equal(cancelled, 1);
});

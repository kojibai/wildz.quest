import { creationRenderUploadBytes } from './render-geometry';
import type { CreationChunk } from './compiler';
import type { CreationResidencyBudget, CreationResidentChunk } from './chunks';
import { validateCreationResidencyBudget } from './residency';
export function createCreationUploadScheduler(input: Readonly<{
    budget: CreationResidencyBudget;
    upload: (chunk: CreationChunk) => CreationResidentChunk;
    dispose: (chunk: CreationResidentChunk) => void;
}>) {
    validateCreationResidencyBudget(input.budget);
    let budget = input.budget;
    type Job = {
        key: string;
        chunk: CreationChunk;
        bytes: number;
    };
    let queue: Job[] = [];
    const active = new Map<string, {
        key: string;
        value: CreationResidentChunk;
    }>(), failed: string[] = [];
    const cancel = (key: string) => {
        queue = queue.filter(j => j.key !== key);
        for (const [id, r] of active)
            if (r.key === key) {
                active.delete(id);
                input.dispose(r.value);
            }
    };
    const view = () => ({ uploadedBytes: 0, active: [...active.values()].map(r => r.value), queued: queue.length, failed: [...failed] });
    return { get budget() { return budget; }, get queued() { return queue.length; }, paintSnapshot: view, retain(compatible: (chunk: CreationChunk) => boolean) {
            queue = queue.filter(job => compatible(job.chunk));
            for (const [id, resident] of active)
                if (!compatible(resident.value.chunk)) {
                    active.delete(id);
                    input.dispose(resident.value);
                }
        }, reconfigure(next: CreationResidencyBudget) { validateCreationResidencyBudget(next); const current = [...active.values()]; if (current.length > next.maximumPages || current.reduce((n, r) => n + r.value.chunk.positions.length / 3, 0) > next.maximumVertices || current.reduce((n, r) => n + r.value.chunk.materials.length, 0) > next.maximumDrawCalls || current.reduce((n, r) => n + r.value.textureBytes, 0) > next.maximumTextureBytes)
            throw Error('creation_occupied_residency_exceeded'); budget = next; }, enqueue(key: string, chunks: readonly CreationChunk[]) {
            if (!key || key.length > 512 || chunks.length > 128 || new Set(chunks.map(c => c.id)).size !== chunks.length)
                throw Error('creation_upload_queue_invalid');
            const jobs = chunks.map(chunk => {
                if (!(chunk.positions instanceof Float32Array) || !(chunk.normals instanceof Float32Array) || chunk.positions.length !== chunk.normals.length || chunk.positions.length % 9)
                    throw Error('creation_upload_geometry_invalid');
                const bytes = creationRenderUploadBytes(chunk);
                if (bytes > budget.maximumUploadBytesPerPaint)
                    throw Error('creation_upload_page_too_large');
                return { key, chunk, bytes };
            });
            if (queue.filter(j => j.key !== key).length + jobs.length > 128)
                throw Error('creation_upload_queue_budget');
            cancel(key);
            queue.push(...jobs);
        }, cancel,
        paint() {
            let uploadedBytes = 0;
            const sums = () => [...active.values()].reduce((a, r) => ({ vertices: a.vertices + r.value.chunk.positions.length / 3, calls: a.calls + r.value.chunk.materials.length, textures: a.textures + r.value.textureBytes }), { vertices: 0, calls: 0, textures: 0 });
            while (queue.length) {
                const job = queue[0], totals = sums();
                if (uploadedBytes + job.bytes > budget.maximumUploadBytesPerPaint || active.size >= budget.maximumPages || totals.vertices + job.chunk.positions.length / 3 > budget.maximumVertices || totals.calls + job.chunk.materials.length > budget.maximumDrawCalls)
                    break;
                queue.shift();
                uploadedBytes += job.bytes;
                let resident: CreationResidentChunk | undefined;
                try {
                    resident = input.upload(job.chunk);
                    if (resident.chunk !== job.chunk || !resident.renderReady || !resident.physicsReady || !Number.isSafeInteger(resident.textureBytes) || resident.textureBytes < 0 || totals.textures + resident.textureBytes > budget.maximumTextureBytes)
                        throw Error('creation_upload_bundle_incompatible');
                    active.set(`${job.key}:${job.chunk.id}`, { key: job.key, value: resident });
                }
                catch {
                    if (resident)
                        input.dispose(resident);
                    failed.push(job.chunk.id);
                    if (failed.length > 128)
                        failed.shift();
                }
            }
            return { uploadedBytes, active: [...active.values()].map(r => r.value), queued: queue.length, failed: [...failed] };
        }, close() {
            for (const r of active.values())
                input.dispose(r.value);
            active.clear();
            queue = [];
        }
    };
}

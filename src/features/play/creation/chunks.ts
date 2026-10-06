import type { CreationBounds } from './geometry';
import type { CreationChunk } from './compiler';
export type CreationPageRef = Readonly<{
    pageId: string;
    head: string;
    worldId: string;
    spaceId: string;
    bounds: CreationBounds;
    nodeIds: readonly string[];
    dependencies: readonly string[];
    vertices: number;
    drawCalls: number;
    textureBytes: number;
    uploadBytes: number;
}>;
export type CreationResidencyBudget = Readonly<{
    maximumPages: number;
    maximumVertices: number;
    maximumDrawCalls: number;
    maximumTextureBytes: number;
    maximumUploadBytesPerPaint: number;
}>;
export type CreationResidentChunk = Readonly<{
    chunk: CreationChunk;
    renderReady: boolean;
    physicsReady: boolean;
    textureBytes: number;
}>;

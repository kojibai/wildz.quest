export type PanelPoint = Readonly<{ x: number; y: number }>;
export function clampPanelPosition(point: PanelPoint, size: { width: number; height: number }, viewport: { width: number; height: number }): PanelPoint {
 return { x: Math.max(8, Math.min(point.x, Math.max(8, viewport.width-size.width-8))), y: Math.max(8, Math.min(point.y, Math.max(8, viewport.height-size.height-8))) };
}

export type CreatureDrawerMode = "closed" | "preview" | "expanded";
export type CreatureDrawerSnap = CreatureDrawerMode;

export type CreatureDrawerMetrics = Record<CreatureDrawerSnap, number>;

const SNAP_ORDER: readonly CreatureDrawerSnap[] = ["closed", "preview", "expanded"];
const BOOK_PAGE_SIZE = 8;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function creatureDrawerMetrics(viewportHeight: number, safeBottom = 0): CreatureDrawerMetrics {
  const safeViewport = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const safeInset = Number.isFinite(safeBottom) ? Math.max(0, safeBottom) : 0;
  const available = clamp(Math.round((safeViewport - safeInset) * 0.52), 300, 438);
  return {
    closed: 32,
    preview: Math.min(132, available),
    expanded: available
  };
}

export function creatureDrawerMode(height: number, metrics: CreatureDrawerMetrics): CreatureDrawerMode {
  const safeHeight = clamp(Number.isFinite(height) ? height : metrics.closed, metrics.closed, metrics.expanded);
  if (safeHeight < (metrics.closed + metrics.preview) / 2) return "closed";
  if (safeHeight < (metrics.preview + metrics.expanded) / 2) return "preview";
  return "expanded";
}

export function settleCreatureDrawer(
  height: number,
  velocityY: number,
  metrics: CreatureDrawerMetrics
): CreatureDrawerSnap {
  const current = creatureDrawerMode(height, metrics);
  const currentIndex = SNAP_ORDER.indexOf(current);
  if (velocityY <= -0.45) return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, currentIndex + 1)];
  if (velocityY >= 0.45) return SNAP_ORDER[Math.max(0, currentIndex - 1)];

  return SNAP_ORDER.reduce((closest, candidate) => (
    Math.abs(metrics[candidate] - height) < Math.abs(metrics[closest] - height) ? candidate : closest
  ), "closed");
}

export function drawerHapticPattern(previous: CreatureDrawerSnap, next: CreatureDrawerSnap): number[] {
  if (previous === next) return [];
  return next === "expanded" ? [9, 28, 14] : [9];
}

export type CreatureBookWindow<Item> = {
  page: number;
  pageSize: 8;
  pageCount: number;
  windowStartPage: number;
  windowEndPage: number;
  visible: Item[];
};

export function creatureBookWindow<Item>(
  items: readonly Item[],
  requestedPage: number,
  overscanPages = 1
): CreatureBookWindow<Item> {
  const pageCount = Math.max(1, Math.ceil(items.length / BOOK_PAGE_SIZE));
  const page = clamp(Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0, 0, pageCount - 1);
  const overscan = clamp(Number.isFinite(overscanPages) ? Math.trunc(overscanPages) : 0, 0, 2);
  const windowStartPage = Math.max(0, page - overscan);
  const windowEndPage = Math.min(pageCount, page + overscan + 1);

  return {
    page,
    pageSize: BOOK_PAGE_SIZE,
    pageCount,
    windowStartPage,
    windowEndPage,
    visible: items.slice(windowStartPage * BOOK_PAGE_SIZE, windowEndPage * BOOK_PAGE_SIZE)
  };
}

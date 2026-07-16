export type CreatureDrawerMode = "closed" | "rail" | "grid" | "book";
export type CreatureDrawerSnap = CreatureDrawerMode;

export type CreatureDrawerMetrics = Record<CreatureDrawerSnap, number>;

const SNAP_ORDER: readonly CreatureDrawerSnap[] = ["closed", "rail", "grid", "book"];
const BOOK_PAGE_SIZE = 8;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function creatureDrawerMetrics(viewportHeight: number): CreatureDrawerMetrics {
  const safeViewport = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const available = clamp(Math.round(safeViewport * 0.54), 300, 480);
  return {
    closed: 0,
    rail: Math.min(112, available),
    grid: Math.min(268, available),
    book: available
  };
}

export function creatureDrawerMode(height: number, metrics: CreatureDrawerMetrics): CreatureDrawerMode {
  const safeHeight = clamp(Number.isFinite(height) ? height : 0, metrics.closed, metrics.book);
  if (safeHeight < (metrics.closed + metrics.rail) / 2) return "closed";
  if (safeHeight < (metrics.rail + metrics.grid) / 2) return "rail";
  if (safeHeight < (metrics.grid + metrics.book) / 2) return "grid";
  return "book";
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

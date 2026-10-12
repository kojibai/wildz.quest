// The SDK barrel and valuation entry share modules. A page-only split chunk
// can otherwise contain a module still referenced by Webpack's worker barrel.
// Keep only this named worker's graph together; preserve all page/other worker
// selectors and code splitting. These modules remain in the worker, not on the
// gameplay thread, and no global limit on shared chunks is introduced.
export function isolateMarketValueWorker(splitChunks) {
  if (!splitChunks || typeof splitChunks !== 'object') return;
  const exclude = selector => chunk => {
    if (chunk.name === 'wildz-market-value') return false;
    if (typeof selector === 'function') return selector(chunk);
    if (selector === 'initial') return chunk.canBeInitial();
    if (selector === 'async') return !chunk.canBeInitial();
    if (selector instanceof RegExp) return selector.test(chunk.name ?? '');
    return true;
  };
  const original = splitChunks.chunks ?? 'async';
  splitChunks.chunks = exclude(original);
  for (const group of Object.values(splitChunks.cacheGroups ?? {})) {
    if (group && typeof group === 'object') group.chunks = exclude(group.chunks ?? original);
  }
}

type QueryCache = {
  queries: Map<string, { evictTimer: number | null; unsub: () => void }>;
  subs: Map<string, string>;
  idle: number;
};

export function clearQueryCache(registry: QueryCache) {
  for (const query of registry.queries.values()) {
    if (query.evictTimer !== null) clearTimeout(query.evictTimer);
    query.unsub();
  }
  registry.queries.clear();
  registry.subs.clear();
  registry.idle = 0;
}

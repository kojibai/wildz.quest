import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

export type RequestLike = Request | {
  headers?: Headers;
  method: string;
  mode: string;
  url: string;
};

type WorkerListener = (event: Record<string, unknown>) => void;

function requestKey(request: RequestInfo | URL | RequestLike) {
  if (typeof request === "string") return new URL(request, "https://wildz.quest").href;
  if (request instanceof URL) return request.href;
  return request.url;
}

function precacheResponse(request: RequestInfo | URL) {
  const key = requestKey(request);
  const pathname = new URL(key).pathname;
  const contentType = pathname === "/offline" || pathname === "/"
    ? "text/html; charset=utf-8"
    : pathname.endsWith(".svg")
      ? "image/svg+xml"
      : "image/png";
  return new Response(`precache:${pathname}`, { headers: { "content-type": contentType } });
}

export function createWorkerHarness(options: {
  cacheNames?: string[];
  fetch?: (request: RequestLike) => Promise<Response>;
  release?: string;
} = {}) {
  const listeners = new Map<string, WorkerListener>();
  const stores = new Map<string, Map<string, Response>>();
  const fetchCalls: RequestLike[] = [];
  let claimed = false;
  let skippedWaiting = false;

  for (const name of options.cacheNames ?? []) stores.set(name, new Map());

  const caches = {
    async open(name: string) {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }
      return {
        async addAll(requests: Array<RequestInfo | URL>) {
          for (const request of requests) {
            store?.set(requestKey(request), precacheResponse(request));
          }
        },
        async match(request: RequestInfo | URL | RequestLike) {
          return store?.get(requestKey(request))?.clone();
        },
        async put(request: RequestInfo | URL | RequestLike, response: Response) {
          store?.set(requestKey(request), response.clone());
        }
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(request: RequestInfo | URL | RequestLike) {
      for (const store of stores.values()) {
        const response = store.get(requestKey(request));
        if (response) return response.clone();
      }
      return undefined;
    }
  };

  const release = options.release ?? "test-release";
  const self = {
    location: {
      href: `https://wildz.quest/sw.js?release=${encodeURIComponent(release)}`,
      origin: "https://wildz.quest"
    },
    clients: {
      async claim() {
        claimed = true;
      }
    },
    addEventListener(type: string, listener: WorkerListener) {
      listeners.set(type, listener);
    },
    async skipWaiting() {
      skippedWaiting = true;
    }
  };

  const fetch = async (request: RequestLike) => {
    fetchCalls.push(request);
    return await (options.fetch ?? (async () => new Response("network")))(request);
  };

  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    Headers,
    Request,
    Response,
    URL,
    caches,
    fetch,
    self
  });

  return {
    caches,
    fetchCalls,
    get claimed() {
      return claimed;
    },
    get skippedWaiting() {
      return skippedWaiting;
    },
    async cacheKeys(name: string) {
      return [...(stores.get(name)?.keys() ?? [])];
    },
    async dispatchExtendable(type: string, details: Record<string, unknown> = {}) {
      const waits: Promise<unknown>[] = [];
      listeners.get(type)?.({
        ...details,
        waitUntil(promise: Promise<unknown>) {
          waits.push(promise);
        }
      });
      await Promise.all(waits);
      return waits.length;
    },
    async dispatchFetch(request: RequestLike) {
      const waits: Promise<unknown>[] = [];
      let responsePromise: Promise<Response> | undefined;
      listeners.get("fetch")?.({
        request,
        respondWith(response: Promise<Response> | Response) {
          responsePromise = Promise.resolve(response);
        },
        waitUntil(promise: Promise<unknown>) {
          waits.push(promise);
        }
      });
      const response = responsePromise ? await responsePromise : undefined;
      await Promise.all(waits);
      return { response, waitCount: waits.length };
    },
    async dispatchMessage(data: unknown) {
      listeners.get("message")?.({ data });
      await Promise.resolve();
    },
    async putCached(name: string, request: RequestInfo | URL | RequestLike, response: Response) {
      const cache = await caches.open(name);
      await cache.put(request, response);
    },
    async readCached(name: string, request: RequestInfo | URL | RequestLike) {
      const cache = await caches.open(name);
      return await cache.match(request);
    }
  };
}

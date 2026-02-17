import { vi } from "vitest";

/**
 * Factory that creates a chainable mock Supabase client.
 * Every query method returns `this` to support chaining.
 * Use `_setResult()` to control what `await` resolves to.
 */
export function createMockSupabaseClient() {
  let _result: { data: unknown; error: unknown; count?: number | null } = {
    data: null,
    error: null,
    count: null,
  };

  let _resultQueue: Array<{ data: unknown; error: unknown; count?: number | null }> = [];

  const client: Record<string, any> = {
    // ── Control ───────────────────────────────────────────────────
    _setResult(result: {
      data?: unknown;
      error?: unknown;
      count?: number | null;
    }) {
      _result = {
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      };
      _resultQueue = [];
      return client;
    },

    /**
     * Set a queue of results for multi-query functions.
     * Each `await` consumes the next result in order.
     */
    _setResults(results: Array<{ data?: unknown; error?: unknown; count?: number | null }>) {
      _resultQueue = results.map((r) => ({
        data: r.data ?? null,
        error: r.error ?? null,
        count: r.count ?? null,
      }));
      return client;
    },

    // ── Thenable (makes `await client.from(...)...` work) ─────────
    then(resolve: (val: any) => void, reject?: (err: any) => void) {
      const result = _resultQueue.length > 0 ? _resultQueue.shift()! : _result;
      return Promise.resolve({
        data: result.data,
        error: result.error,
        count: result.count,
      }).then(resolve, reject);
    },

    // ── Query builder methods (all chainable) ─────────────────────
    from: vi.fn(() => client),
    select: vi.fn(() => client),
    insert: vi.fn(() => client),
    update: vi.fn(() => client),
    upsert: vi.fn(() => client),
    delete: vi.fn(() => client),
    eq: vi.fn(() => client),
    neq: vi.fn(() => client),
    gt: vi.fn(() => client),
    gte: vi.fn(() => client),
    lt: vi.fn(() => client),
    lte: vi.fn(() => client),
    in: vi.fn(() => client),
    is: vi.fn(() => client),
    or: vi.fn(() => client),
    order: vi.fn(() => client),
    limit: vi.fn(() => client),
    range: vi.fn(() => client),
    single: vi.fn(() => client),
    maybeSingle: vi.fn(() => client),

    // ── RPC ───────────────────────────────────────────────────────
    rpc: vi.fn(() => client),

    // ── Auth ──────────────────────────────────────────────────────
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },

    // ── Storage ───────────────────────────────────────────────────
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/img.png" } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };

  return client;
}

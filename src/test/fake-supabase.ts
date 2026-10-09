/**
 * A recording stand-in for the Supabase query builder, for unit tests of the
 * data-access modules (src/lib/orders.ts and friends).
 *
 * It does not interpret filters. Each query is recorded as a {@link FakeOp} and
 * the test's `respond` callback decides what that query returns, which lets a
 * test assert exactly which filters a query carried (e.g. that a sweep is
 * restricted to `payment_method = 'upi'`) without re-implementing Postgres.
 */

export interface FakeFilter {
  kind: string;
  column: string;
  value: unknown;
}

export interface FakeOp {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  filters: FakeFilter[];
  payload?: unknown;
  columns?: string;
  /** `select(cols, { head: true })` - a count-only query. */
  head?: boolean;
  single?: "single" | "maybeSingle";
}

export interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type Responder = (op: FakeOp) => FakeResult | undefined;

type Chain = Record<string, (...args: unknown[]) => unknown>;

export function createFakeSupabase(respond: Responder) {
  const ops: FakeOp[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  function from(table: string): Chain {
    const op: FakeOp = { table, action: "select", filters: [] };

    const finish = (): Promise<{ data: unknown; error: unknown; count: number | null }> => {
      ops.push(op);
      const r = respond(op) ?? {};
      let data = r.data ?? null;
      if (op.single && Array.isArray(data)) data = data[0] ?? null;
      return Promise.resolve({ data, error: r.error ?? null, count: r.count ?? null });
    };

    const chain: Chain = {};
    for (const kind of ["eq", "neq", "in", "lt", "gt", "lte", "gte", "like", "ilike", "is", "or", "not"]) {
      chain[kind] = (column: unknown, value: unknown) => {
        op.filters.push({ kind, column: String(column), value });
        return chain;
      };
    }
    chain.select = (columns: unknown, options?: unknown) => {
      op.columns = typeof columns === "string" ? columns : undefined;
      if ((options as { head?: boolean } | undefined)?.head) op.head = true;
      return chain;
    };
    chain.insert = (payload: unknown) => {
      op.action = "insert";
      op.payload = payload;
      return chain;
    };
    chain.update = (payload: unknown) => {
      op.action = "update";
      op.payload = payload;
      return chain;
    };
    chain.delete = () => {
      op.action = "delete";
      return chain;
    };
    for (const passthrough of ["order", "limit", "range"]) chain[passthrough] = () => chain;
    chain.maybeSingle = () => {
      op.single = "maybeSingle";
      return finish();
    };
    chain.single = () => {
      op.single = "single";
      return finish();
    };
    chain.then = (resolve: unknown, reject: unknown) =>
      finish().then(resolve as never, reject as never);
    return chain;
  }

  const client = {
    from,
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { client, ops, rpcCalls };
}

/** Find the recorded filter on `column`, if any. */
export function filterOn(op: FakeOp, column: string, kind?: string): FakeFilter | undefined {
  return op.filters.find((f) => f.column === column && (!kind || f.kind === kind));
}

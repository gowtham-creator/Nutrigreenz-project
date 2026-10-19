/**
 * A tiny chainable stand-in for the Supabase query builder, for captain tests.
 *
 * Every awaited query is recorded as an `Op` (table, action, payload, filters)
 * and answered by the test's `resolve` callback, so a test can both script the
 * database and assert exactly what was written.
 */
export interface Op {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  options?: unknown;
  filters: Array<[string, ...unknown[]]>;
  single?: "single" | "maybe";
}

export type Resolver = (op: Op) => { data?: unknown; error?: unknown } | undefined;

export function fakeDb(resolve: Resolver) {
  const ops: Op[] = [];
  const from = (table: string) => {
    const op: Op = { table, action: "select", filters: [] };
    let write = false;
    const builder: Record<string, unknown> = {};
    const chain =
      (name: string) =>
      (...args: unknown[]) => {
        op.filters.push([name, ...args]);
        return builder;
      };
    builder.select = () => {
      if (!write) op.action = "select";
      return builder;
    };
    for (const action of ["insert", "update", "upsert"] as const) {
      builder[action] = (payload: unknown, options?: unknown) => {
        write = true;
        op.action = action;
        op.payload = payload;
        op.options = options;
        return builder;
      };
    }
    builder.delete = () => {
      write = true;
      op.action = "delete";
      return builder;
    };
    for (const name of ["eq", "neq", "gte", "not", "in", "order", "limit"]) builder[name] = chain(name);
    builder.single = () => ((op.single = "single"), builder);
    builder.maybeSingle = () => ((op.single = "maybe"), builder);
    builder.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
      ops.push(op);
      const r = resolve(op) ?? {};
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(onOk, onErr);
    };
    return builder;
  };
  return { db: { from }, ops };
}

/** The value of an `.eq(column, value)` filter on an op, if any. */
export function eqOf(op: Op, column: string): unknown {
  return op.filters.find((f) => f[0] === "eq" && f[1] === column)?.[2];
}

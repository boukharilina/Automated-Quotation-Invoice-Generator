import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

export interface Q { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> }
export interface DB extends Q { tx<T>(fn: (q: Q) => Promise<T>): Promise<T> }

const g = globalThis as unknown as { __db?: Promise<DB> };

async function create(): Promise<DB> {
  let db: DB;
  let exec: (sql: string) => Promise<unknown>;
  if (process.env.DATABASE_URL) {
    const pg = await import("pg");
    pg.types.setTypeParser(1082, (v: string) => v);             // date -> 'YYYY-MM-DD'
    pg.types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric -> number
    pg.types.setTypeParser(20, (v: string) => parseInt(v, 10)); // bigint -> number
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 5), idleTimeoutMillis: 10_000 });
    exec = (sql) => pool.query(sql);
    db = {
      query: async (sql, params) => { const r = await pool.query(sql, params); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; },
      tx: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const r = await fn({ query: async (s, p) => { const x = await c.query(s, p); return { rows: x.rows, rowCount: x.rowCount ?? 0 }; } });
          await c.query("COMMIT");
          return r;
        } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
      },
    };
  } else {
    // Embedded PostgreSQL (WASM) for local development without a server.
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = path.join(process.cwd(), "data", "pgdata");
    fs.mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir, {
      parsers: { 1082: (v: string) => v, 1700: (v: string) => parseFloat(v), 20: (v: string) => parseInt(v, 10) },
    });
    await lite.waitReady;
    exec = (sql) => lite.exec(sql);
    db = {
      query: async (sql, params) => { const r = await lite.query(sql, params); return { rows: r.rows as any[], rowCount: r.rows.length || (r.affectedRows ?? 0) }; },
      tx: (fn) => lite.transaction((t) => fn({ query: async (s, p) => { const r = await t.query(s, p); return { rows: r.rows as any[], rowCount: r.rows.length || (r.affectedRows ?? 0) }; } })),
    };
  }
  await exec(SCHEMA);
  const { seed } = await import("./seed");
  await seed(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!g.__db) g.__db = create().catch((e) => { g.__db = undefined; throw e; });
  return g.__db;
}

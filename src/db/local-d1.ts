/**
 * D1 emulation สำหรับ `next dev` บนเครื่องที่รัน workerd ไม่ได้
 *
 * - ใช้เฉพาะตอน development (production ใช้ D1 binding จริง)
 * - ใช้ `process.getBuiltinModule()` เพื่อไม่ให้ bundler ไป resolve `node:sqlite`
 *   (ถ้า import ตรง ๆ ตอน build ขึ้น Cloudflare จะพัง)
 * - API ที่ implement ตรงกับที่ drizzle-orm/d1 เรียกใช้: prepare/bind/run/all/raw/batch
 */

type SqliteValue = string | number | bigint | null | Uint8Array;

type SqliteStatement = {
  all: (...params: SqliteValue[]) => Record<string, unknown>[];
  run: (...params: SqliteValue[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
  setReturnArrays?: (value: boolean) => void;
};

type SqliteDatabase = {
  prepare: (sql: string) => SqliteStatement;
  exec: (sql: string) => void;
};

type SqliteModule = {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const globalKey = "__local_d1__";
const globalStore = globalThis as unknown as Record<string, unknown>;

function getSqliteModule(): SqliteModule {
  const proc = (globalThis as unknown as {
    process?: { getBuiltinModule?: (id: string) => unknown };
  }).process;
  const mod = proc?.getBuiltinModule?.("node:sqlite") as SqliteModule | undefined;
  if (!mod?.DatabaseSync) {
    throw new Error("node:sqlite ไม่พร้อมใช้งาน (ต้องใช้ Node.js 22.5 ขึ้นไป)");
  }
  return mod;
}

function normalizeParam(value: unknown): SqliteValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Uint8Array) return value;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return value;
  return JSON.stringify(value);
}

class LocalPreparedStatement {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): LocalPreparedStatement {
    return new LocalPreparedStatement(this.db, this.sql, params);
  }

  private stmt(): SqliteStatement {
    return this.db.prepare(this.sql);
  }

  private rows(asArrays: boolean): Record<string, unknown>[] {
    const stmt = this.stmt();
    if (asArrays && typeof stmt.setReturnArrays === "function") {
      stmt.setReturnArrays(true);
      return stmt.all(...this.params.map(normalizeParam)) as unknown as Record<
        string,
        unknown
      >[];
    }
    return stmt.all(...this.params.map(normalizeParam));
  }

  async all() {
    const results = this.rows(false);
    return { success: true, results, meta: { rows_read: results.length } };
  }

  async raw() {
    const rows = this.rows(true);
    return rows.map((row) =>
      Array.isArray(row) ? row : Object.values(row as object),
    );
  }

  async first(column?: string) {
    const [row] = this.rows(false);
    if (!row) return null;
    return column ? row[column] : row;
  }

  async run() {
    const info = this.stmt().run(...this.params.map(normalizeParam));
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }

  /** ใช้ภายใน batch เท่านั้น */
  __execute() {
    const results = this.rows(false);
    return { success: true, results, meta: { rows_read: results.length } };
  }
}

export class LocalD1 {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(sql: string): LocalPreparedStatement {
    return new LocalPreparedStatement(this.db, sql);
  }

  async batch(statements: LocalPreparedStatement[]) {
    this.db.exec("BEGIN");
    try {
      const out = statements.map((s) => s.__execute());
      this.db.exec("COMMIT");
      return out;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }

  async dump() {
    throw new Error("dump() ยังไม่รองรับใน local mode");
  }
}

export function getLocalD1(filePath: string): LocalD1 {
  const existing = globalStore[globalKey] as LocalD1 | undefined;
  if (existing) return existing;

  const { DatabaseSync } = getSqliteModule();
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  const instance = new LocalD1(db);
  globalStore[globalKey] = instance;
  return instance;
}

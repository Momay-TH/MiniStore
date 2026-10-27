import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { cache } from "react";
import { getLocalD1 } from "./local-d1";
import * as schema from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

/**
 * Development ในเครื่องนี้ใช้ SQLite (node:sqlite) แทน D1
 * เพราะ workerd (runtime ที่ wrangler ใช้จำลอง D1) crash บนเครื่องนี้
 *
 * Production บน Cloudflare ยังใช้ D1 binding จริงเสมอ
 */
export function isLocalDbMode(): boolean {
  if (process.env.FORCE_D1 === "1") return false;
  return process.env.NODE_ENV !== "production" || process.env.USE_LOCAL_DB === "1";
}

function localDbPath(): string {
  return process.env.LOCAL_DB_PATH ?? `${process.cwd()}/.data/app.db`;
}

function createDb(): AppDb {
  if (isLocalDbMode()) {
    return drizzle(getLocalD1(localDbPath()) as never, { schema });
  }

  const { env } = getCloudflareContext();
  return drizzle(env.DB as unknown as Parameters<typeof drizzle>[0], {
    schema,
  });
}

/**
 * Cloudflare Workers ไม่ให้ reuse connection ข้าม request
 * จึงสร้าง client ใหม่ทุก request (cache() ช่วย reuse ภายใน request เดียว)
 */
export const getDb = cache(createDb);

/** ใช้กับ route ที่เป็น static (ISR/SSG) */
export const getDbAsync = cache(async (): Promise<AppDb> => {
  if (isLocalDbMode()) {
    return drizzle(getLocalD1(localDbPath()) as never, { schema });
  }
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB as unknown as Parameters<typeof drizzle>[0], {
    schema,
  });
});

export { schema };

import { eq, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES = 5;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "local";
}

function throttleKey(username: string, ip: string): string {
  return `${username}|${ip}`;
}

/** คืนข้อความถ้าถูกล็อกอยู่ หรือ null ถ้าล็อกอินต่อได้ */
export async function loginLockedMessage(
  username: string,
  ip: string,
): Promise<string | null> {
  const db = getDb();
  const now = Date.now();
  const row = (
    await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, throttleKey(username, ip)))
      .limit(1)
  )[0];
  if (!row || row.count < MAX_LOGIN_FAILURES) return null;

  const until = row.lastAt + LOCK_MS;
  if (now >= until) return null;

  const minutes = Math.max(1, Math.ceil((until - now) / 60_000));
  return `ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารออีก ${minutes} นาที`;
}

export async function recordLoginFailure(
  username: string,
  ip: string,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const key = throttleKey(username, ip);
  const row = (
    await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, key))
      .limit(1)
  )[0];

  if (!row || now - row.lastAt > WINDOW_MS) {
    await db
      .insert(loginAttempts)
      .values({ key, count: 1, firstAt: now, lastAt: now })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: { count: 1, firstAt: now, lastAt: now },
      });
    return;
  }

  await db
    .update(loginAttempts)
    .set({ count: row.count + 1, lastAt: now })
    .where(eq(loginAttempts.key, key));
}

export async function clearLoginFailures(
  username: string,
  ip: string,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db
    .delete(loginAttempts)
    .where(eq(loginAttempts.key, throttleKey(username, ip)));
  // เก็บกวาดรายการเก่าเป็นครั้งคราว
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.lastAt, now - 24 * 60 * 60 * 1000));
}

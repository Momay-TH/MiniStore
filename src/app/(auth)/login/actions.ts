"use server";

import { eq, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import {
  clearLoginFailures,
  clientIp,
  loginLockedMessage,
  recordLoginFailure,
} from "@/lib/login-throttle";

export type LoginState = { error?: string };

function safeNext(value: unknown): string {
  const next = String(value ?? "");
  if (!next.startsWith("/") || next.startsWith("//")) return "/pos";
  return next;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!username || !password) {
    return { error: "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" };
  }

  const ip = await clientIp();
  const locked = await loginLockedMessage(username, ip);
  if (locked) return { error: locked };

  const db = getDb();
  const row = (
    await db.select().from(users).where(eq(users.username, username)).limit(1)
  )[0];

  const ok = row ? await verifyPassword(password, row.passwordHash) : false;

  if (!row || !ok || row.isActive !== 1) {
    await recordLoginFailure(username, ip);
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  await clearLoginFailures(username, ip);
  // เก็บกวาด session ที่หมดอายุเป็นครั้งคราว
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));

  await createSession(row.id);
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/auth");
  await destroySession();
  redirect("/login");
}

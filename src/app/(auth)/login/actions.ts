"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" };
  }

  const db = getDb();
  const row = (
    await db.select().from(users).where(eq(users.username, username)).limit(1)
  )[0];

  const ok = row ? await verifyPassword(password, row.passwordHash) : false;

  if (!row || !ok || row.isActive !== 1) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  await createSession(row.id);
  redirect("/pos");
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/auth");
  await destroySession();
  redirect("/login");
}

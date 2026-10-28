"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  SESSION_COOKIE,
  hashPassword,
  requireOwner,
} from "@/lib/auth";
import { newId } from "@/lib/ids";

export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "ชื่อผู้ใช้ ≥ 3 ตัว")
    .max(40),
  displayName: z.string().trim().min(1, "กรอกชื่อที่แสดง").max(80),
  password: z.string().min(6, "รหัสผ่าน ≥ 6 ตัว").max(100),
  role: z.enum(["OWNER", "STAFF"]),
});

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const parsed = userSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;

  const db = getDb();
  const dup = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${d.username}`)
      .limit(1)
  )[0];
  if (dup) return { error: `มีผู้ใช้ "${d.username}" อยู่แล้ว` };

  await db.insert(users).values({
    id: newId("usr"),
    username: d.username,
    passwordHash: await hashPassword(d.password),
    displayName: d.displayName,
    role: d.role,
    isActive: 1,
    createdAt: Date.now(),
  });

  revalidatePath("/users");
  redirect("/users?created=1");
}

export async function toggleUserActive(formData: FormData): Promise<void> {
  const user = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "0") === "1" ? 1 : 0;
  if (!id) return;
  if (id === user.id) return; // ห้ามปิดตัวเอง

  const db = getDb();
  await db.update(users).set({ isActive: next }).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function changeUserRole(formData: FormData): Promise<void> {
  const user = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") === "OWNER" ? "OWNER" : "STAFF";
  if (!id) return;
  if (id === user.id) return; // ห้ามเปลี่ยน role ตัวเอง

  const db = getDb();
  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id) return { error: "ไม่พบผู้ใช้" };
  if (password.length < 6) return { error: "รหัสผ่าน ≥ 6 ตัว" };

  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, id));

  // ตัด session เดิมของผู้ใช้ทิ้ง เพื่อไม่ให้เครื่องที่หายยังใช้งานได้
  const jar = await cookies();
  const currentSession = jar.get(SESSION_COOKIE)?.value;
  if (id === owner.id && currentSession) {
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, id), ne(sessions.id, currentSession)));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  revalidatePath("/users");
  return { ok: true, message: "รีเซ็ตรหัสผ่านแล้ว (อุปกรณ์อื่นถูกออกจากระบบ)" };
}

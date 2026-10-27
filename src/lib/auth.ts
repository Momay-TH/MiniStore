import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken } from "./ids";

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 210_000;

export type Role = "OWNER" | "STAFF";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};

/* ---------------------------------- hashing --------------------------------- */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as ArrayBuffer,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** รูปแบบที่เก็บ: pbkdf2$sha256$<iter>$<saltB64>$<hashB64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[3]);
  const expected = fromBase64(parts[4]);
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/* --------------------------------- sessions -------------------------------- */

export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const id = randomToken(32);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 86_400_000;

  await db.insert(sessions).values({ id, userId, expiresAt, createdAt: now });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
    .limit(1);

  const row = rows[0];
  if (!row || row.isActive !== 1) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role as Role,
  };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/pos");
  return user;
}

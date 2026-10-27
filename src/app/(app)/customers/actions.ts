"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { customers, payments, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { bahtToSatang, formatTHB } from "@/lib/money";

export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function money(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return 0;
  try {
    return bahtToSatang(raw);
  } catch {
    return null;
  }
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "กรอกชื่อลูกค้า").max(120),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(300),
  creditLimit: z.number().int().min(0),
  note: z.string().trim().max(300),
});

function parseCustomer(formData: FormData) {
  const creditLimit = money(formData, "creditLimit");
  if (creditLimit === null) {
    return { ok: false as const, error: "รูปแบบวงเงินไม่ถูกต้อง (เช่น 500 หรือ 500.00)" };
  }

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    creditLimit,
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = parseCustomer(formData);
  if (!parsed.ok) return { error: parsed.error };

  const d = parsed.data;
  const db = getDb();

  if (d.phone) {
    const dup = (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.phone, d.phone))
        .limit(1)
    )[0];
    if (dup) return { error: `เบอร์ "${d.phone}" ถูกใช้แล้ว` };
  }

  const id = newId("cus");
  await db.insert(customers).values({
    id,
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    creditLimit: d.creditLimit,
    note: d.note || null,
    isActive: 1,
    createdAt: Date.now(),
  });

  revalidatePath("/customers");
  revalidatePath("/debts");
  revalidatePath("/pos");
  redirect(`/customers/${id}?created=1`);
}

export async function updateCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบลูกค้า" };

  const parsed = parseCustomer(formData);
  if (!parsed.ok) return { error: parsed.error };

  const d = parsed.data;
  const db = getDb();

  if (d.phone) {
    const dup = (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phone, d.phone), ne(customers.id, id)))
        .limit(1)
    )[0];
    if (dup) return { error: `เบอร์ "${d.phone}" ถูกใช้แล้ว` };
  }

  await db
    .update(customers)
    .set({
      name: d.name,
      phone: d.phone || null,
      address: d.address || null,
      creditLimit: d.creditLimit,
      note: d.note || null,
    })
    .where(eq(customers.id, id));

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/debts");
  revalidatePath("/pos");
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function toggleCustomerActive(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "0") === "1" ? 1 : 0;
  if (!id) return;

  const db = getDb();
  await db
    .update(customers)
    .set({ isActive: next })
    .where(eq(customers.id, id));

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/debts");
  revalidatePath("/pos");
}

/* ------------------------------ รับชำระหนี้ ------------------------------ */

export async function recordPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const customerId = String(formData.get("customerId") ?? "");
  const amount = money(formData, "amount");
  const method =
    String(formData.get("method") ?? "CASH") === "TRANSFER"
      ? ("TRANSFER" as const)
      : ("CASH" as const);
  const note = String(formData.get("note") ?? "").trim();

  if (!customerId) return { error: "ไม่พบลูกค้า" };
  if (amount === null) return { error: "รูปแบบจำนวนเงินไม่ถูกต้อง" };
  if (amount <= 0) return { error: "จำนวนเงินต้องมากกว่า 0" };

  const db = getDb();
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!customer) return { error: "ไม่พบลูกค้า" };

  // เรียงบิลเก่าสุดก่อน (FIFO) เพื่อตัดหนี้ตามลำดับ
  const openSales = await db
    .select({
      id: sales.id,
      code: sales.code,
      total: sales.total,
      paidAmount: sales.paidAmount,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(eq(sales.customerId, customerId), ne(sales.status, "PAID")))
    .orderBy(sales.createdAt);

  const outstanding = openSales.reduce(
    (sum, s) => sum + Math.max(0, s.total - s.paidAmount),
    0,
  );

  if (outstanding <= 0) {
    return { error: `${customer.name} ไม่มียอดค้างชำระ` };
  }
  if (amount > outstanding) {
    return {
      error: `ยอดชำระ ฿${formatTHB(amount)} เกินยอดค้าง ฿${formatTHB(outstanding)} — กรุณาแก้จำนวนเงิน`,
    };
  }

  const now = Date.now();
  const statements: unknown[] = [];
  let remaining = amount;
  let lastSaleId: string | null = null;

  for (const sale of openSales) {
    if (remaining <= 0) break;
    const due = Math.max(0, sale.total - sale.paidAmount);
    if (due <= 0) continue;

    const alloc = Math.min(due, remaining);
    remaining -= alloc;
    lastSaleId = sale.id;

    const newPaid = sale.paidAmount + alloc;
    statements.push(
      db.insert(payments).values({
        id: newId("pay"),
        customerId,
        saleId: sale.id,
        amount: alloc,
        method,
        note: note || null,
        userId: user.id,
        createdAt: now,
      }),
    );
    statements.push(
      db
        .update(sales)
        .set({
          paidAmount: newPaid,
          status: newPaid >= sale.total ? "PAID" : "PARTIAL",
        })
        .where(eq(sales.id, sale.id)),
    );
  }

  void lastSaleId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch(statements as any);

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/debts");
  revalidatePath("/sales");

  const left = outstanding - amount;
  return {
    ok: true,
    message:
      left > 0
        ? `รับชำระ ฿${formatTHB(amount)} แล้ว · ยังค้าง ฿${formatTHB(left)}`
        : `รับชำระ ฿${formatTHB(amount)} แล้ว · เคลียร์หนี้ครบ`,
  };
}

/** ยอดค้างรวมของลูกค้าทั้งหมด (ใช้ในหน้า /debts) */
export async function totalOutstanding(): Promise<number> {
  await requireUser();
  const db = getDb();
  const row = (
    await db
      .select({
        due: sql<number>`coalesce(sum(${sales.total} - ${sales.paidAmount}), 0)`,
      })
      .from(sales)
      .where(ne(sales.status, "PAID"))
  )[0];
  return Number(row?.due ?? 0);
}

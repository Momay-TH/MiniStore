"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  customers,
  products,
  saleItems,
  sales,
  settings,
  stockMoves,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bkkDateKey } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { formatTHB } from "@/lib/money";

const itemSchema = z.object({
  productId: z.string().min(1),
  saleUnit: z.enum(["UNIT", "PACK"]),
  qty: z.number().int().min(1).max(10_000),
  unitPrice: z.number().int().min(0).max(10_000_000),
});

const payloadSchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
  discount: z.number().int().min(0).default(0),
  method: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  customerId: z.string().optional().nullable(),
  paidAmount: z.number().int().min(0).default(0),
  note: z.string().max(300).optional(),
});

export type CreateSaleResult =
  | {
      ok: true;
      saleId: string;
      code: string;
      total: number;
      change: number;
      creditDue: number;
    }
  | { ok: false; error: string };

export async function createSale(
  rawPayload: unknown,
): Promise<CreateSaleResult> {
  const user = await requireUser();

  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, error: "ข้อมูลบิลไม่ถูกต้อง" };
  }
  const payload = parsed.data;

  if (payload.method === "CREDIT" && !payload.customerId) {
    return { ok: false, error: "ขายเชื่อต้องเลือกลูกค้า" };
  }

  const db = getDb();
  const ids = [...new Set(payload.items.map((i) => i.productId))];

  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, ids));

  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // รวมจำนวนต่อสินค้า (หน่วยฐาน) เพื่อตรวจสต็อกให้ครบก่อนตัดสินใจ
  const needByProduct = new Map<string, number>();
  const lines: {
    productId: string;
    name: string;
    saleUnit: "UNIT" | "PACK";
    qty: number;
    qtyBase: number;
    listPrice: number;
    unitPrice: number;
    lineTotal: number;
    costPerBase: number;
  }[] = [];

  for (const item of payload.items) {
    const product = productMap.get(item.productId);
    if (!product || product.isActive !== 1) {
      return { ok: false, error: "ไม่พบสินค้าในบิล (อาจถูกปิดใช้งาน)" };
    }

    const packSize = Math.max(1, product.packSize);
    const qtyBase = item.saleUnit === "PACK" ? item.qty * packSize : item.qty;
    const listPrice =
      item.saleUnit === "PACK" ? product.pricePerPack : product.pricePerBase;

    needByProduct.set(
      product.id,
      (needByProduct.get(product.id) ?? 0) + qtyBase,
    );

    lines.push({
      productId: product.id,
      name: product.name,
      saleUnit: item.saleUnit,
      qty: item.qty,
      qtyBase,
      listPrice,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.qty,
      costPerBase: product.costPerBase,
    });
  }

  // ตรวจสต็อก (ปิดได้ผ่าน setting)
  const allowNegative =
    (
      await db
        .select()
        .from(settings)
        .where(eq(settings.key, "allow_negative_stock"))
        .limit(1)
    )[0]?.value === "1";

  if (!allowNegative) {
    for (const [productId, need] of needByProduct) {
      const product = productMap.get(productId)!;
      if (product.stockQty < need) {
        return {
          ok: false,
          error: `สต็อกไม่พอ: ${product.name} เหลือ ${product.stockQty} ${product.baseUnit}`,
        };
      }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discount = Math.min(payload.discount, subtotal);
  const total = subtotal - discount;

  const isPaidInFull = payload.method !== "CREDIT";
  const paidAmount = isPaidInFull
    ? total
    : Math.min(payload.paidAmount, total);
  const status = paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

  // ตรวจวงเงินเชื่อของลูกค้า (0 = ไม่จำกัด)
  if (payload.method === "CREDIT" && payload.customerId) {
    const customer = (
      await db
        .select()
        .from(customers)
        .where(eq(customers.id, payload.customerId))
        .limit(1)
    )[0];

    if (!customer) return { ok: false, error: "ไม่พบลูกค้า" };
    if (customer.isActive !== 1)
      return { ok: false, error: `${customer.name} ถูกปิดใช้งาน` };

    if (customer.creditLimit > 0) {
      const dueRow = (
        await db
          .select({
            due: sql<number>`coalesce(sum(${sales.total} - ${sales.paidAmount}), 0)`,
          })
          .from(sales)
          .where(
            and(
              eq(sales.customerId, customer.id),
              ne(sales.status, "PAID"),
            ),
          )
      )[0];

      const currentDue = Number(dueRow?.due ?? 0);
      const nextDue = currentDue + Math.max(0, total - paidAmount);
      if (nextDue > customer.creditLimit) {
        return {
          ok: false,
          error: `เกินวงเงินเชื่อของ ${customer.name}: ค้างอยู่ ฿${formatTHB(
            currentDue,
          )} + บิลนี้ ฿${formatTHB(total - paidAmount)} เกินวงเงิน ฿${formatTHB(
            customer.creditLimit,
          )}`,
        };
      }
    }
  }

  // เลขที่บิลรายวัน
  const dateKey = bkkDateKey();
  const prefix = `S-${dateKey}-`;
  const countRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(sales)
    .where(sql`${sales.code} like ${`${prefix}%`}`);
  const seq = Number(countRow[0]?.c ?? 0) + 1;
  const code = `${prefix}${String(seq).padStart(4, "0")}`;

  const saleId = newId("sale");
  const now = Date.now();

  const statements = [
    db.insert(sales).values({
      id: saleId,
      code,
      customerId: payload.customerId ?? null,
      userId: user.id,
      subtotal,
      discount,
      total,
      paidAmount,
      method: payload.method,
      status,
      note: payload.note?.trim() || null,
      createdAt: now,
    }),
    ...lines.map((line) =>
      db.insert(saleItems).values({
        id: newId("sitem"),
        saleId,
        productId: line.productId,
        productName: line.name,
        saleUnit: line.saleUnit,
        qty: line.qty,
        qtyBase: line.qtyBase,
        listPrice: line.listPrice,
        unitPrice: line.unitPrice,
        costPerBase: line.costPerBase,
        lineTotal: line.lineTotal,
      }),
    ),
    ...[...needByProduct].map(([productId, need]) =>
      db
        .update(products)
        .set({
          stockQty: sql`${products.stockQty} - ${need}`,
          updatedAt: now,
        })
        .where(eq(products.id, productId)),
    ),
    ...[...needByProduct].map(([productId, need]) =>
      db.insert(stockMoves).values({
        id: newId("move"),
        productId,
        type: "SALE",
        qtyBase: -need,
        unitCost: productMap.get(productId)?.costPerBase ?? 0,
        refType: "SALE",
        refId: saleId,
        userId: user.id,
        createdAt: now,
      }),
    ),
  ];

  // D1 batch = atomic ทั้งชุด: สำเร็จหมดหรือไม่บันทึกเลย
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch(statements as any);

  revalidatePath("/pos");
  revalidatePath("/sales");

  return {
    ok: true,
    saleId,
    code,
    total,
    change: Math.max(0, paidAmount - total),
    creditDue: Math.max(0, total - paidAmount),
  };
}

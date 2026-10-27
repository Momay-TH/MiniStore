"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { products, settings, stockMoves } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { bahtToSatang } from "@/lib/money";
import type { FormState } from "../products/actions";

function money(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return 0;
  try {
    return bahtToSatang(raw);
  } catch {
    return null;
  }
}

async function allowNegative(): Promise<boolean> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, "allow_negative_stock"))
      .limit(1)
  )[0];
  return row?.value === "1";
}

/* --------------------------------- รับเข้า --------------------------------- */

export async function receiveStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const productId = String(formData.get("productId") ?? "");
  const saleUnit = String(formData.get("saleUnit") ?? "BASE") === "PACK" ? "PACK" : "BASE";
  const qty = Number(formData.get("qty") ?? 0);
  const unitCostInput = money(formData, "unitCost");
  const updateCost = String(formData.get("updateCost") ?? "") === "on";
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "เลือกสินค้า" };
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty))
    return { error: "จำนวนต้องเป็นเลขจำนวนเต็มมากกว่า 0" };
  if (unitCostInput === null) return { error: "รูปแบบต้นทุนไม่ถูกต้อง" };

  const db = getDb();
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return { error: "ไม่พบสินค้า" };

  const packSize = Math.max(1, product.packSize);
  const qtyBase = saleUnit === "PACK" ? qty * packSize : qty;
  const costPerBase =
    unitCostInput > 0
      ? saleUnit === "PACK"
        ? Math.round(unitCostInput / packSize)
        : unitCostInput
      : product.costPerBase;

  const now = Date.now();
  const moveId = newId("move");

  const statements = [
    db.insert(stockMoves).values({
      id: moveId,
      productId,
      type: "PURCHASE",
      qtyBase,
      unitCost: costPerBase,
      refType: "PURCHASE",
      refId: null,
      note: note || null,
      userId: user.id,
      createdAt: now,
    }),
    db
      .update(products)
      .set({
        stockQty: sql`${products.stockQty} + ${qtyBase}`,
        ...(updateCost && costPerBase > 0 ? { costPerBase } : {}),
        updatedAt: now,
      })
      .where(eq(products.id, productId)),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch(statements as any);

  revalidatePath("/stock");
  revalidatePath("/stock/history");
  revalidatePath("/products");
  revalidatePath("/pos");

  return {
    ok: true,
    message: `รับเข้า ${qtyBase} ${product.baseUnit} แล้ว`,
  };
}

/* -------------------------------- ปรับปรุง -------------------------------- */

export async function adjustStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const productId = String(formData.get("productId") ?? "");
  const counted = Number(formData.get("counted") ?? NaN);
  const type = String(formData.get("type") ?? "ADJUST") === "DAMAGE" ? "DAMAGE" : "ADJUST";
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "เลือกสินค้า" };
  if (!Number.isFinite(counted) || counted < 0 || !Number.isInteger(counted))
    return { error: "จำนวนที่นับได้ต้องเป็นเลขจำนวนเต็ม ≥ 0" };

  const db = getDb();
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return { error: "ไม่พบสินค้า" };

  const delta = counted - product.stockQty;
  if (delta === 0) {
    return { ok: true, message: "จำนวนตรงกับในระบบแล้ว ไม่มีอะไรต้องปรับ" };
  }

  if (delta < 0 && counted < 0) return { error: "จำนวนติดลบไม่ได้" };
  if (!(await allowNegative()) && counted < 0) {
    return { error: "ไม่สามารถปรับให้ติดลบได้" };
  }

  const now = Date.now();
  const statements = [
    db.insert(stockMoves).values({
      id: newId("move"),
      productId,
      type,
      qtyBase: delta,
      unitCost: product.costPerBase,
      refType: "ADJUST",
      refId: null,
      note: note || (type === "DAMAGE" ? "ของเสีย/แตกหัก" : "นับสต็อก"),
      userId: user.id,
      createdAt: now,
    }),
    db
      .update(products)
      .set({ stockQty: counted, updatedAt: now })
      .where(eq(products.id, productId)),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch(statements as any);

  revalidatePath("/stock");
  revalidatePath("/stock/history");
  revalidatePath("/products");
  revalidatePath("/pos");

  return {
    ok: true,
    message: `ปรับสต็อกจาก ${product.stockQty} → ${counted} ${product.baseUnit} (${
      delta > 0 ? "+" : ""
    }${delta})`,
  };
}

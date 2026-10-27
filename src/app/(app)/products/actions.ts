"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, priceLogs, products } from "@/db/schema";
import { requireOwner, requireUser } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { bahtToSatang } from "@/lib/money";
import { generateNextSku, isAutoSku } from "@/lib/sku";

export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const productSchema = z.object({
  name: z.string().trim().min(1, "กรอกชื่อสินค้า").max(120),
  sku: z.string().trim().max(60, "SKU ยาวเกิน 60 ตัว"),
  barcode: z.string().trim().max(60),
  categoryId: z.string().trim(),
  baseUnit: z.string().trim().min(1, "กรอกหน่วยฐาน").max(20),
  packUnit: z.string().trim().min(1, "กรอกหน่วยยก").max(20),
  packSize: z.number().int().min(1, "จำนวนต่อหน่วยยกต้อง ≥ 1").max(10_000),
  reorderPoint: z.number().int().min(0).max(1_000_000),
  costPerBase: z.number().int().min(0),
  pricePerBase: z.number().int().min(0),
  pricePerPack: z.number().int().min(0),
});

function money(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return 0;
  try {
    return bahtToSatang(raw);
  } catch {
    return null;
  }
}

function parseProduct(formData: FormData) {
  const cost = money(formData, "costPerBase");
  const priceBase = money(formData, "pricePerBase");
  const pricePack = money(formData, "pricePerPack");

  if (cost === null || priceBase === null || pricePack === null) {
    return { ok: false as const, error: "รูปแบบราคาไม่ถูกต้อง (เช่น 15 หรือ 15.50)" };
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    barcode: formData.get("barcode") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    baseUnit: formData.get("baseUnit") ?? "ขวด",
    packUnit: formData.get("packUnit") ?? "ลัง",
    packSize: Number(formData.get("packSize") ?? 1),
    reorderPoint: Number(formData.get("reorderPoint") ?? 0),
    costPerBase: cost,
    pricePerBase: priceBase,
    pricePerPack: pricePack,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseProduct(formData);
  if (!parsed.ok) return { error: parsed.error };

  const d = parsed.data;
  const db = getDb();

  // SKU: เว้นว่าง = ให้ระบบสร้าง (P00001) / ถ้ารหัสอัตโนมัติชน ให้เลื่อนเลขถัดไป
  let sku = d.sku;
  if (!sku) sku = await generateNextSku();

  for (let attempt = 0; ; attempt++) {
    const dup = (
      await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, sku))
        .limit(1)
    )[0];
    if (!dup) break;
    if (!isAutoSku(sku)) return { error: `SKU "${sku}" ถูกใช้แล้ว` };
    if (attempt >= 5)
      return { error: "สร้าง SKU อัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    sku = await generateNextSku();
  }

  if (d.barcode) {
    const dupBarcode = (
      await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.barcode, d.barcode))
        .limit(1)
    )[0];
    if (dupBarcode) return { error: `บาร์โค้ด "${d.barcode}" ถูกใช้แล้ว` };
  }

  const now = Date.now();
  await db.insert(products).values({
    id: newId("prod"),
    sku,
    barcode: d.barcode || null,
    name: d.name,
    categoryId: d.categoryId || null,
    baseUnit: d.baseUnit,
    packUnit: d.packUnit,
    packSize: d.packSize,
    costPerBase: d.costPerBase,
    pricePerBase: d.pricePerBase,
    pricePerPack: d.pricePerPack,
    reorderPoint: d.reorderPoint,
    stockQty: 0,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  });

  void user;
  revalidatePath("/products");
  revalidatePath("/pos");
  redirect("/products?created=1");
}

export async function updateProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบสินค้า" };

  const parsed = parseProduct(formData);
  if (!parsed.ok) return { error: parsed.error };

  const d = parsed.data;
  const db = getDb();

  const current = (
    await db.select().from(products).where(eq(products.id, id)).limit(1)
  )[0];
  if (!current) return { error: "ไม่พบสินค้า" };

  // เว้นว่าง = คง SKU เดิม (ไม่สร้างใหม่ให้สินค้าที่มีอยู่แล้ว)
  const sku = d.sku || current.sku;

  const dup = (
    await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.sku, sku), ne(products.id, id)))
      .limit(1)
  )[0];
  if (dup) return { error: `SKU "${sku}" ถูกใช้แล้ว` };

  if (d.barcode) {
    const dupBarcode = (
      await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.barcode, d.barcode), ne(products.id, id)))
        .limit(1)
    )[0];
    if (dupBarcode) return { error: `บาร์โค้ด "${d.barcode}" ถูกใช้แล้ว` };
  }

  const now = Date.now();
  await db
    .update(products)
    .set({
      name: d.name,
      sku,
      barcode: d.barcode || null,
      categoryId: d.categoryId || null,
      baseUnit: d.baseUnit,
      packUnit: d.packUnit,
      packSize: d.packSize,
      costPerBase: d.costPerBase,
      pricePerBase: d.pricePerBase,
      pricePerPack: d.pricePerPack,
      reorderPoint: d.reorderPoint,
      updatedAt: now,
    })
    .where(eq(products.id, id));

  const changes: { field: string; oldValue: number; newValue: number }[] = [];
  if (current.costPerBase !== d.costPerBase)
    changes.push({
      field: "costPerBase",
      oldValue: current.costPerBase,
      newValue: d.costPerBase,
    });
  if (current.pricePerBase !== d.pricePerBase)
    changes.push({
      field: "pricePerBase",
      oldValue: current.pricePerBase,
      newValue: d.pricePerBase,
    });
  if (current.pricePerPack !== d.pricePerPack)
    changes.push({
      field: "pricePerPack",
      oldValue: current.pricePerPack,
      newValue: d.pricePerPack,
    });

  if (changes.length > 0) {
    await db.insert(priceLogs).values(
      changes.map((c) => ({
        id: newId("plog"),
        productId: id,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        userId: user.id,
        createdAt: now,
      })),
    );
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/pos");
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "0") === "1" ? 1 : 0;
  if (!id) return;

  const db = getDb();
  await db
    .update(products)
    .set({ isActive: next, updatedAt: Date.now() })
    .where(eq(products.id, id));

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/pos");
}

/* --------------------------------- categories -------------------------------- */

export async function createCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  if (!name) return { error: "กรอกชื่อหมวดหมู่" };

  const db = getDb();
  const dup = (
    await db.select({ id: categories.id }).from(categories).where(eq(categories.name, name)).limit(1)
  )[0];
  if (dup) return { error: `มีหมวดหมู่ "${name}" อยู่แล้ว` };

  await db.insert(categories).values({
    id: newId("cat"),
    name,
    sortOrder,
    isActive: 1,
    createdAt: Date.now(),
  });

  revalidatePath("/products/categories");
  revalidatePath("/products");
  return { ok: true, message: `เพิ่มหมวดหมู่ "${name}" แล้ว` };
}

export async function updateCategory(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  if (!id || !name || name.length > 60) {
    redirect("/products/categories?error=invalid");
  }

  const db = getDb();
  const dup = (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.name, name), ne(categories.id, id)))
      .limit(1)
  )[0];
  if (dup) {
    redirect("/products/categories?error=duplicate");
  }

  await db
    .update(categories)
    .set({ name, sortOrder })
    .where(eq(categories.id, id));

  revalidatePath("/products/categories");
  revalidatePath("/products");
}

export async function toggleCategoryActive(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "0") === "1" ? 1 : 0;
  if (!id) return;

  const db = getDb();
  await db.update(categories).set({ isActive: next }).where(eq(categories.id, id));

  revalidatePath("/products/categories");
  revalidatePath("/products");
}

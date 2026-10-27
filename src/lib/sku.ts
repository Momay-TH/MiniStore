import { like } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";

/** รูปแบบ SKU ที่ระบบสร้างให้: P + เลข 5 หลัก เช่น P00001 */
export const SKU_PREFIX = "P";
export const SKU_DIGITS = 5;

export function isAutoSku(value: string): boolean {
  return new RegExp(`^${SKU_PREFIX}\\d{${SKU_DIGITS}}$`).test(value);
}

export function formatSku(seq: number): string {
  return `${SKU_PREFIX}${String(seq).padStart(SKU_DIGITS, "0")}`;
}

export function parseAutoSku(value: string): number | null {
  if (!isAutoSku(value)) return null;
  return Number(value.slice(SKU_PREFIX.length));
}

/** หา SKU ถัดไปจากรายการที่มีอยู่ (pure — ใช้ทดสอบได้) */
export function nextSkuFrom(taken: Iterable<string>): string {
  let max = 0;
  for (const sku of taken) {
    const n = parseAutoSku(sku);
    if (n !== null && n > max) max = n;
  }
  return formatSku(max + 1);
}

/** สร้าง SKU ถัดไปจากฐานข้อมูล — ไม่นำเลขที่เคยใช้แล้วกลับมาใช้ซ้ำ */
export async function generateNextSku(): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ sku: products.sku })
    .from(products)
    .where(like(products.sku, `${SKU_PREFIX}%`));
  return nextSkuFrom(rows.map((r) => r.sku));
}

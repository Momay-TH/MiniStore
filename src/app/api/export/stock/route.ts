import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, products } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const rows = await db
    .select({
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      categoryName: categories.name,
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
      costPerBase: products.costPerBase,
      pricePerBase: products.pricePerBase,
      pricePerPack: products.pricePerPack,
      stockQty: products.stockQty,
      reorderPoint: products.reorderPoint,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(products.name);

  const csv = toCsv(
    [
      "SKU",
      "บาร์โค้ด",
      "ชื่อสินค้า",
      "หมวดหมู่",
      "หน่วยฐาน",
      "หน่วยยก",
      "จำนวน/หน่วยยก",
      "ต้นทุน/หน่วยฐาน",
      "ราคาขายเดี่ยว",
      "ราคาขายยกลัง",
      "คงเหลือ",
      "จุดเตือน",
      "สถานะ",
    ],
    rows.map((r) => [
      r.sku,
      r.barcode ?? "",
      r.name,
      r.categoryName ?? "",
      r.baseUnit,
      r.packUnit,
      r.packSize,
      (r.costPerBase / 100).toFixed(2),
      (r.pricePerBase / 100).toFixed(2),
      (r.pricePerPack / 100).toFixed(2),
      r.stockQty,
      r.reorderPoint,
      r.isActive === 1 ? "ใช้งาน" : "ปิดใช้งาน",
    ]),
  );

  return csvResponse("stock.csv", csv);
}

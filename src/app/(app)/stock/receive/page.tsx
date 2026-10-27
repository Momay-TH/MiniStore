import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, products, stockMoves } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ReceiveForm, type StockProduct } from "./receive-form";

export const metadata = { title: "รับเข้าสินค้า" };

export default async function ReceivePage() {
  await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      categoryName: categories.name,
      isActive: products.isActive,
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
      costPerBase: products.costPerBase,
      stockQty: products.stockQty,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(desc(products.isActive), products.name);

  // วันรับเข้าล่าสุดของแต่ละสินค้า (ใช้บอกว่า "เคยอยู่ในสต็อก" หรือยัง)
  const lastReceived = await db
    .select({
      productId: stockMoves.productId,
      lastAt: sql<number>`max(${stockMoves.createdAt})`,
    })
    .from(stockMoves)
    .where(inArray(stockMoves.type, ["PURCHASE", "INIT"]))
    .groupBy(stockMoves.productId);

  const lastMap = new Map(lastReceived.map((r) => [r.productId, r.lastAt]));
  const list: StockProduct[] = rows.map((r) => ({
    ...r,
    lastReceivedAt: lastMap.get(r.id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/stock" className="text-sm text-slate-500">
          ← กลับหน้าสต็อก
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">รับเข้าสินค้า</h1>
        <p className="text-xs text-slate-500">
          สแกนบาร์โค้ดหรือเลือกสินค้า แล้วกรอกจำนวนที่รับเข้า
        </p>
      </div>

      <ReceiveForm products={list} />
    </div>
  );
}

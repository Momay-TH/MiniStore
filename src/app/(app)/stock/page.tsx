import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatTHBCompact } from "@/lib/money";
import { StockList, type StockRow } from "./stock-list";

export const metadata = { title: "สต็อก" };

export default async function StockPage() {
  await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stockQty: products.stockQty,
      reorderPoint: products.reorderPoint,
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
      costPerBase: products.costPerBase,
      pricePerBase: products.pricePerBase,
    })
    .from(products)
    .where(eq(products.isActive, 1))
    .orderBy(products.name);

  const lowCount = rows.filter(
    (p) => p.stockQty > 0 && p.stockQty <= p.reorderPoint,
  ).length;
  const outCount = rows.filter((p) => p.stockQty <= 0).length;
  const stockValue = rows.reduce((sum, p) => sum + p.stockQty * p.costPerBase, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">สต็อก</h1>
        <p className="text-xs text-slate-400">
          {rows.length} รายการ · ใกล้หมด {lowCount} · หมด {outCount} · มูลค่า{" "}
          ฿{formatTHBCompact(stockValue)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/stock/receive" className="btn-primary h-auto py-3 text-xs">
          <span className="text-base">＋</span> รับเข้า
        </Link>
        <Link href="/stock/adjust" className="btn-ghost h-auto py-3 text-xs">
          <span className="text-base">✎</span> ปรับยอด
        </Link>
        <Link href="/stock/history" className="btn-ghost h-auto py-3 text-xs">
          <span className="text-base">≡</span> ประวัติ
        </Link>
      </div>

      <StockList rows={rows as StockRow[]} />
    </div>
  );
}

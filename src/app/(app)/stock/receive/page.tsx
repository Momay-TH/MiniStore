import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
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
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
      costPerBase: products.costPerBase,
      stockQty: products.stockQty,
    })
    .from(products)
    .where(eq(products.isActive, 1))
    .orderBy(products.name);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/stock" className="text-sm text-slate-500">
          ← กลับหน้าสต็อก
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">รับเข้าสินค้า</h1>
        <p className="text-xs text-slate-400">
          บันทึกการซื้อ/เติมสต็อก พร้อมต้นทุน
        </p>
      </div>

      <ReceiveForm products={rows as StockProduct[]} />
    </div>
  );
}

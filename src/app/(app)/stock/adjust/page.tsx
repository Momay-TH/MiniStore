import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AdjustForm } from "./adjust-form";

export const metadata = { title: "ปรับปรุงสต็อก" };

export default async function AdjustPage() {
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
        <h1 className="mt-2 text-lg font-bold text-slate-900">ปรับปรุงสต็อก</h1>
        <p className="text-xs text-slate-500">
          กรอกจำนวนที่นับได้จริง ระบบจะคำนวณผลต่างให้
        </p>
      </div>

      <AdjustForm products={rows} />
    </div>
  );
}

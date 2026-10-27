import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, products } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { toggleCategoryActive, updateCategory } from "../actions";
import { CategoryAddForm } from "./category-add-form";

export const metadata = { title: "หมวดหมู่สินค้า" };

export default async function CategoriesPage() {
  await requireOwner();
  const db = getDb();

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/products" className="text-sm text-slate-500">
          ← กลับรายการสินค้า
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">หมวดหมู่</h1>
        <p className="text-xs text-slate-400">
          {rows.length} หมวด · เรียงตาม “ลำดับ” น้อยไปมาก
        </p>
      </div>

      <CategoryAddForm />

      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="card p-3">
            <form action={updateCategory} className="flex items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input
                name="name"
                defaultValue={c.name}
                required
                className="input h-10 flex-1"
              />
              <input
                name="sortOrder"
                type="number"
                defaultValue={c.sortOrder}
                className="input h-10 w-16 text-center"
                aria-label="ลำดับ"
              />
              <button type="submit" className="btn-sm border border-slate-200">
                บันทึก
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                {Number(c.productCount)} สินค้า
              </p>
              <form action={toggleCategoryActive}>
                <input type="hidden" name="id" value={c.id} />
                <input
                  type="hidden"
                  name="next"
                  value={c.isActive === 1 ? "0" : "1"}
                />
                <button
                  type="submit"
                  className={`badge ${
                    c.isActive === 1
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {c.isActive === 1 ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

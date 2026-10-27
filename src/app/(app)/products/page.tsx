import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, products } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ProductsList, type ProductRow } from "./products-list";

export const metadata = { title: "สินค้า" };

export default async function ProductsPage() {
  await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
      pricePerBase: products.pricePerBase,
      pricePerPack: products.pricePerPack,
      stockQty: products.stockQty,
      reorderPoint: products.reorderPoint,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(products.name);

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, 1))
    .orderBy(categories.sortOrder, categories.name);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">สินค้า</h1>
          <p className="text-xs text-slate-400">{rows.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <Link href="/products/categories" className="btn-ghost btn-sm">
            หมวดหมู่
          </Link>
          <Link href="/products/new" className="btn-primary h-9 px-3 text-xs">
            + เพิ่มสินค้า
          </Link>
        </div>
      </div>

      <ProductsList
        rows={rows as ProductRow[]}
        categories={categoryRows}
      />
    </div>
  );
}

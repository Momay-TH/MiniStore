import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, customers, products, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PosClient, type PosProduct } from "./pos-client";

export const metadata = { title: "ขายสินค้า" };

export default async function PosPage() {
  await requireUser();
  const db = getDb();

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
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
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.isActive, 1))
    .orderBy(products.name);

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, 1))
    .orderBy(categories.sortOrder, categories.name);

  const customerRows = await db
    .select({
      id: customers.id,
      name: customers.name,
      creditLimit: customers.creditLimit,
      due: sql<number>`coalesce((select sum(${sales.total} - ${sales.paidAmount}) from ${sales} where ${sales.customerId} = ${customers.id} and ${sales.status} <> 'PAID'), 0)`,
    })
    .from(customers)
    .where(eq(customers.isActive, 1))
    .orderBy(customers.name);

  return (
    <PosClient
      products={productRows as PosProduct[]}
      categories={categoryRows}
      customers={customerRows.map((c) => ({ ...c, due: Number(c.due) }))}
    />
  );
}

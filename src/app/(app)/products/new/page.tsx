import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { generateNextSku } from "@/lib/sku";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata = { title: "เพิ่มสินค้า" };

export default async function NewProductPage() {
  await requireUser();
  const db = getDb();
  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, 1))
    .orderBy(categories.sortOrder, categories.name);

  const suggestedSku = await generateNextSku();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/products" className="text-sm text-slate-500">
          ← กลับรายการสินค้า
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">เพิ่มสินค้า</h1>
        <p className="text-xs text-slate-500">
          ตั้งราคาขายเดี่ยวและยกลังได้เลย
        </p>
      </div>

      <ProductForm
        action={createProduct}
        categories={categoryRows}
        suggestedSku={suggestedSku}
      />
    </div>
  );
}

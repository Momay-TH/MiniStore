import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, priceLogs, products, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatTHB } from "@/lib/money";
import { toggleProductActive, updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata = { title: "แก้ไขสินค้า" };

const FIELD_LABEL: Record<string, string> = {
  costPerBase: "ราคาทุน",
  pricePerBase: "ราคาขายเดี่ยว",
  pricePerPack: "ราคาขายยกลัง",
};

export default async function EditProductPage(
  props: PageProps<"/products/[id]">,
) {
  const user = await requireUser();
  const { id } = await props.params;
  const db = getDb();

  const product = (
    await db.select().from(products).where(eq(products.id, id)).limit(1)
  )[0];
  if (!product) notFound();

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, 1))
    .orderBy(categories.sortOrder, categories.name);

  const logs = await db
    .select({
      id: priceLogs.id,
      field: priceLogs.field,
      oldValue: priceLogs.oldValue,
      newValue: priceLogs.newValue,
      createdAt: priceLogs.createdAt,
      userName: users.displayName,
    })
    .from(priceLogs)
    .leftJoin(users, eq(users.id, priceLogs.userId))
    .where(eq(priceLogs.productId, id))
    .orderBy(desc(priceLogs.createdAt))
    .limit(20);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/products" className="text-sm text-slate-500">
          ← กลับรายการสินค้า
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">{product.name}</h1>
        <p className="text-xs text-slate-500">
          คงเหลือ {product.stockQty} {product.baseUnit} · {product.sku}
        </p>
      </div>

      <ProductForm
        action={updateProduct}
        categories={categoryRows}
        submitLabel="บันทึกการแก้ไข"
        defaults={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.categoryId,
          baseUnit: product.baseUnit,
          packUnit: product.packUnit,
          packSize: product.packSize,
          costPerBase: product.costPerBase,
          pricePerBase: product.pricePerBase,
          pricePerPack: product.pricePerPack,
          reorderPoint: product.reorderPoint,
        }}
      />

      <form action={toggleProductActive} className="card p-4">
        <input type="hidden" name="id" value={product.id} />
        <input
          type="hidden"
          name="next"
          value={product.isActive === 1 ? "0" : "1"}
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {product.isActive === 1 ? "สินค้าเปิดใช้งาน" : "สินค้าถูกปิดใช้งาน"}
            </p>
            <p className="text-[11px] text-slate-500">
              ปิดใช้งาน = ไม่แสดงในหน้าขาย แต่ประวัติยังอยู่ครบ
            </p>
          </div>
          <button
            type="submit"
            className={`btn-sm shrink-0 ${
              product.isActive === 1
                ? "border border-red-200 text-red-600"
                : "bg-brand-600 text-white"
            }`}
          >
            {product.isActive === 1 ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          ประวัติการแก้ราคา
        </h2>
        {logs.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-500">
            ยังไม่มีการแก้ราคา
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-2 py-2">
                <div>
                  <p className="text-sm text-slate-700">
                    {FIELD_LABEL[log.field] ?? log.field}:{" "}
                    <span className="text-slate-500 line-through">
                      ฿{formatTHB(log.oldValue)}
                    </span>{" "}
                    → <span className="font-semibold">฿{formatTHB(log.newValue)}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {log.userName ?? "ไม่ทราบผู้ใช้"} ·{" "}
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

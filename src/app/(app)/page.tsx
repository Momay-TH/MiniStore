import Link from "next/link";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatTHB } from "@/lib/money";
import { startOfTodayBkk } from "@/lib/datetime";

export const metadata = { title: "ภาพรวม" };

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const today = startOfTodayBkk();

  const todayRow = (
    await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${sales.total}), 0)`,
      })
      .from(sales)
      .where(gte(sales.createdAt, today))
  )[0];

  const creditRow = (
    await db
      .select({
        total: sql<number>`coalesce(sum(${sales.total} - ${sales.paidAmount}), 0)`,
      })
      .from(sales)
      .where(sql`${sales.status} <> 'PAID'`)
  )[0];

  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      stockQty: products.stockQty,
      reorderPoint: products.reorderPoint,
      baseUnit: products.baseUnit,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, 1),
        lte(products.stockQty, products.reorderPoint),
        gte(products.reorderPoint, 0),
      ),
    )
    .orderBy(products.stockQty)
    .limit(5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">
          สวัสดี {user.displayName || user.username}
        </h1>
        <p className="text-xs text-slate-400">ภาพรวมร้านวันนี้</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="ยอดขายวันนี้"
          value={`฿${formatTHB(Number(todayRow?.total ?? 0))}`}
          hint={`${Number(todayRow?.count ?? 0)} บิล`}
          tone="brand"
        />
        <Stat
          label="ลูกหนี้คงค้าง"
          value={`฿${formatTHB(Number(creditRow?.total ?? 0))}`}
          hint="ทุกบิลที่ยังไม่ครบ"
          tone="amber"
        />
      </div>

      <Link
        href="/pos"
        className="flex items-center justify-between rounded-2xl bg-brand-600 px-4 py-4 text-white shadow-sm active:scale-[0.99]"
      >
        <span>
          <span className="block text-base font-semibold">เปิดหน้าขาย</span>
          <span className="block text-xs text-white/70">
            ขายเดี่ยว / ยกลัง · เงินสด โอน หรือค้างชำระ
          </span>
        </span>
        <span className="text-2xl">→</span>
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            สินค้าใกล้หมด
          </h2>
          <Link href="/stock" className="text-xs text-brand-600">
            ดูทั้งหมด
          </Link>
        </div>

        {lowStock.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            ยังไม่มีสินค้าใกล้หมด
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lowStock.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="truncate text-slate-700">{p.name}</span>
                <span className="ml-2 shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {p.stockQty} {p.baseUnit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        href="/reports"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 active:bg-slate-50"
      >
        <span>
          <span className="block text-base font-semibold text-slate-800">
            ดูรายงาน
          </span>
          <span className="block text-xs text-slate-400">
            ยอดขาย · สินค้าขายดี · สต็อก · หนี้ค้าง
          </span>
        </span>
        <span className="text-2xl text-slate-400">→</span>
      </Link>

      {user.role === "OWNER" ? (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/users"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50"
          >
            <span className="text-sm font-semibold text-slate-800">
              จัดการผู้ใช้
            </span>
            <span className="text-slate-400">→</span>
          </Link>
          <Link
            href="/products/categories"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50"
          >
            <span className="text-sm font-semibold text-slate-800">
              หมวดหมู่
            </span>
            <span className="text-slate-400">→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "amber";
}) {
  const styles =
    tone === "brand"
      ? "from-brand-600 to-brand-700 text-white"
      : "from-amber-500 to-amber-600 text-white";
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${styles} p-4 shadow-sm`}
    >
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-white/70">{hint}</p>
    </div>
  );
}

import Link from "next/link";
import { eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AGING_BUCKETS, agingBucket } from "@/lib/aging";
import { daysBetween, formatDate, startOfTodayBkk } from "@/lib/datetime";
import { formatTHB, formatTHBCompact } from "@/lib/money";

export const metadata = { title: "รายงาน" };

const RANGE_OPTIONS = [
  { key: "7", label: "7 วัน", days: 7 },
  { key: "30", label: "30 วัน", days: 30 },
  { key: "90", label: "90 วัน", days: 90 },
];

export default async function ReportsPage(props: PageProps<"/reports">) {
  await requireUser();
  const searchParams = await props.searchParams;
  const rangeKey = RANGE_OPTIONS.some((r) => r.key === searchParams.range)
    ? searchParams.range
    : "30";
  const range = RANGE_OPTIONS.find((r) => r.key === rangeKey)!;
  const days = range.days;

  const db = getDb();
  const today = startOfTodayBkk();
  const fromMs = today - (days - 1) * 86_400_000;

  // ---------- ขายในช่วง ----------
  const saleRows = await db
    .select({
      id: sales.id,
      code: sales.code,
      createdAt: sales.createdAt,
      total: sales.total,
      paidAmount: sales.paidAmount,
      status: sales.status,
      customerId: sales.customerId,
      customerName: customers.name,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(gte(sales.createdAt, fromMs))
    .orderBy(sales.createdAt);

  const saleIds = saleRows.map((s) => s.id);
  const itemRows =
    saleIds.length === 0
      ? []
      : await db
          .select({
            saleId: saleItems.saleId,
            productId: saleItems.productId,
            productName: saleItems.productName,
            qtyBase: saleItems.qtyBase,
            lineTotal: saleItems.lineTotal,
          })
          .from(saleItems)
          .where(sql`${saleItems.saleId} in (${sql.join(
            saleIds.map((id) => sql`${id}`),
            sql`, `,
          )})`);

  // ---------- รวม ----------
  const totalSales = saleRows.reduce((s, r) => s + r.total, 0);
  const totalPaid = saleRows.reduce((s, r) => s + r.paidAmount, 0);
  const totalCredit = saleRows.reduce(
    (s, r) => s + Math.max(0, r.total - r.paidAmount),
    0,
  );
  const billCount = saleRows.length;
  const avgBill = billCount > 0 ? Math.round(totalSales / billCount) : 0;

  // ---------- รายวัน ----------
  const dailyMap = new Map<
    string,
    { date: number; bills: number; total: number; credit: number }
  >();
  for (const s of saleRows) {
    const key = new Date(s.createdAt + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const prev = dailyMap.get(key);
    if (prev) {
      prev.bills += 1;
      prev.total += s.total;
      prev.credit += Math.max(0, s.total - s.paidAmount);
    } else {
      dailyMap.set(key, {
        date: s.createdAt,
        bills: 1,
        total: s.total,
        credit: Math.max(0, s.total - s.paidAmount),
      });
    }
  }
  const daily = [...dailyMap.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // ---------- สินค้าขายดี ----------
  const productAgg = new Map<
    string,
    { name: string; qty: number; value: number }
  >();
  for (const it of itemRows) {
    const prev = productAgg.get(it.productId);
    if (prev) {
      prev.qty += it.qtyBase;
      prev.value += it.lineTotal;
    } else {
      productAgg.set(it.productId, {
        name: it.productName,
        qty: it.qtyBase,
        value: it.lineTotal,
      });
    }
  }
  const topProducts = [...productAgg.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ---------- สต็อกปัจจุบัน ----------
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      stockQty: products.stockQty,
      reorderPoint: products.reorderPoint,
      costPerBase: products.costPerBase,
      baseUnit: products.baseUnit,
      isActive: products.isActive,
    })
    .from(products);

  const activeProducts = productRows.filter((p) => p.isActive === 1);
  const lowStock = activeProducts.filter(
    (p) => p.stockQty > 0 && p.stockQty <= p.reorderPoint,
  );
  const outStock = activeProducts.filter((p) => p.stockQty <= 0);
  const stockValue = activeProducts.reduce(
    (s, p) => s + p.stockQty * p.costPerBase,
    0,
  );
  const topStock = [...activeProducts]
    .sort((a, b) => b.stockQty * b.costPerBase - a.stockQty * a.costPerBase)
    .slice(0, 5);

  // ---------- หนี้ ----------
  const debtRows = await db
    .select({
      saleId: sales.id,
      customerId: sales.customerId,
      customerName: customers.name,
      createdAt: sales.createdAt,
      due: sql<number>`${sales.total} - ${sales.paidAmount}`,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(ne(sales.status, "PAID"));

  const debts = debtRows.filter((r) => Number(r.due) > 0);
  const debtTotal = debts.reduce((s, r) => s + Number(r.due), 0);
  const debtByCustomer = new Map<
    string,
    { name: string; due: number; bills: number; oldest: number }
  >();
  for (const r of debts) {
    const key = r.customerId ?? "unknown";
    const prev = debtByCustomer.get(key);
    const days = daysBetween(r.createdAt);
    if (prev) {
      prev.due += Number(r.due);
      prev.bills += 1;
      prev.oldest = Math.max(prev.oldest, days);
    } else {
      debtByCustomer.set(key, {
        name: r.customerName ?? "ไม่ระบุลูกค้า",
        due: Number(r.due),
        bills: 1,
        oldest: days,
      });
    }
  }
  const topDebtors = [...debtByCustomer.values()]
    .sort((a, b) => b.due - a.due)
    .slice(0, 8);

  const bucketTotals = new Map<string, number>();
  for (const r of debts) {
    const b = agingBucket(daysBetween(r.createdAt));
    bucketTotals.set(b, (bucketTotals.get(b) ?? 0) + Number(r.due));
  }

  const maxDaily = Math.max(...daily.map((d) => d.total), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">รายงาน</h1>
          <p className="text-xs text-slate-400">
            ช่วง {range.label} · {billCount} บิล ·{" "}
            {formatDate(fromMs)} – {formatDate(today + 86_400_000 - 1)}
          </p>
        </div>
        <Link href="/stock" className="btn-ghost btn-sm">
          สต็อก
        </Link>
      </div>

      {/* range selector */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {RANGE_OPTIONS.map((r) => (
          <Link
            key={r.key}
            href={`/reports?range=${r.key}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              rangeKey === r.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* ---------- ยอดขาย ---------- */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-slate-500">
          สรุปยอดขาย
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="ยอดขายรวม"
            value={`฿${formatTHB(totalSales)}`}
            hint={`${billCount} บิล`}
            tone="brand"
          />
          <StatCard
            label="รับเงินแล้ว"
            value={`฿${formatTHB(totalPaid)}`}
            hint={`เฉลี่ย ฿${formatTHB(avgBill)}/บิล`}
            tone="emerald"
          />
          <StatCard
            label="ค้างชำระ"
            value={`฿${formatTHB(totalCredit)}`}
            hint="ในช่วงนี้"
            tone="amber"
          />
          <StatCard
            label="จำนวนบิล"
            value={billCount.toLocaleString("th-TH")}
            hint={`${days} วัน`}
            tone="slate"
          />
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            ยอดขายรายวัน
          </h3>
          {daily.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              ยังไม่มีการขายในช่วงนี้
            </p>
          ) : (
            <ul className="space-y-2">
              {daily.map((d) => (
                <li key={d.key} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[11px] text-slate-500">
                    {formatDate(d.date)}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${Math.max(4, (d.total / maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold text-slate-700">
                    ฿{formatTHBCompact(d.total)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[10px] text-slate-400">
                    {d.bills}บิล
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            สินค้าขายดี (ตามมูลค่า)
          </h3>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              ยังไม่มีข้อมูล
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topProducts.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-700">
                      <span className="mr-1.5 text-[11px] text-slate-400">
                        {i + 1}.
                      </span>
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {p.qty} หน่วยฐาน
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-800">
                    ฿{formatTHBCompact(p.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------- สต็อก ---------- */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-slate-500">
          สรุปสต็อกปัจจุบัน
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="รายการสินค้า"
            value={activeProducts.length.toLocaleString("th-TH")}
            hint="เปิดใช้งาน"
            tone="slate"
          />
          <StatCard
            label="มูลค่าสต็อก"
            value={`฿${formatTHBCompact(stockValue)}`}
            hint="ตามราคาทุน"
            tone="brand"
          />
          <StatCard
            label="ใกล้หมด"
            value={lowStock.length.toLocaleString("th-TH")}
            hint="≤ จุดเตือน"
            tone="amber"
          />
          <StatCard
            label="หมดสต็อก"
            value={outStock.length.toLocaleString("th-TH")}
            hint="0 หน่วย"
            tone="red"
          />
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            สินค้ามูลค่าสต็อกสูงสุด
          </h3>
          {topStock.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              ยังไม่มีข้อมูล
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-700">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.stockQty} {p.baseUnit} · ฿
                      {formatTHBCompact(p.costPerBase)}/{p.baseUnit}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-800">
                    ฿{formatTHBCompact(p.stockQty * p.costPerBase)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------- หนี้ ---------- */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-slate-500">
          หนี้ค้างชำระ
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="ยอดค้างรวม"
            value={`฿${formatTHB(debtTotal)}`}
            hint={`${debts.length} บิล`}
            tone="amber"
          />
          <StatCard
            label="ลูกหนี้"
            value={topDebtors.length.toLocaleString("th-TH")}
            hint="ราย"
            tone="slate"
          />
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Aging (อายุหนี้)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {AGING_BUCKETS.map((b) => (
              <div key={b.key} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">{b.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-800">
                  ฿{formatTHBCompact(bucketTotals.get(b.key) ?? 0)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {debts.filter((r) => agingBucket(daysBetween(r.createdAt)) === b.key).length} บิล
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            ลูกหนี้สูงสุด
          </h3>
          {topDebtors.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              ไม่มียอดค้าง — ดีมาก!
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topDebtors.map((c) => (
                <li key={c.name}>
                  <Link
                    href="/debts"
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">{c.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.bills} บิล · เก่าสุด {c.oldest} วัน
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-amber-700">
                      ฿{formatTHB(c.due)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Link
        href="/debts"
        className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 active:bg-slate-50"
      >
        ดูรายละเอียดหนี้ทั้งหมด →
      </Link>

      {/* ---------- Export ---------- */}
      <div className="card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">
          ดาวน์โหลด CSV (เปิดใน Excel ได้)
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`/api/export/sales?days=${range.days}`}
            className="btn-ghost btn-sm"
          >
            ยอดขาย
          </a>
          <a
            href="/api/export/stock"
            className="btn-ghost btn-sm"
          >
            สต็อก
          </a>
          <a
            href="/api/export/customers"
            className="btn-ghost btn-sm"
          >
            ลูกค้า
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "emerald" | "amber" | "slate" | "red";
}) {
  const styles: Record<string, string> = {
    brand: "from-brand-600 to-brand-700 text-white",
    emerald: "from-emerald-600 to-emerald-700 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
    slate: "from-slate-600 to-slate-700 text-white",
    red: "from-red-500 to-red-600 text-white",
  };
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${styles[tone]} p-4 shadow-sm`}
    >
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-white/70">{hint}</p>
    </div>
  );
}

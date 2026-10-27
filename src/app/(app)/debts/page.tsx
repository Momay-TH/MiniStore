import Link from "next/link";
import { eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AGING_BUCKETS, agingBucket } from "@/lib/aging";
import { daysBetween } from "@/lib/datetime";
import { formatTHB } from "@/lib/money";
import { DebtsList, type DebtRow } from "./debts-list";

export const metadata = { title: "หนี้ค้างชำระ" };

export default async function DebtsPage() {
  await requireUser();
  const db = getDb();

  const raw = await db
    .select({
      saleId: sales.id,
      code: sales.code,
      customerId: sales.customerId,
      customerName: customers.name,
      createdAt: sales.createdAt,
      due: sql<number>`${sales.total} - ${sales.paidAmount}`,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(ne(sales.status, "PAID"))
    .orderBy(sales.createdAt);

  const rows: DebtRow[] = raw
    .map((r) => {
      const days = daysBetween(r.createdAt);
      return {
        saleId: r.saleId,
        code: r.code,
        customerId: r.customerId,
        customerName: r.customerName,
        createdAt: r.createdAt,
        days,
        due: Number(r.due),
        bucket: agingBucket(days),
      };
    })
    .filter((r) => r.due > 0);

  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.bucket, (totals.get(r.bucket) ?? 0) + r.due);
  }
  const grandTotal = rows.reduce((sum, r) => sum + r.due, 0);

  // สรุปตามลูกค้า
  const byCustomer = new Map<
    string,
    { id: string; name: string; due: number; bills: number; oldest: number }
  >();
  for (const r of rows) {
    const key = r.customerId ?? "unknown";
    const prev = byCustomer.get(key);
    if (prev) {
      prev.due += r.due;
      prev.bills += 1;
      prev.oldest = Math.max(prev.oldest, r.days);
    } else {
      byCustomer.set(key, {
        id: key,
        name: r.customerName ?? "ไม่ระบุลูกค้า",
        due: r.due,
        bills: 1,
        oldest: r.days,
      });
    }
  }
  const customerRows = [...byCustomer.values()].sort((a, b) => b.due - a.due);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-sm text-slate-500">
          ← กลับรายการลูกค้า
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">หนี้ค้างชำระ</h1>
        <p className="text-xs text-slate-500">
          {rows.length} บิล · {customerRows.length} ลูกค้า · อายุหนี้แบ่งตามวัน
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-amber-700 to-amber-500 p-4 text-white shadow-sm">
        <p className="text-xs text-white/70">ยอดค้างรวมทั้งร้าน</p>
        <p className="mt-1 text-3xl font-bold">฿{formatTHB(grandTotal)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AGING_BUCKETS.map((b) => (
          <div key={b.key} className="card p-3">
            <p className="text-[11px] text-slate-500">{b.label}</p>
            <p className="mt-0.5 text-base font-bold text-slate-800">
              ฿{formatTHB(totals.get(b.key) ?? 0)}
            </p>
            <p className="text-[10px] text-slate-500">
              {rows.filter((r) => r.bucket === b.key).length} บิล
            </p>
          </div>
        ))}
      </div>

      {customerRows.length > 0 ? (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            รวมตามลูกค้า
          </h2>
          <ul className="divide-y divide-slate-100">
            {customerRows.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.id === "unknown" ? "/debts" : `/customers/${c.id}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{c.name}</p>
                    <p className="text-[11px] text-slate-500">
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
        </div>
      ) : null}

      <h2 className="px-1 text-sm font-semibold text-slate-500">
        บิลค้างทั้งหมด (เก่าสุดก่อน)
      </h2>

      <DebtsList rows={rows} />
    </div>
  );
}

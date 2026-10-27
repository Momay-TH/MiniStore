import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatTHB } from "@/lib/money";
import { CustomersList, type CustomerRow } from "./customers-list";

export const metadata = { title: "ลูกค้า" };

export default async function CustomersPage(props: PageProps<"/customers">) {
  await requireUser();
  const searchParams = await props.searchParams;
  const created = searchParams.created === "1";

  const db = getDb();

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      creditLimit: customers.creditLimit,
      due: sql<number>`coalesce(sum(case when ${sales.status} <> 'PAID' then ${sales.total} - ${sales.paidAmount} else 0 end), 0)`,
      openBills: sql<number>`coalesce(sum(case when ${sales.status} <> 'PAID' then 1 else 0 end), 0)`,
    })
    .from(customers)
    .leftJoin(sales, eq(sales.customerId, customers.id))
    .where(eq(customers.isActive, 1))
    .groupBy(customers.id)
    .orderBy(customers.name);

  const list = rows.map((r) => ({
    ...r,
    due: Number(r.due),
    openBills: Number(r.openBills),
  })) as CustomerRow[];

  const totalDue = list.reduce((sum, r) => sum + r.due, 0);
  const debtors = list.filter((r) => r.due > 0).length;

  return (
    <div className="space-y-4">
      {created ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          เพิ่มลูกค้าแล้ว
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">ลูกค้า</h1>
          <p className="text-xs text-slate-400">
            {list.length} ราย · ค้างชำระ {debtors} ราย
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/debts" className="btn-ghost btn-sm">
            หนี้ค้าง
          </Link>
          <Link href="/customers/new" className="btn-primary h-9 px-3 text-xs">
            + เพิ่มลูกค้า
          </Link>
        </div>
      </div>

      {totalDue > 0 ? (
        <Link
          href="/debts"
          className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-amber-600 to-amber-500 px-4 py-3 text-white shadow-sm"
        >
          <span className="text-xs text-white/80">ยอดค้างชำระรวม</span>
          <span className="text-xl font-bold">฿{formatTHB(totalDue)}</span>
        </Link>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
          ไม่มียอดค้างชำระ — เก็บเงินครบทุกบิลแล้ว
        </p>
      )}

      <CustomersList rows={list} />
    </div>
  );
}

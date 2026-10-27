import Link from "next/link";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, saleItems, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatTHB } from "@/lib/money";
import { formatDateTime, startOfTodayBkk } from "@/lib/datetime";
import { Pagination, parsePage } from "@/components/ui/pagination";

export const metadata = { title: "ประวัติการขาย" };

const PAGE_SIZE = 30;

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
  CREDIT: "เชื่อ",
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PAID: "ชำระแล้ว",
  PARTIAL: "บางส่วน",
  UNPAID: "ค้างชำระ",
};

export default async function SalesPage(props: PageProps<"/sales">) {
  await requireUser();
  const db = getDb();
  const searchParams = await props.searchParams;

  const today = startOfTodayBkk();

  const todayRow = (
    await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${sales.total}), 0)`,
        credit: sql<number>`coalesce(sum(${sales.total} - ${sales.paidAmount}), 0)`,
      })
      .from(sales)
      .where(gte(sales.createdAt, today))
  )[0];

  const totalRow = (
    await db.select({ n: sql<number>`count(*)` }).from(sales)
  )[0];
  const totalCount = Number(totalRow?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = parsePage(searchParams.page, totalPages);

  const rows = await db
    .select({
      id: sales.id,
      code: sales.code,
      createdAt: sales.createdAt,
      total: sales.total,
      paidAmount: sales.paidAmount,
      method: sales.method,
      status: sales.status,
      customerName: customers.name,
      itemCount: sql<number>`count(${saleItems.id})`,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
    .groupBy(sales.id)
    .orderBy(desc(sales.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-600 p-4 text-white shadow-sm">
        <p className="text-xs text-white/70">ยอดขายวันนี้</p>
        <p className="mt-1 text-3xl font-bold">
          ฿{formatTHB(Number(todayRow?.total ?? 0))}
        </p>
        <div className="mt-3 flex gap-4 text-xs text-white/80">
          <span>{Number(todayRow?.count ?? 0)} บิล</span>
          <span>
            ค้างชำระ ฿{formatTHB(Number(todayRow?.credit ?? 0))}
          </span>
        </div>
      </div>

      <h2 className="px-1 text-sm font-semibold text-slate-500">
        รายการล่าสุด
        {totalCount > 0 ? (
          <span className="font-normal text-slate-500">
            {" "}
            · ทั้งหมด {totalCount} บิล
          </span>
        ) : null}
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">
          ยังไม่มีการขาย — เริ่มที่เมนู “ขาย”
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/sales/${row.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 active:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {row.code}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        STATUS_STYLE[row.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {row.customerName ?? "ลูกค้าทั่วไป"} ·{" "}
                    {METHOD_LABEL[row.method] ?? row.method} ·{" "}
                    {Number(row.itemCount)} รายการ
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-base font-bold text-slate-900">
                  ฿{formatTHB(row.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => (p === 1 ? "/sales" : `/sales?page=${p}`)}
      />
    </div>
  );
}

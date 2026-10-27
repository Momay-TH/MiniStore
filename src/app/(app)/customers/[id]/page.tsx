import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, payments, sales } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AGING_BUCKETS, agingBucket } from "@/lib/aging";
import { daysBetween, formatDate, formatDateTime } from "@/lib/datetime";
import { formatTHB } from "@/lib/money";
import { toggleCustomerActive, updateCustomer } from "../actions";
import { CustomerForm } from "../customer-form";
import { PaymentForm } from "./payment-form";

export const metadata = { title: "รายละเอียดลูกค้า" };

const STATUS_LABEL: Record<string, string> = {
  PAID: "ชำระแล้ว",
  PARTIAL: "บางส่วน",
  UNPAID: "ค้างชำระ",
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
};

export default async function CustomerDetailPage(
  props: PageProps<"/customers/[id]">,
) {
  await requireUser();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const db = getDb();

  const customer = (
    await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  )[0];
  if (!customer) notFound();

  const openBills = await db
    .select({
      id: sales.id,
      code: sales.code,
      createdAt: sales.createdAt,
      total: sales.total,
      paidAmount: sales.paidAmount,
      status: sales.status,
    })
    .from(sales)
    .where(and(eq(sales.customerId, id), ne(sales.status, "PAID")))
    .orderBy(sales.createdAt);

  const recentBills = await db
    .select({
      id: sales.id,
      code: sales.code,
      createdAt: sales.createdAt,
      total: sales.total,
      paidAmount: sales.paidAmount,
      status: sales.status,
    })
    .from(sales)
    .where(eq(sales.customerId, id))
    .orderBy(desc(sales.createdAt))
    .limit(10);

  const paymentRows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      note: payments.note,
      createdAt: payments.createdAt,
      saleCode: sales.code,
    })
    .from(payments)
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(eq(payments.customerId, id))
    .orderBy(desc(payments.createdAt))
    .limit(30);

  const due = openBills.reduce(
    (sum, s) => sum + Math.max(0, s.total - s.paidAmount),
    0,
  );
  const remainingCredit =
    customer.creditLimit > 0 ? customer.creditLimit - due : null;
  const overLimit = remainingCredit !== null && remainingCredit < 0;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-sm text-slate-500">
          ← กลับรายการลูกค้า
        </Link>

        {searchParams.created === "1" ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            เพิ่มลูกค้าแล้ว
          </p>
        ) : null}

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900">
              {customer.name}
            </h1>
            <p className="text-xs text-slate-400">
              {customer.phone || "ไม่มีเบอร์"} · เพิ่มเมื่อ{" "}
              {formatDate(customer.createdAt)}
            </p>
          </div>
          {customer.isActive !== 1 ? (
            <span className="badge shrink-0 bg-slate-200 text-slate-600">
              ปิดใช้งาน
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={`rounded-2xl p-4 text-white shadow-sm ${
          due > 0
            ? "bg-gradient-to-br from-amber-700 to-amber-500"
            : "bg-gradient-to-br from-brand-700 to-brand-600"
        }`}
      >
        <p className="text-xs text-white/70">
          {due > 0 ? "ยอดค้างชำระ" : "สถานะหนี้"}
        </p>
        <p className="mt-1 text-3xl font-bold">
          {due > 0 ? `฿${formatTHB(due)}` : "ไม่มีหนี้"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <span>{openBills.length} บิลค้าง</span>
          {customer.creditLimit > 0 ? (
            <span>
              วงเงิน ฿{formatTHB(customer.creditLimit)} ·{" "}
              {overLimit ? (
                <span className="font-semibold text-white">
                  เกิน ฿{formatTHB(Math.abs(remainingCredit ?? 0))}
                </span>
              ) : (
                <>ใช้ได้อีก ฿{formatTHB(remainingCredit ?? 0)}</>
              )}
            </span>
          ) : (
            <span>ไม่จำกัดวงเงิน</span>
          )}
        </div>
      </div>

      {due > 0 ? <PaymentForm customerId={customer.id} due={due} /> : null}

      {openBills.length > 0 ? (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            บิลที่ยังค้าง ({openBills.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {openBills.map((s) => {
              const days = daysBetween(s.createdAt);
              const bucket = AGING_BUCKETS.find(
                (b) => b.key === agingBucket(days),
              );
              return (
                <li key={s.id} className="py-2">
                  <Link
                    href={`/sales/${s.id}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-500">{s.code}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(s.createdAt)} · {days} วัน ·{" "}
                        {STATUS_LABEL[s.status] ?? s.status}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-amber-700">
                        ฿{formatTHB(s.total - s.paidAmount)}
                      </p>
                      <span className={`badge ${bucket?.style ?? ""}`}>
                        {bucket?.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {recentBills.length > 0 ? (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            บิลล่าสุด
          </h2>
          <ul className="divide-y divide-slate-100">
            {recentBills.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{s.code}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`badge ${
                        STATUS_STYLE[s.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      ฿{formatTHB(s.total)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          ประวัติรับชำระ
        </h2>
        {paymentRows.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">
            ยังไม่มีการรับชำระ
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {paymentRows.map((p) => (
              <li key={p.id} className="flex items-start justify-between py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    {p.method === "TRANSFER" ? "โอน" : "เงินสด"}
                    {p.saleCode ? (
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        {p.saleCode}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-700">
                  +฿{formatTHB(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="card overflow-hidden">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-slate-700">
          แก้ไขข้อมูลลูกค้า
        </summary>
        <div className="border-t border-slate-100 p-4">
          <CustomerForm
            action={updateCustomer}
            submitLabel="บันทึกการแก้ไข"
            defaults={{
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
              creditLimit: customer.creditLimit,
              note: customer.note,
            }}
          />
        </div>
      </details>

      <form action={toggleCustomerActive} className="card p-4">
        <input type="hidden" name="id" value={customer.id} />
        <input
          type="hidden"
          name="next"
          value={customer.isActive === 1 ? "0" : "1"}
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {customer.isActive === 1
                ? "ลูกค้าเปิดใช้งาน"
                : "ลูกค้าถูกปิดใช้งาน"}
            </p>
            <p className="text-[11px] text-slate-400">
              ปิดใช้งาน = ไม่แสดงตอนขายเชื่อ แต่ประวัติ/หนี้ยังอยู่ครบ
            </p>
          </div>
          <button
            type="submit"
            className={`btn-sm shrink-0 ${
              customer.isActive === 1
                ? "border border-red-200 text-red-600"
                : "bg-brand-600 text-white"
            }`}
          >
            {customer.isActive === 1 ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        </div>
      </form>
    </div>
  );
}

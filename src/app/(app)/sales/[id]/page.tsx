import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, products, saleItems, sales, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatTHB } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "รายละเอียดบิล" };

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
  CREDIT: "ค้างชำระ",
};

export default async function SaleDetailPage(props: PageProps<"/sales/[id]">) {
  await requireUser();
  const { id } = await props.params;
  const db = getDb();

  const sale = (
    await db
      .select({
        id: sales.id,
        code: sales.code,
        createdAt: sales.createdAt,
        subtotal: sales.subtotal,
        discount: sales.discount,
        total: sales.total,
        paidAmount: sales.paidAmount,
        cashReceived: sales.cashReceived,
        changeAmount: sales.changeAmount,
        method: sales.method,
        status: sales.status,
        note: sales.note,
        customerName: customers.name,
        customerPhone: customers.phone,
        cashierName: users.displayName,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(users, eq(users.id, sales.userId))
      .where(eq(sales.id, id))
      .limit(1)
  )[0];

  if (!sale) notFound();

  const items = await db
    .select({
      id: saleItems.id,
      productName: saleItems.productName,
      saleUnit: saleItems.saleUnit,
      qty: saleItems.qty,
      qtyBase: saleItems.qtyBase,
      listPrice: saleItems.listPrice,
      unitPrice: saleItems.unitPrice,
      lineTotal: saleItems.lineTotal,
      baseUnit: products.baseUnit,
      packUnit: products.packUnit,
      packSize: products.packSize,
    })
    .from(saleItems)
    .leftJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, sale.id));

  const due = sale.total - sale.paidAmount;

  return (
    <div className="space-y-4">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        ← กลับประวัติการขาย
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-sm text-slate-500">{sale.code}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDateTime(sale.createdAt)}
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {METHOD_LABEL[sale.method] ?? sale.method}
          </span>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-sm">
          <p className="text-slate-600">
            ลูกค้า:{" "}
            <span className="font-medium text-slate-800">
              {sale.customerName ?? "ลูกค้าทั่วไป"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            ผู้ขาย: {sale.cashierName || "-"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">สินค้า</th>
              <th className="px-2 py-2 text-right font-medium">จำนวน</th>
              <th className="px-3 py-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const overridden = item.unitPrice !== item.listPrice;
              const unitLabel =
                item.saleUnit === "PACK"
                  ? (item.packUnit ?? "ลัง")
                  : (item.baseUnit ?? "หน่วย");
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ฿{formatTHB(item.unitPrice)} × {item.qty} {unitLabel}
                      {overridden ? (
                        <span className="ml-1 text-amber-600">
                          (ปกติ ฿{formatTHB(item.listPrice)})
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right text-slate-600">
                    {item.qtyBase} {item.baseUnit ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    ฿{formatTHB(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <Row label="รวม" value={`฿${formatTHB(sale.subtotal)}`} />
        {sale.discount > 0 ? (
          <Row label="ส่วนลด" value={`−฿${formatTHB(sale.discount)}`} />
        ) : null}
        <Row label="ยอดสุทธิ" value={`฿${formatTHB(sale.total)}`} bold />
        {sale.method === "CASH" && sale.cashReceived > 0 ? (
          <>
            <Row label="รับเงินสด" value={`฿${formatTHB(sale.cashReceived)}`} />
            <Row
              label="เงินทอน"
              value={`฿${formatTHB(sale.changeAmount)}`}
              className="text-emerald-700"
            />
          </>
        ) : null}
        <Row label="ชำระแล้ว" value={`฿${formatTHB(sale.paidAmount)}`} />
        {due > 0 ? (
          <Row
            label="ค้างชำระ"
            value={`฿${formatTHB(due)}`}
            className="text-amber-700"
          />
        ) : null}
      </div>

      {sale.note ? (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          หมายเหตุ: {sale.note}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  className = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex justify-between ${className}`}>
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "text-base font-bold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

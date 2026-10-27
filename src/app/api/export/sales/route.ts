import { eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sales } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { startOfTodayBkk } from "@/lib/datetime";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") ?? 30)));
  const fromMs = startOfTodayBkk() - (days - 1) * 86_400_000;

  const db = getDb();
  const rows = await db
    .select({
      code: sales.code,
      createdAt: sales.createdAt,
      customerName: customers.name,
      method: sales.method,
      status: sales.status,
      subtotal: sales.subtotal,
      discount: sales.discount,
      total: sales.total,
      paidAmount: sales.paidAmount,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(gte(sales.createdAt, fromMs))
    .orderBy(sales.createdAt);

  const csv = toCsv(
    [
      "เลขที่บิล",
      "วันที่",
      "ลูกค้า",
      "วิธีชำระ",
      "สถานะ",
      "รวม",
      "ส่วนลด",
      "ยอดสุทธิ",
      "ชำระแล้ว",
      "ค้างชำระ",
    ],
    rows.map((r) => [
      r.code,
      new Date(r.createdAt + 7 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16),
      r.customerName ?? "ลูกค้าทั่วไป",
      r.method,
      r.status,
      (r.subtotal / 100).toFixed(2),
      (r.discount / 100).toFixed(2),
      (r.total / 100).toFixed(2),
      (r.paidAmount / 100).toFixed(2),
      ((r.total - r.paidAmount) / 100).toFixed(2),
    ]),
  );

  return csvResponse(`sales-${days}d.csv`, csv);
}

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sales } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
      creditLimit: customers.creditLimit,
      isActive: customers.isActive,
      due: sql<number>`coalesce(sum(case when ${sales.status} <> 'PAID' then ${sales.total} - ${sales.paidAmount} else 0 end), 0)`,
      openBills: sql<number>`coalesce(sum(case when ${sales.status} <> 'PAID' then 1 else 0 end), 0)`,
    })
    .from(customers)
    .leftJoin(sales, eq(sales.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(customers.name);

  const csv = toCsv(
    ["ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่", "วงเงินเชื่อ", "ยอดค้าง", "บิลค้าง", "สถานะ"],
    rows.map((r) => [
      r.name,
      r.phone ?? "",
      r.address ?? "",
      (r.creditLimit / 100).toFixed(2),
      (Number(r.due) / 100).toFixed(2),
      Number(r.openBills),
      r.isActive === 1 ? "ใช้งาน" : "ปิดใช้งาน",
    ]),
  );

  return csvResponse("customers.csv", csv);
}

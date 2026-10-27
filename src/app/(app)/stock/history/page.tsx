import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products, stockMoves, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { HistoryList, type MoveRow } from "./history-list";

export const metadata = { title: "ประวัติสต็อก" };

const PAGE_SIZE = 50;

export default async function StockHistoryPage(
  props: PageProps<"/stock/history">,
) {
  await requireUser();
  const db = getDb();
  const searchParams = await props.searchParams;

  const totalRow = (
    await db.select({ n: sql<number>`count(*)` }).from(stockMoves)
  )[0];
  const totalCount = Number(totalRow?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = parsePage(searchParams.page, totalPages);

  const rows = await db
    .select({
      id: stockMoves.id,
      productName: products.name,
      baseUnit: products.baseUnit,
      type: stockMoves.type,
      qtyBase: stockMoves.qtyBase,
      unitCost: stockMoves.unitCost,
      note: stockMoves.note,
      refType: stockMoves.refType,
      refId: stockMoves.refId,
      userName: users.displayName,
      createdAt: stockMoves.createdAt,
    })
    .from(stockMoves)
    .innerJoin(products, eq(products.id, stockMoves.productId))
    .leftJoin(users, eq(users.id, stockMoves.userId))
    .orderBy(desc(stockMoves.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/stock" className="text-sm text-slate-500">
          ← กลับหน้าสต็อก
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">
          ความเคลื่อนไหวสต็อก
        </h1>
        <p className="text-xs text-slate-500">
          ทั้งหมด {totalCount} รายการ · ทุกการขาย/รับเข้า/ปรับยอดถูกบันทึกที่นี่
        </p>
      </div>

      <HistoryList rows={rows as MoveRow[]} />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) =>
          p === 1 ? "/stock/history" : `/stock/history?page=${p}`
        }
      />
    </div>
  );
}

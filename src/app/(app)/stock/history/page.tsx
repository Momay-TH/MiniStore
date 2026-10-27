import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products, stockMoves, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { HistoryList, type MoveRow } from "./history-list";

export const metadata = { title: "ประวัติสต็อก" };

export default async function StockHistoryPage() {
  await requireUser();
  const db = getDb();

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
    .limit(150);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/stock" className="text-sm text-slate-500">
          ← กลับหน้าสต็อก
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">
          ความเคลื่อนไหวสต็อก
        </h1>
        <p className="text-xs text-slate-400">
          150 รายการล่าสุด · ทุกการขาย/รับเข้า/ปรับยอดถูกบันทึกที่นี่
        </p>
      </div>

      <HistoryList rows={rows as MoveRow[]} />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/datetime";

export type MoveRow = {
  id: string;
  productName: string;
  baseUnit: string;
  type: string;
  qtyBase: number;
  unitCost: number;
  note: string | null;
  refType: string | null;
  refId: string | null;
  userName: string | null;
  createdAt: number;
};

const TYPE_LABEL: Record<string, string> = {
  PURCHASE: "รับเข้า",
  SALE: "ขาย",
  ADJUST: "ปรับยอด",
  DAMAGE: "ของเสีย",
  RETURN: "คืนสินค้า",
  INIT: "ยกมา",
};

const TYPE_STYLE: Record<string, string> = {
  PURCHASE: "bg-emerald-100 text-emerald-700",
  SALE: "bg-sky-100 text-sky-700",
  ADJUST: "bg-amber-100 text-amber-700",
  DAMAGE: "bg-red-100 text-red-700",
  RETURN: "bg-purple-100 text-purple-700",
  INIT: "bg-slate-100 text-slate-500",
};

export function HistoryList({ rows }: { rows: MoveRow[] }) {
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, type, query]);

  const types = ["all", "PURCHASE", "SALE", "ADJUST", "DAMAGE", "INIT"];

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาสินค้า / หมายเหตุ"
        className="input"
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              type === t
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {t === "all" ? "ทั้งหมด" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
          ไม่พบรายการ
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {m.productName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(m.createdAt)} · {m.userName ?? "-"}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`badge ${
                      TYPE_STYLE[m.type] ?? "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {TYPE_LABEL[m.type] ?? m.type}
                  </span>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      m.qtyBase >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {m.qtyBase > 0 ? "+" : ""}
                    {m.qtyBase} {m.baseUnit}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

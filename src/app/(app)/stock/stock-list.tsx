"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type StockRow = {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  reorderPoint: number;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  costPerBase: number;
  pricePerBase: number;
};

type Filter = "all" | "low" | "out";

function packText(qty: number, packSize: number, packUnit: string) {
  if (packSize <= 1 || qty < packSize) return null;
  const packs = Math.floor(qty / packSize);
  return `${packs} ${packUnit}`;
}

export function StockList({ rows }: { rows: StockRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "low" && !(r.stockQty > 0 && r.stockQty <= r.reorderPoint))
        return false;
      if (filter === "out" && r.stockQty > 0) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อสินค้า / SKU"
        className="input"
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {(
          [
            ["all", `ทั้งหมด ${rows.length}`],
            ["low", "ใกล้หมด"],
            ["out", "หมดสต็อก"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">
          ไม่พบสินค้า
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const out = p.stockQty <= 0;
            const low = !out && p.stockQty <= p.reorderPoint;
            const pack = packText(p.stockQty, p.packSize, p.packUnit);
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}`}
                  className="card flex items-center justify-between gap-3 p-3 active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {p.sku}
                      {pack ? ` · ${pack}` : ""}
                      {p.reorderPoint > 0
                        ? ` · เตือนที่ ${p.reorderPoint} ${p.baseUnit}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 px-2 py-1 text-xs ${
                      out
                        ? "bg-red-100 text-red-700"
                        : low
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.stockQty} {p.baseUnit}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

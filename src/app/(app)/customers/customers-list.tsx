"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/money";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number;
  due: number;
  openBills: number;
};

export function CustomersList({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyDebt, setOnlyDebt] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (onlyDebt ? r.due > 0 : true))
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          (r.phone ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, "th"));
  }, [rows, query, onlyDebt]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อ / เบอร์โทร"
        className="input"
      />

      <div className="flex gap-2">
        {(
          [
            [false, `ทั้งหมด ${rows.length}`],
            [true, `มียอดค้าง ${rows.filter((r) => r.due > 0).length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setOnlyDebt(value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              onlyDebt === value
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
          ไม่พบลูกค้า
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="card flex items-center justify-between gap-3 p-3 active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {c.phone || "ไม่มีเบอร์"} ·{" "}
                    {c.openBills > 0 ? `ค้าง ${c.openBills} บิล` : "ไม่มีหนี้"}
                    {c.creditLimit > 0
                      ? ` · วงเงิน ฿${formatTHB(c.creditLimit)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    c.due > 0 ? "text-amber-700" : "text-slate-300"
                  }`}
                >
                  ฿{formatTHB(c.due)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

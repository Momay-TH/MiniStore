"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AGING_BUCKETS, type AgingBucket } from "@/lib/aging";
import { formatDateTime } from "@/lib/datetime";
import { formatTHB } from "@/lib/money";

export type DebtRow = {
  saleId: string;
  code: string;
  customerId: string | null;
  customerName: string | null;
  createdAt: number;
  days: number;
  due: number;
  bucket: AgingBucket;
};

export function DebtsList({ rows }: { rows: DebtRow[] }) {
  const [bucket, setBucket] = useState<"all" | AgingBucket>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (bucket !== "all" && r.bucket !== bucket) return false;
      if (!q) return true;
      return (
        (r.customerName ?? "").toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
      );
    });
  }, [rows, bucket, query]);

  const shownTotal = filtered.reduce((sum, r) => sum + r.due, 0);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาลูกค้า / เลขที่บิล"
        className="input"
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        <button
          type="button"
          onClick={() => setBucket("all")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            bucket === "all"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          ทั้งหมด {rows.length}
        </button>
        {AGING_BUCKETS.map((b) => {
          const count = rows.filter((r) => r.bucket === b.key).length;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setBucket(b.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                bucket === b.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
              }`}
            >
              {b.label} {count}
            </button>
          );
        })}
      </div>

      <p className="px-1 text-xs text-slate-500">
        {filtered.length} บิล · รวม{" "}
        <span className="font-semibold text-amber-700">
          ฿{formatTHB(shownTotal)}
        </span>
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
          ไม่มีบิลค้างในกลุ่มนี้
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const style =
              AGING_BUCKETS.find((b) => b.key === r.bucket)?.style ?? "";
            const label =
              AGING_BUCKETS.find((b) => b.key === r.bucket)?.label ?? r.bucket;
            return (
              <li key={r.saleId}>
                <Link
                  href={`/sales/${r.saleId}`}
                  className="card flex items-center justify-between gap-3 p-3 active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {r.customerName ?? "ไม่ระบุลูกค้า"}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {r.code}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(r.createdAt)} · {r.days} วัน
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-amber-700">
                      ฿{formatTHB(r.due)}
                    </p>
                    <span className={`badge mt-1 ${style}`}>{label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

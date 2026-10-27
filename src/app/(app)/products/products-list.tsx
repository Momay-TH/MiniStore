"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarcodeScanner, ScanButton } from "@/components/barcode-scanner";
import { formatTHB } from "@/lib/money";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  pricePerBase: number;
  pricePerPack: number;
  stockQty: number;
  reorderPoint: number;
  isActive: number;
};

export function ProductsList({
  rows,
  categories,
}: {
  rows: ProductRow[];
  categories: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function handleScanned(raw: string) {
    const code = raw.trim();
    setScannerOpen(false);
    const found = rows.find((r) => (r.barcode ?? "").trim() === code);
    if (!found) {
      setScanNotice({ ok: false, text: `ไม่พบสินค้าจากบาร์โค้ด ${code}` });
      return;
    }
    setShowInactive(true);
    setCat("all");
    setQuery(found.barcode ?? found.sku);
    setScanNotice({
      ok: true,
      text: `พบ ${found.name} · เหลือ ${found.stockQty} ${found.baseUnit}`,
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showInactive && r.isActive !== 1) return false;
      if (cat !== "all" && r.categoryId !== cat) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, cat, showInactive]);

  const inactiveCount = rows.filter((r) => r.isActive !== 1).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด"
          className="input flex-1"
        />
        <ScanButton
          active={scannerOpen}
          onClick={() => setScannerOpen((v) => !v)}
        />
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanned}
      />

      {scanNotice ? (
        <button
          type="button"
          onClick={() => setScanNotice(null)}
          className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-medium ${
            scanNotice.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {scanNotice.text} (แตะเพื่อปิด)
        </button>
      ) : null}


      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        <Chip active={cat === "all"} onClick={() => setCat("all")} label="ทั้งหมด" />
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={cat === c.id}
            onClick={() => setCat(c.id)}
            label={c.name}
          />
        ))}
      </div>

      {inactiveCount > 0 ? (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          แสดงสินค้าที่ปิดใช้งาน ({inactiveCount})
        </label>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">
          ไม่พบสินค้า
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}`}
                className="card block p-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {p.name}
                      </p>
                      {p.isActive !== 1 ? (
                        <span className="badge bg-slate-200 text-slate-600">
                          ปิดใช้งาน
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {p.categoryName ?? "ไม่ระบุหมวด"} · {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 ${
                      p.stockQty <= p.reorderPoint
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {p.stockQty} {p.baseUnit}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    เดี่ยว{" "}
                    <span className="font-semibold text-slate-800">
                      ฿{formatTHB(p.pricePerBase)}
                    </span>
                  </span>
                  <span>
                    {p.packUnit}{" "}
                    <span className="font-semibold text-slate-800">
                      ฿{formatTHB(p.pricePerPack)}
                    </span>
                    <span className="text-slate-500"> ({p.packSize} {p.baseUnit})</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

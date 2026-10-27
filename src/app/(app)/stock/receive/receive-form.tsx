"use client";

import { useActionState, useState } from "react";
import { BarcodeScanner, ScanButton } from "@/components/barcode-scanner";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { formatDate } from "@/lib/datetime";
import { formatTHB, satangToInput } from "@/lib/money";
import { receiveStock } from "../actions";
import type { FormState } from "../../products/actions";

export type StockProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  isActive: number;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  costPerBase: number;
  stockQty: number;
  /** เวลารับเข้าล่าสุด (ms) — null = ยังไม่เคยรับเข้า */
  lastReceivedAt: number | null;
};

export function ReceiveForm({ products }: { products: StockProduct[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    receiveStock,
    {},
  );
  const [productId, setProductId] = useState("");
  const [unit, setUnit] = useState<"BASE" | "PACK">("PACK");
  const [qty, setQty] = useState("1");

  // สแกนบาร์โค้ด / พิมพ์บาร์โค้ด
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanMessage, setScanMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const selected = products.find((p) => p.id === productId);
  const packSize = selected?.packSize ?? 1;
  const qtyBase = (Number(qty) || 0) * (unit === "PACK" ? packSize : 1);

  function pickByBarcode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const found = products.find((p) => (p.barcode ?? "").trim() === code);
    if (!found) {
      setScanMessage({ ok: false, text: `ไม่พบสินค้าจากบาร์โค้ด ${code}` });
      return;
    }
    setProductId(found.id);
    setBarcodeInput("");
    setScanMessage({
      ok: true,
      text: `เลือก ${found.name} แล้ว — กรอกจำนวนที่รับเข้า`,
    });
  }

  function handleScanned(code: string) {
    setScannerOpen(false);
    pickByBarcode(code);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <input
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              pickByBarcode(barcodeInput);
            }}
            placeholder="ยิง/พิมพ์บาร์โค้ดสินค้า"
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

        {scanMessage ? (
          <button
            type="button"
            onClick={() => setScanMessage(null)}
            className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-medium ${
              scanMessage.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {scanMessage.text} (แตะเพื่อปิด)
          </button>
        ) : null}

        <Field label="สินค้า">
          <select
            name="productId"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="input"
          >
            <option value="">— เลือกสินค้า —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isActive !== 1 ? " (ปิดใช้งาน)" : ""} (เหลือ {p.stockQty}{" "}
                {p.baseUnit})
              </option>
            ))}
          </select>
        </Field>

        {selected ? (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {selected.name}
                  {selected.isActive !== 1 ? (
                    <span className="ml-2 badge bg-slate-200 text-slate-600">
                      ปิดใช้งาน
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selected.sku} · {selected.barcode ?? "ไม่มีบาร์โค้ด"} ·{" "}
                  {selected.categoryName ?? "ไม่ระบุหมวด"}
                </p>
              </div>
              <span
                className={`badge shrink-0 ${
                  selected.stockQty > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selected.stockQty > 0
                  ? `คงเหลือ ${selected.stockQty} ${selected.baseUnit}`
                  : "หมดสต็อก"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <div>
                <dt className="text-slate-500">หน่วยฐาน</dt>
                <dd className="font-medium text-slate-700">
                  {selected.baseUnit}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  1 {selected.packUnit}
                </dt>
                <dd className="font-medium text-slate-700">
                  {selected.packSize} {selected.baseUnit}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">ทุน/หน่วยฐาน</dt>
                <dd className="font-medium text-slate-700">
                  ฿{formatTHB(selected.costPerBase)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">รับเข้าล่าสุด</dt>
                <dd className="font-medium text-slate-700">
                  {selected.lastReceivedAt
                    ? formatDate(selected.lastReceivedAt)
                    : "ยังไม่เคยรับเข้า"}
                </dd>
              </div>
            </dl>

            {selected.stockQty <= 0 ? (
              <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                {selected.lastReceivedAt
                  ? `สินค้านี้เคยอยู่ในสต็อก (รับเข้าล่าสุด ${formatDate(
                      selected.lastReceivedAt,
                    )}) แต่ตอนนี้หมด`
                  : "สินค้านี้ยังไม่เคยถูกบันทึกการรับเข้า"}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="รับเข้าเป็น">
            <div className="flex rounded-xl border border-slate-200 p-0.5">
              {(
                [
                  ["PACK", selected?.packUnit ?? "ลัง"],
                  ["BASE", selected?.baseUnit ?? "หน่วย"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUnit(value)}
                  className={`h-10 flex-1 rounded-lg text-sm font-medium ${
                    unit === value ? "bg-brand-600 text-white" : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="จำนวน">
            <input
              name="qty"
              type="number"
              min={1}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="input text-right"
            />
          </Field>
        </div>

        <input type="hidden" name="saleUnit" value={unit} />

        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          จะเพิ่มสต็อก{" "}
          <span className="font-semibold text-slate-800">
            {qtyBase} {selected?.baseUnit ?? "หน่วย"}
          </span>
          {unit === "PACK" ? ` (${qty || 0} × ${packSize})` : ""}
        </p>
      </div>

      <div className="card space-y-3 p-4">
        <Field
          label={`ต้นทุนต่อ ${unit === "PACK" ? (selected?.packUnit ?? "ลัง") : (selected?.baseUnit ?? "หน่วย")} (บาท)`}
          hint={
            selected
              ? `ทุนเดิม ${satangToInput(selected.costPerBase)} บาท/${selected.baseUnit}`
              : "เว้นว่าง = ใช้ทุนเดิม"
          }
        >
          <input
            name="unitCost"
            inputMode="decimal"
            className="input text-right"
            placeholder={
              selected
                ? unit === "PACK"
                  ? satangToInput(selected.costPerBase * selected.packSize)
                  : satangToInput(selected.costPerBase)
                : "0.00"
            }
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="updateCost"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300"
          />
          อัปเดตราคาทุนของสินค้าตามที่กรอก
        </label>

        <Field label="หมายเหตุ / ผู้ขาย">
          <input
            name="note"
            className="input"
            placeholder="เช่น ซื้อจากร้านค้าส่ง A"
          />
        </Field>
      </div>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <SubmitButton pendingText="กำลังบันทึก…">บันทึกรับเข้า</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { satangToInput } from "@/lib/money";
import { receiveStock } from "../actions";
import type { FormState } from "../../products/actions";

export type StockProduct = {
  id: string;
  name: string;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  costPerBase: number;
  stockQty: number;
};

export function ReceiveForm({ products }: { products: StockProduct[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    receiveStock,
    {},
  );
  const [productId, setProductId] = useState("");
  const [unit, setUnit] = useState<"BASE" | "PACK">("PACK");
  const [qty, setQty] = useState("1");

  const selected = products.find((p) => p.id === productId);
  const packSize = selected?.packSize ?? 1;
  const qtyBase = (Number(qty) || 0) * (unit === "PACK" ? packSize : 1);

  return (
    <form action={formAction} className="space-y-4">
      <div className="card space-y-3 p-4">
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
                {p.name} (เหลือ {p.stockQty} {p.baseUnit})
              </option>
            ))}
          </select>
        </Field>

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

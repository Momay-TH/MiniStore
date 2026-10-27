"use client";

import { useActionState, useState } from "react";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { adjustStock } from "../actions";
import type { FormState } from "../../products/actions";
import type { StockProduct } from "../receive/receive-form";

export function AdjustForm({ products }: { products: StockProduct[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    adjustStock,
    {},
  );
  const [productId, setProductId] = useState("");
  const [counted, setCounted] = useState("");

  const selected = products.find((p) => p.id === productId);
  const delta = selected && counted !== "" ? Number(counted) - selected.stockQty : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="card space-y-3 p-4">
        <Field label="สินค้า">
          <select
            name="productId"
            required
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              setCounted(p ? String(p.stockQty) : "");
            }}
            className="input"
          >
            <option value="">— เลือกสินค้า —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (ระบบมี {p.stockQty} {p.baseUnit})
              </option>
            ))}
          </select>
        </Field>

        <Field label={`นับได้จริง (${selected?.baseUnit ?? "หน่วย"})`}>
          <input
            name="counted"
            type="number"
            min={0}
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="input text-right text-lg font-semibold"
          />
        </Field>

        {selected && delta !== null ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              delta === 0
                ? "bg-slate-50 text-slate-500"
                : delta > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            ผลต่าง {delta > 0 ? "+" : ""}
            {delta} {selected.baseUnit}
            {delta < 0 ? " (ตัดออก)" : delta > 0 ? " (เพิ่ม)" : ""}
          </p>
        ) : null}

        <Field label="ประเภทการปรับ">
          <select name="type" className="input" defaultValue="ADJUST">
            <option value="ADJUST">นับสต็อก / ปรับยอด</option>
            <option value="DAMAGE">ของเสีย / แตกหัก</option>
          </select>
        </Field>

        <Field label="หมายเหตุ">
          <input
            name="note"
            className="input"
            placeholder="เช่น นับสต็อกประจำเดือน"
          />
        </Field>
      </div>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <SubmitButton pendingText="กำลังบันทึก…">บันทึกการปรับปรุง</SubmitButton>
    </form>
  );
}

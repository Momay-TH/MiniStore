"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { satangToInput } from "@/lib/money";
import type { FormState } from "./actions";

export type ProductDefaults = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  costPerBase: number;
  pricePerBase: number;
  pricePerPack: number;
  reorderPoint: number;
};

export function ProductForm({
  action,
  categories,
  defaults,
  submitLabel = "บันทึกสินค้า",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: { id: string; name: string }[];
  defaults?: ProductDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [packSize, setPackSize] = useState(defaults?.packSize ?? 12);

  return (
    <form action={formAction} className="space-y-4">
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="card space-y-3 p-4">
        <Field label="ชื่อสินค้า">
          <input
            name="name"
            required
            defaultValue={defaults?.name}
            className="input"
            placeholder="เช่น โค้ก 325 มล."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" hint="รหัสภายในร้าน ห้ามซ้ำ">
            <input
              name="sku"
              required
              defaultValue={defaults?.sku}
              className="input font-mono"
              placeholder="COKE325"
            />
          </Field>
          <Field label="บาร์โค้ด" hint="ไม่บังคับ">
            <input
              name="barcode"
              defaultValue={defaults?.barcode ?? ""}
              className="input font-mono"
              inputMode="numeric"
              placeholder="8850…"
            />
          </Field>
        </div>

        <Field label="หมวดหมู่">
          <select
            name="categoryId"
            defaultValue={defaults?.categoryId ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุ —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="card space-y-3 p-4">
        <p className="text-xs font-semibold text-slate-500">หน่วยนับ</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="หน่วยฐาน" hint="ขายเดี่ยว">
            <input
              name="baseUnit"
              required
              defaultValue={defaults?.baseUnit ?? "ขวด"}
              className="input"
            />
          </Field>
          <Field label="หน่วยยก" hint="ขายยกลัง">
            <input
              name="packUnit"
              required
              defaultValue={defaults?.packUnit ?? "ลัง"}
              className="input"
            />
          </Field>
        </div>

        <Field label="จำนวนต่อหน่วยยก" hint={`1 ${defaults?.packUnit ?? "ลัง"} = ? ${defaults?.baseUnit ?? "ขวด"}`}>
          <input
            name="packSize"
            type="number"
            min={1}
            required
            value={packSize}
            onChange={(e) => setPackSize(Number(e.target.value))}
            className="input"
          />
        </Field>
      </div>

      <div className="card space-y-3 p-4">
        <p className="text-xs font-semibold text-slate-500">
          ราคา (บาท) — ระบบเก็บเป็นสตางค์
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาทุน / หน่วยฐาน">
            <input
              name="costPerBase"
              inputMode="decimal"
              defaultValue={satangToInput(defaults?.costPerBase ?? 0)}
              className="input text-right"
            />
          </Field>
          <Field label="จุดเตือนสต็อกต่ำ" hint={defaults?.baseUnit ?? "ขวด"}>
            <input
              name="reorderPoint"
              type="number"
              min={0}
              defaultValue={defaults?.reorderPoint ?? 0}
              className="input text-right"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาขายเดี่ยว">
            <input
              name="pricePerBase"
              inputMode="decimal"
              defaultValue={satangToInput(defaults?.pricePerBase ?? 0)}
              className="input text-right"
            />
          </Field>
          <Field label="ราคาขายยกลัง">
            <input
              name="pricePerPack"
              inputMode="decimal"
              defaultValue={satangToInput(defaults?.pricePerPack ?? 0)}
              className="input text-right"
            />
          </Field>
        </div>
      </div>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/products" className="btn-ghost">
          ยกเลิก
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

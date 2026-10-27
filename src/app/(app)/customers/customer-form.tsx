"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { satangToInput } from "@/lib/money";
import type { FormState } from "./actions";

export type CustomerDefaults = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  note: string | null;
};

export function CustomerForm({
  action,
  defaults,
  submitLabel = "บันทึกลูกค้า",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: CustomerDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="card space-y-3 p-4">
        <Field label="ชื่อลูกค้า / ร้าน">
          <input
            name="name"
            required
            defaultValue={defaults?.name}
            className="input"
            placeholder="เช่น ร้านป้าแดง"
          />
        </Field>

        <Field label="เบอร์โทร" hint="ไม่บังคับ — ห้ามซ้ำ">
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={defaults?.phone ?? ""}
            className="input"
            placeholder="08x-xxx-xxxx"
          />
        </Field>

        <Field label="ที่อยู่ / จุดส่งของ" hint="ไม่บังคับ">
          <textarea
            name="address"
            rows={2}
            defaultValue={defaults?.address ?? ""}
            className="input h-auto py-2"
            placeholder="เช่น 45 ม.2 ต.บางพลี"
          />
        </Field>
      </div>

      <div className="card space-y-3 p-4">
        <Field
          label="วงเงินเชื่อ (บาท)"
          hint="0 = ไม่จำกัดวงเงิน · ระบบจะเตือนตอนขายเชื่อเกินวงเงิน"
        >
          <input
            name="creditLimit"
            inputMode="decimal"
            defaultValue={satangToInput(defaults?.creditLimit ?? 0)}
            className="input text-right"
          />
        </Field>

        <Field label="หมายเหตุ" hint="ไม่บังคับ">
          <input
            name="note"
            defaultValue={defaults?.note ?? ""}
            className="input"
            placeholder="เช่น ส่งของทุกเช้าจันทร์/พฤหัส"
          />
        </Field>
      </div>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={defaults ? `/customers/${defaults.id}` : "/customers"}
          className="btn-ghost"
        >
          ยกเลิก
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

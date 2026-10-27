"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import type { FormState } from "./actions";

export function UserForm({
  action,
  submitLabel = "บันทึกผู้ใช้",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="card space-y-3 p-4">
        <Field label="ชื่อผู้ใช้ (สำหรับ login)" hint="≥ 3 ตัว, ห้ามซ้ำ">
          <input name="username" required className="input font-mono" />
        </Field>
        <Field label="ชื่อที่แสดง">
          <input name="displayName" required className="input" />
        </Field>
        <Field label="รหัสผ่าน" hint="≥ 6 ตัว">
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="input"
          />
        </Field>
        <Field label="สิทธิ์">
          <select name="role" defaultValue="STAFF" className="input">
            <option value="STAFF">พนักงาน (STAFF)</option>
            <option value="OWNER">เจ้าของ (OWNER)</option>
          </select>
        </Field>
      </div>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/users" className="btn-ghost">
          ยกเลิก
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

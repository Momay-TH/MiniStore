"use client";

import { useActionState } from "react";
import { FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { createCategory, type FormState } from "../actions";

export function CategoryAddForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createCategory,
    {},
  );

  return (
    <form action={formAction} className="card space-y-3 p-4">
      <p className="text-xs font-semibold text-slate-500">เพิ่มหมวดหมู่</p>
      <div className="flex gap-2">
        <input
          name="name"
          required
          placeholder="ชื่อหมวดหมู่"
          className="input"
        />
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="input w-20 text-center"
          aria-label="ลำดับ"
        />
      </div>
      <FormError error={state.error} />
      <FormOk message={state.message} />
      <SubmitButton className="btn-primary w-full">เพิ่มหมวดหมู่</SubmitButton>
    </form>
  );
}

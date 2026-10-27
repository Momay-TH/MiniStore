"use client";

import { useActionState, useState } from "react";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { resetPassword, type FormState } from "./actions";

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    resetPassword,
    {},
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-sm border border-slate-200"
      >
        รีเซ็ตรหัสผ่าน
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <input
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="รหัสใหม่"
        className="h-9 w-32 rounded-xl border border-slate-200 px-2 text-xs"
      />
      <SubmitButton className="btn-sm bg-brand-600 text-white">
        บันทึก
      </SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn-sm border border-slate-200"
      >
        ยกเลิก
      </button>
      <FormError error={state.error} />
      <FormOk message={state.message} />
    </form>
  );
}

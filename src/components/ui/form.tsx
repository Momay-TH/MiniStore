"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "กำลังบันทึก…",
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {error}
    </p>
  );
}

export function FormOk({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
      {message}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, FormError, FormOk, SubmitButton } from "@/components/ui/form";
import { formatTHB, satangToInput } from "@/lib/money";
import { recordPayment, type FormState } from "../actions";

export function PaymentForm({
  customerId,
  due,
}: {
  customerId: string;
  due: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    recordPayment,
    {},
  );
  const [amount, setAmount] = useState(satangToInput(due));
  const [method, setMethod] = useState<"CASH" | "TRANSFER">("CASH");

  // หลังบันทึกสำเร็จ หน้าจะ revalidate และยอดค้างใหม่จะส่งมาเป็น prop
  useEffect(() => {
    setAmount(satangToInput(due));
  }, [due]);

  return (
    <form action={formAction} className="card space-y-3 p-4">
      <input type="hidden" name="customerId" value={customerId} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">รับชำระหนี้</p>
        <span className="text-xs text-slate-400">
          ค้าง ฿{formatTHB(due)}
        </span>
      </div>

      <Field label="จำนวนที่รับ (บาท)">
        <div className="flex gap-2">
          <input
            name="amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input text-right text-lg font-semibold"
          />
          <button
            type="button"
            onClick={() => setAmount(satangToInput(due))}
            className="btn-sm shrink-0 border border-slate-200 px-3"
          >
            เต็มจำนวน
          </button>
        </div>
      </Field>

      <Field label="รับเงินโดย">
        <div className="flex rounded-xl border border-slate-200 p-0.5">
          {(
            [
              ["CASH", "เงินสด"],
              ["TRANSFER", "โอน"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              className={`h-10 flex-1 rounded-lg text-sm font-medium ${
                method === value ? "bg-brand-600 text-white" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <input type="hidden" name="method" value={method} />

      <Field label="หมายเหตุ" hint="ไม่บังคับ">
        <input name="note" className="input" placeholder="เช่น จ่ายมาบางส่วน" />
      </Field>

      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        ระบบตัดหนี้ให้บิลเก่าสุดก่อน (FIFO) อัตโนมัติ
      </p>

      <FormError error={state.error} />
      <FormOk message={state.message} />

      <SubmitButton pendingText="กำลังบันทึก…">บันทึกรับชำระ</SubmitButton>
    </form>
  );
}

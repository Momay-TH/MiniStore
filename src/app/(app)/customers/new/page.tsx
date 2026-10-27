import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "เพิ่มลูกค้า" };

export default async function NewCustomerPage() {
  await requireUser();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-sm text-slate-500">
          ← กลับรายการลูกค้า
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">เพิ่มลูกค้า</h1>
        <p className="text-xs text-slate-500">
          สำหรับขายเชื่อ/ค้างชำระ · วงเงิน 0 = ไม่จำกัด
        </p>
      </div>

      <CustomerForm action={createCustomer} />
    </div>
  );
}

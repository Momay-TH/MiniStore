import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl shadow-lg shadow-brand-600/20">
            🥤
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ระบบร้านค้า</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการสต็อก · ขายสินค้า · ลูกค้าค้างชำระ
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ใช้บัญชีที่ผู้ดูแลร้านสร้างให้
        </p>
      </div>
    </main>
  );
}

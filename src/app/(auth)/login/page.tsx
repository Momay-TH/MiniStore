import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/pos";
  return next;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = safeNext(searchParams.next);

  // ตรวจ session จริง (ไม่เดาจาก cookie) — ถ้ายังล็อกอินอยู่ให้ไปต่อทันที
  const user = await getSessionUser();
  if (user) redirect(next);

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
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ใช้บัญชีที่ผู้ดูแลร้านสร้างให้
        </p>
      </div>
    </main>
  );
}

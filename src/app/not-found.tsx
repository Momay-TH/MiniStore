import Link from "next/link";

export const metadata = { title: "ไม่พบหน้านี้" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 py-12 text-center">
      <p className="text-5xl">🧾</p>
      <h1 className="mt-4 text-xl font-bold text-slate-900">ไม่พบหน้านี้</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">
        ลิงก์อาจถูกเปลี่ยนหรือข้อมูลที่ต้องการถูกลบไปแล้ว
      </p>
      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          กลับหน้าภาพรวม
        </Link>
        <Link
          href="/pos"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          ไปหน้าขาย
        </Link>
      </div>
    </main>
  );
}

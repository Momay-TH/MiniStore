import Link from "next/link";

/**
 * แถบเปลี่ยนหน้าแบบลิงก์ธรรมดา (ไม่ต้องใช้ JS)
 * ใช้ใน server component ได้ เพราะ hrefFor ถูกเรียกตอน render
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const base =
    "rounded-xl px-3.5 py-2 text-sm font-medium transition active:scale-[0.98]";
  const enabled = "bg-white text-slate-700 ring-1 ring-slate-200";
  const disabled = "bg-slate-100 text-slate-500";

  return (
    <nav
      aria-label="เปลี่ยนหน้า"
      className="flex items-center justify-between gap-3 pt-1"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${base} ${enabled}`}>
          ← ก่อนหน้า
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>← ก่อนหน้า</span>
      )}

      <span className="text-xs text-slate-500">
        หน้า {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={`${base} ${enabled}`}>
          ถัดไป →
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>ถัดไป →</span>
      )}
    </nav>
  );
}

/** แปลงค่า ?page= ให้เป็นเลขหน้าที่ถูกต้อง */
export function parsePage(value: unknown, totalPages: number): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n)) return 1;
  const page = Math.trunc(n);
  if (page < 1) return 1;
  if (page > totalPages) return Math.max(1, totalPages);
  return page;
}

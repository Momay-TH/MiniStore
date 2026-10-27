import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { toggleUserActive, changeUserRole } from "./actions";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "จัดการผู้ใช้" };

export default async function UsersPage(props: PageProps<"/users">) {
  await requireOwner();
  const searchParams = await props.searchParams;
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-slate-500">
        ← กลับหน้าภาพรวม
      </Link>

      {searchParams.created === "1" ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          เพิ่มผู้ใช้แล้ว
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">จัดการผู้ใช้</h1>
          <p className="text-xs text-slate-500">{rows.length} บัญชี</p>
        </div>
        <Link href="/users/new" className="btn-primary h-9 px-3 text-xs">
          + เพิ่มผู้ใช้
        </Link>
      </div>

      <ul className="space-y-2">
        {rows.map((u) => (
          <li key={u.id} className="card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {u.displayName}
                  {u.isActive !== 1 ? (
                    <span className="ml-2 badge bg-slate-200 text-slate-600">
                      ปิดใช้งาน
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {u.username} ·{" "}
                  {u.role === "OWNER" ? "เจ้าของ" : "พนักงาน"}
                </p>
              </div>

              <form action={toggleUserActive}>
                <input type="hidden" name="id" value={u.id} />
                <input
                  type="hidden"
                  name="next"
                  value={u.isActive === 1 ? "0" : "1"}
                />
                <button
                  type="submit"
                  className={`btn-sm shrink-0 ${
                    u.isActive === 1
                      ? "border border-red-200 text-red-600"
                      : "bg-brand-600 text-white"
                  }`}
                >
                  {u.isActive === 1 ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form action={changeUserRole} className="flex items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="OWNER">เจ้าของ</option>
                  <option value="STAFF">พนักงาน</option>
                </select>
                <button
                  type="submit"
                  className="btn-sm border border-slate-200"
                >
                  เปลี่ยน role
                </button>
              </form>

              <ResetPasswordForm userId={u.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

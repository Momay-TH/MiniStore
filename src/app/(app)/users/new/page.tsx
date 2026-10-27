import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export const metadata = { title: "เพิ่มผู้ใช้" };

export default async function NewUserPage() {
  await requireOwner();
  return (
    <div className="space-y-4">
      <div>
        <Link href="/users" className="text-sm text-slate-500">
          ← กลับรายการผู้ใช้
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-900">เพิ่มผู้ใช้</h1>
      </div>
      <UserForm action={createUser} />
    </div>
  );
}

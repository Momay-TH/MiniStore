import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { logoutAction } from "../(auth)/login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur pt-safe">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 active:opacity-70">
            <span className="text-lg">🥤</span>
            <span className="text-sm font-semibold text-slate-800">ร้านค้า</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="max-w-[8rem] truncate text-xs text-slate-500">
              {user.displayName || user.username}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition active:bg-slate-100"
              >
                ออก
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

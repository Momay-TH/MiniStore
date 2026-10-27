import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

/**
 * หมายเหตุ: Next.js 16 เปลี่ยนชื่อ middleware → proxy
 * ที่นี่ตรวจแค่ "มี cookie ไหม" แบบเร็ว (optimistic)
 * การตรวจ session จริงทำใน server component / server action ทุกครั้ง
 *
 * ไม่ redirect `/login` → `/pos` ที่นี่ เพราะ cookie อาจหมดอายุ/ถูกตัดจาก DB
 * (ถ้าเดาเอาว่ามี cookie = ล็อกอินแล้ว จะเกิด redirect loop กับ requireUser)
 * หน้า /login ตรวจ session จริงเองและพากลับไปหน้าที่ควรไป
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("sid");

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)"],
};

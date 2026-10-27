import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ร้านค้า · ระบบสต็อกและขาย",
  description: "ระบบจัดการสต็อก ขายสินค้า และลูกค้าค้างชำระ",
  applicationName: "ร้านค้า",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ร้านค้า",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#14825a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

/**
 * เปิดใช้ Cloudflare bindings ใน `next dev` เฉพาะเมื่อตั้ง CF_DEV_BINDINGS=1
 *
 * ค่าเริ่มต้น = ปิด เพราะ workerd (ตัวจำลอง D1 ของ wrangler) crash บนเครื่องนี้
 * เมื่อปิดอยู่ ระบบจะใช้ SQLite ในเครื่องผ่าน src/db/local-d1.ts แทน
 */
if (process.env.CF_DEV_BINDINGS === "1") {
  initOpenNextCloudflareForDev();
}

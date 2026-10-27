import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
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

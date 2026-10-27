# ระบบจัดการสต็อก + ขาย + ลูกค้าค้างชำระ

Web app สำหรับร้านขายเครื่องดื่ม (น้ำอัดลม สุรา โซดา น้ำดื่ม แก๊สหุงต้ม)
ใช้งานบนมือถือ/แท็บเล็ตเป็นหลัก

## สถานะตอนนี้

| เฟส | รายการ | สถานะ |
| --- | --- | --- |
| 1 | โครงโปรเจกต์ + ฐานข้อมูล + seed | ✅ |
| 2 | Login + layout มือถือ + PWA | ✅ |
| 3 | สินค้า/หมวดหมู่ (เพิ่ม/แก้) | ✅ ครบ (รวม price_logs + ค้นหา + ปิดใช้งาน + **SKU อัตโนมัติ P00001**) |
| 4 | รับเข้า/ปรับสต็อก/ประวัติ | ✅ ครบ (batch + ค้นหา/กรอง + สแกนบาร์โค้ดตอนรับเข้า) |
| 5 | **POS ขาย + บิลบนจอ** | ✅ (รวม **สแกนบาร์โค้ดด้วยกล้อง** ด้วย `html5-qrcode`) |
| 6 | ลูกค้า/ค้างชำระ/รับชำระหนี้ | ✅ ครบ (FIFO + aging 0-7/8-30/31-60/60+) |
| 7 | Dashboard + รายงาน | ✅ (Dashboard + `/reports`: ยอดขายรายวัน, สินค้าขายดี, สต็อก, หนี้ aging) |
| 8 | สิทธิ์/export/deploy | ✅ สิทธิ์ (OWNER/STAFF) + export CSV + จัดการผู้ใช้ · deploy ยังไม่ทำตามคำขอ |

## Stack

- **Next.js 16** (App Router, Node runtime) + TypeScript
- **Tailwind CSS v4**
- **Drizzle ORM** + **Cloudflare D1** (production)
- **Cloudflare Workers** ผ่าน `@opennextjs/cloudflare`
- Auth: session cookie + PBKDF2 (WebCrypto)
- Barcode scan: `html5-qrcode` — ใช้ร่วมกันผ่าน `src/components/barcode-scanner.tsx`
  - POS: สแกน → เพิ่มลงตะกร้า
  - สินค้า: สแกน → กรองรายการที่ตรงบาร์โค้ด
  - รับเข้า: สแกน/พิมพ์บาร์โค้ด → เลือกสินค้า + แสดงข้อมูล/สถานะสต็อก แล้วกรอกจำนวน

## เริ่มใช้งาน (dev)

```powershell
npm.cmd install
npm.cmd run db:local      # สร้าง .data/app.db + apply migration (ไม่แตะข้อมูลเดิม)
npm.cmd run db:local:seed # ใส่ข้อมูลตัวอย่าง (เฉพาะ DB ว่าง)
npm.cmd run dev           # http://localhost:3000
```

บัญชีเริ่มต้น: **admin / admin1234** (OWNER)

> เปลี่ยนรหัสผ่านก่อนใช้งานจริง:
> `node scripts/hash-password.mjs "รหัสใหม่"` แล้วเอา hash ไปอัปเดตตาราง `users`
> หรือใช้หน้า **ผู้ใช้ → ตั้งรหัสผ่านใหม่** ในระบบ

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | รัน dev server (ใช้ SQLite ในเครื่อง) |
| `npm run build` | build Next.js ธรรมดา |
| `npm run db:generate` | สร้าง migration จาก `src/db/schema.ts` |
| `npm run db:local` | apply migration ที่ยังไม่ถูกใช้กับ `.data/app.db` |
| `npm run db:local:seed` | apply migration + seed (เฉพาะ DB ว่าง) |
| `npm run db:local:reset` | ลบ DB ในเครื่องแล้วสร้างใหม่ + seed |
| `npm run preview` | build แล้วรันใน Workers runtime (ต้องมี workerd ที่ใช้ได้) |
| `npm run deploy` | build + deploy ขึ้น Cloudflare |
| `npm run db:migrate:remote` | apply migration กับ D1 บน Cloudflare |
| `npm run db:seed:remote` | seed ข้อมูลลง D1 บน Cloudflare |
| `npm run hash-password "รหัส"` | สร้าง password hash |

## หมายเหตุสำคัญ: workerd ใช้ไม่ได้บนเครื่องนี้

`wrangler` ใช้ `workerd` จำลอง D1 ในเครื่อง แต่บนเครื่องนี้ workerd crash
(`access violation / stack overflow`) จึงทำ fallback ไว้:

- **development** → ใช้ `node:sqlite` ผ่าน `src/db/local-d1.ts` (API เดียวกับ D1)
  ไฟล์ข้อมูลอยู่ที่ `.data/app.db`
- **production บน Cloudflare** → ใช้ D1 binding จริงตามปกติ (ไม่มีโค้ด fallback ทำงาน)

ถ้าวันหนึ่ง workerd ใช้งานได้ ให้รัน dev แบบผูก D1 จริงในเครื่อง:

```powershell
$env:CF_DEV_BINDINGS="1"; npm.cmd run dev
```

## หลักการที่บังคับไว้ในโค้ด

- เงินเก็บเป็น **สตางค์ (INTEGER)** ทั้งระบบ — ไม่มีทศนิยมลอยตัว
- เวลาเก็บ UTC (unix ms) แสดงผลเป็น `Asia/Bangkok`
- ขาย = เขียน `sales` + `sale_items` + ลด `products.stock_qty` + เขียน `stock_moves`
  ใน `db.batch()` ชุดเดียว (สำเร็จหมดหรือไม่บันทึกเลย)
- ห้ามขายเกินสต็อก (ปิดได้ด้วย setting `allow_negative_stock = 1`)
- `sale_items` เก็บทั้ง `list_price` (ราคาปกติ) และ `unit_price` (ราคาที่ขายจริง)
  เพื่อตรวจการแก้ราคา
- ขายเงินสด/โอนต้องรับเงินครบก่อนบันทึก — เก็บ `cash_received` + `change_amount`
  ไว้ตรวจย้อนหลังได้ (ขายเชื่อที่มีเงินดาวน์จะลง `payments` ให้อัตโนมัติ)

## ความปลอดภัย

- Login จำกัด **5 ครั้งผิด / 15 นาที** ต่อ (ชื่อผู้ใช้ + IP) แล้วล็อก 15 นาที
  เก็บในตาราง `login_attempts` (migration `0001`)
- Session เก็บใน DB — เปลี่ยน/รีเซ็ตรหัสผ่านจะตัด session เดิมทิ้ง
- Security headers: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` (ตั้งใน `next.config.ts` + `public/_headers`)
- CSV export กัน formula injection (`=`, `+`, `-`, `@`, tab, CR)
- ประวัติการขาย/สต็อกแบ่งหน้า (30/50 รายการต่อหน้า) เพื่อไม่ให้หน้าโหลดหนักขึ้นเรื่อย ๆ
- ยังไม่มี CSRF token แยก — อาศัย same-origin cookie (`SameSite=Lax`) + server action
  ของ Next.js; ถ้าจะเปิด API ให้คนอื่นเรียกต้องเพิ่มการป้องกันเพิ่ม

## โครงสร้าง

```
src/
  app/
    (auth)/login/         หน้า login + server action
    (app)/                layout + bottom nav (ต้อง login)
      page.tsx            dashboard
      pos/                หน้าขาย + server action createSale
      sales/              ประวัติ + บิล
      products/           รายการสินค้า + แก้ไข + หมวดหมู่
      stock/              ภาพรวมสต็อก + รับเข้า/ปรับ/ประวัติ
      customers/          ลูกค้า + หนี้ + รับชำระ
      reports/            รายงาน (ยอดขาย/สต็อก/หนี้)
      users/              จัดการผู้ใช้ (OWNER only)
    api/export/           CSV export (sales/stock/customers)
    layout.tsx  globals.css
  components/             bottom nav, ui (form primitives)
  db/
    schema.ts             ตารางทั้งหมด (Drizzle)
    index.ts              getDb() — เลือก D1 หรือ SQLite local
    local-d1.ts           D1 emulation สำหรับ dev
  lib/
    auth.ts  money.ts  datetime.ts  ids.ts  aging.ts
  proxy.ts                guard auth (Next 16 เปลี่ยน middleware → proxy)
migrations/               SQL จาก drizzle-kit
scripts/                  seed / db-local / hash-password
seed.sql                  ข้อมูลตัวอย่าง
wrangler.jsonc            config Worker + D1 binding
```

## Deploy ขึ้น Cloudflare

```powershell
npx wrangler login
npx wrangler d1 create stock-db          # เอา database_id ไปใส่ wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote                   # ถ้าต้องการข้อมูลตัวอย่าง
npm run deploy
```

> ก่อน deploy จริง: เปลี่ยน `database_id` ใน `wrangler.jsonc` จากค่า placeholder
> และเปลี่ยนรหัสผ่าน OWNER

หลัง deploy ครั้งแรก ให้ตรวจ:

1. `npx wrangler d1 migrations list stock-db --remote` → ต้องเห็น `0000` และ `0001`
2. เปิด `/login` แล้วลองรหัสผิด 6 ครั้ง → ต้องขึ้นข้อความล็อก
3. ตรวจ response header ว่ามี `content-security-policy` และไม่มี `x-powered-by`
4. เพิ่มแอปลงหน้าจอมือถือ (PWA) → ไอคอนต้องเป็น PNG ไม่ใช่ช่องว่าง

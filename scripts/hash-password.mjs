/**
 * สร้าง password hash สำหรับ seed / สร้างผู้ใช้ใหม่
 * ใช้งาน: node scripts/hash-password.mjs "รหัสผ่าน"
 * รูปแบบผลลัพธ์: pbkdf2$sha256$100000$<saltB64>$<hashB64>
 */
const ITERATIONS = 100_000;

const password = process.argv[2];
if (!password) {
  console.error("ใช้งาน: node scripts/hash-password.mjs \"รหัสผ่าน\"");
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
  key,
  256,
);

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
console.log(
  `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`,
);

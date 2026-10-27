/**
 * เตรียมฐานข้อมูลสำหรับ dev (SQLite ในเครื่อง)
 *
 *   node scripts/db-local.mjs            → apply migrations ที่ยังไม่ถูกใช้
 *   node scripts/db-local.mjs --seed     → apply migrations + seed (เฉพาะ DB ว่าง)
 *   node scripts/db-local.mjs --reset    → ลบไฟล์ DB แล้วเริ่มใหม่ + seed
 *
 * ใช้แทน `wrangler d1 ... --local` เพราะ workerd crash บนเครื่องนี้
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = ".data";
const DB_FILE = join(DATA_DIR, "app.db");
const MIGRATIONS_DIR = "migrations";

const args = new Set(process.argv.slice(2));
const withSeed = args.has("--seed") || args.has("--reset");

if (args.has("--reset")) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${DB_FILE}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }
  console.log("ลบฐานข้อมูลเดิมแล้ว");
}

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(
  "CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
);

const applied = new Set(
  db.prepare("SELECT name FROM _local_migrations").all().map((r) => r.name),
);

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  db.exec(sql);
  db.prepare(
    "INSERT INTO _local_migrations (name, applied_at) VALUES (?, ?)",
  ).run(file, Date.now());
  console.log(`✓ ${file}`);
  count++;
}

console.log(
  count === 0 ? "ฐานข้อมูลเป็นปัจจุบันแล้ว" : `apply migration ${count} ไฟล์`,
);

if (withSeed) {
  const userCount = db.prepare("SELECT count(*) AS n FROM users").get().n;
  if (userCount > 0 && !args.has("--force-seed")) {
    console.log(
      "ข้ามการ seed เพราะฐานข้อมูลมีข้อมูลอยู่แล้ว (ใช้ --force-seed หรือ --reset ถ้าต้องการเริ่มใหม่)",
    );
  } else {
    const seed = readFileSync("seed.sql", "utf8");
    db.exec(seed);
    console.log("✓ seed ข้อมูลตัวอย่าง");
  }
}

db.close();
console.log(`ฐานข้อมูล: ${DB_FILE}`);

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * กติกาทั้งฐานข้อมูล
 * - เงินทุกช่องเก็บเป็น "สตางค์" (INTEGER) ห้ามใช้ทศนิยม
 * - เวลาทุกช่องเก็บเป็น unix milliseconds (UTC) แล้วค่อยแปลงเป็น Asia/Bangkok ตอนแสดง
 * - สถานะ boolean ใช้ 0/1
 */

const createdAt = integer("created_at")
  .notNull()
  .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: text("role", { enum: ["OWNER", "STAFF"] })
      .notNull()
      .default("STAFF"),
    isActive: integer("is_active").notNull().default(1),
    createdAt,
  },
  (t) => [uniqueIndex("users_username_uq").on(t.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt,
  },
  (t) => [uniqueIndex("categories_name_uq").on(t.name)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /** หน่วยฐาน เช่น ขวด / ถัง */
    baseUnit: text("base_unit").notNull().default("ชิ้น"),
    /** หน่วยยก เช่น ลัง */
    packUnit: text("pack_unit").notNull().default("ลัง"),
    /** 1 ลัง = กี่หน่วยฐาน */
    packSize: integer("pack_size").notNull().default(1),

    costPerBase: integer("cost_per_base").notNull().default(0),
    pricePerBase: integer("price_per_base").notNull().default(0),
    pricePerPack: integer("price_per_pack").notNull().default(0),

    reorderPoint: integer("reorder_point").notNull().default(0),
    /** ยอดคงเหลือหน่วยฐาน (cache ของ stock_moves) */
    stockQty: integer("stock_qty").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt,
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("products_sku_uq").on(t.sku),
    index("products_barcode_idx").on(t.barcode),
    index("products_category_idx").on(t.categoryId),
    index("products_name_idx").on(t.name),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    /** วงเงินเชื่อ (สตางค์) — 0 = ไม่จำกัด */
    creditLimit: integer("credit_limit").notNull().default(0),
    note: text("note"),
    isActive: integer("is_active").notNull().default(1),
    createdAt,
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    method: text("method", { enum: ["CASH", "TRANSFER", "CREDIT"] })
      .notNull()
      .default("CASH"),
    status: text("status", { enum: ["PAID", "PARTIAL", "UNPAID"] })
      .notNull()
      .default("PAID"),
    note: text("note"),
    createdAt,
  },
  (t) => [
    uniqueIndex("sales_code_uq").on(t.code),
    index("sales_created_idx").on(t.createdAt),
    index("sales_customer_idx").on(t.customerId),
    index("sales_status_idx").on(t.status),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    saleUnit: text("sale_unit", { enum: ["UNIT", "PACK"] })
      .notNull()
      .default("UNIT"),
    qty: integer("qty").notNull(),
    qtyBase: integer("qty_base").notNull(),
    /** ราคาตามปกติ (สตางค์/หน่วยที่ขาย) */
    listPrice: integer("list_price").notNull().default(0),
    /** ราคาที่ขายจริง (สตางค์/หน่วยที่ขาย) */
    unitPrice: integer("unit_price").notNull().default(0),
    costPerBase: integer("cost_per_base").notNull().default(0),
    lineTotal: integer("line_total").notNull().default(0),
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleId: text("sale_id").references(() => sales.id, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
    method: text("method", { enum: ["CASH", "TRANSFER"] })
      .notNull()
      .default("CASH"),
    note: text("note"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [
    index("payments_customer_idx").on(t.customerId),
    index("payments_sale_idx").on(t.saleId),
  ],
);

export const stockMoves = sqliteTable(
  "stock_moves",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: text("type", {
      enum: ["PURCHASE", "SALE", "ADJUST", "DAMAGE", "RETURN", "INIT"],
    }).notNull(),
    /** หน่วยฐาน, ค่าลบ = ตัดออก */
    qtyBase: integer("qty_base").notNull(),
    unitCost: integer("unit_cost").notNull().default(0),
    refType: text("ref_type"),
    refId: text("ref_id"),
    note: text("note"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [
    index("stock_moves_product_idx").on(t.productId),
    index("stock_moves_created_idx").on(t.createdAt),
    index("stock_moves_ref_idx").on(t.refType, t.refId),
  ],
);

export const priceLogs = sqliteTable(
  "price_logs",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    oldValue: integer("old_value").notNull(),
    newValue: integer("new_value").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [index("price_logs_product_idx").on(t.productId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;

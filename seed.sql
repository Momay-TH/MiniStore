-- Seed ข้อมูลตัวอย่าง (รันซ้ำได้)
-- รัน: npx wrangler d1 execute stock-db --local --file=./seed.sql

-- ผู้ใช้เริ่มต้น: admin / admin1234  (OWNER)
INSERT OR REPLACE INTO users (id, username, password_hash, display_name, role, is_active, created_at)
VALUES (
  'usr_owner',
  'admin',
  'pbkdf2$sha256$100000$MHjBuG4fZVd3QhFwnUrZkw==$k8qZ48K+ZcxIQSJ1MJORTlom6dCme4HewM8EIxEM1OY=',
  'เจ้าของร้าน',
  'OWNER',
  1,
  (unixepoch() * 1000)
);

INSERT OR REPLACE INTO settings (key, value) VALUES ('allow_negative_stock', '0');
INSERT OR REPLACE INTO settings (key, value) VALUES ('shop_name', 'ร้านค้า');

-- หมวดหมู่
INSERT OR REPLACE INTO categories (id, name, sort_order, is_active, created_at) VALUES
  ('cat_softdrink', 'น้ำอัดลม',   1, 1, (unixepoch() * 1000)),
  ('cat_liquor',    'สุรา',       2, 1, (unixepoch() * 1000)),
  ('cat_soda',      'โซดา',       3, 1, (unixepoch() * 1000)),
  ('cat_water',     'น้ำดื่ม',    4, 1, (unixepoch() * 1000)),
  ('cat_gas',       'แก๊สหุงต้ม', 5, 1, (unixepoch() * 1000));

-- สินค้า (เงินเป็นสตางค์: 1500 = 15.00 บาท)
INSERT OR REPLACE INTO products
  (id, sku, barcode, name, category_id, base_unit, pack_unit, pack_size,
   cost_per_base, price_per_base, price_per_pack, reorder_point, stock_qty, is_active, created_at, updated_at)
VALUES
  ('p_coke325',   'COKE325',   '8850999111111', 'โค้ก 325 มล.',        'cat_softdrink', 'ขวด', 'ลัง',  12, 1200, 1500, 16800, 24, 240, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_pepsi325',  'PEPSI325',  '8850999222222', 'เป๊ปซี่ 325 มล.',     'cat_softdrink', 'ขวด', 'ลัง',  12, 1200, 1500, 16800, 24, 180, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_sprite325', 'SPRITE325', '8850999333333', 'สไปรท์ 325 มล.',     'cat_softdrink', 'ขวด', 'ลัง',  12, 1200, 1500, 16800, 24,  96, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_coke15',    'COKE15',    '8850999444444', 'โค้ก 1.5 ลิตร',       'cat_softdrink', 'ขวด', 'ลัง',  12, 2800, 3500, 42000, 12,  60, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_sangsom',   'SS350',     '8851000111111', 'แสงโสม 350 มล.',      'cat_liquor',    'ขวด', 'ลัง',  12,11000,13500,156000, 12,  36, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_hongthong', 'HT350',     '8851000222222', 'หงส์ทอง 350 มล.',     'cat_liquor',    'ขวด', 'ลัง',  12, 8000, 9800,114000, 12,  24, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_chang620',  'CHANG620',  '8851000333333', 'เบียร์ช้าง 620 มล.',  'cat_liquor',    'ขวด', 'ลัง',  24, 5200, 6500,150000, 24,  48, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_sodasingh', 'SODA325',   '8851000444444', 'โซดาสิงห์ 325 มล.',   'cat_soda',      'ขวด', 'ลัง',  12, 1000, 1200, 13500, 24, 120, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_sodaleo',   'SOLEO325',  '8851000555555', 'โซดาเลโอ 325 มล.',    'cat_soda',      'ขวด', 'ลัง',  12, 1000, 1200, 13500, 24,  60, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_water600',  'WATER600',  '8851000666666', 'น้ำดื่ม 600 มล.',     'cat_water',     'ขวด', 'แพ็ค', 12,  500,  700,  7200, 36, 240, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_water15',   'WATER15',   '8851000777777', 'น้ำดื่ม 1.5 ลิตร',    'cat_water',     'ขวด', 'แพ็ค', 12, 1200, 1500, 16800, 24,  96, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_gas15',     'GAS15',     NULL,            'แก๊สหุงต้ม 15 กก.',   'cat_gas',       'ถัง', 'ถัง',   1,38000,42000, 42000,  5,  30, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
  ('p_gas4',      'GAS4',      NULL,            'แก๊สหุงต้ม 4 กก.',    'cat_gas',       'ถัง', 'ถัง',   1,16000,18000, 18000,  5,  18, 1, (unixepoch() * 1000), (unixepoch() * 1000));

-- ลูกค้า
INSERT OR REPLACE INTO customers (id, name, phone, address, credit_limit, note, is_active, created_at) VALUES
  ('cus_1', 'ร้านลุงหนวด',    '081-234-5678', 'ตลาดสด zone A', 2000000, NULL, 1, (unixepoch() * 1000)),
  ('cus_2', 'ร้านป้าแดง',     '089-111-2222', 'ซอย 4',         1000000, NULL, 1, (unixepoch() * 1000)),
  ('cus_3', 'ร้านน้องมิ้นท์', '086-555-7777', 'หมู่ 5',        3000000, 'ส่งทุกเช้า', 1, (unixepoch() * 1000));

-- สต็อกเริ่มต้น (ledger)
INSERT OR REPLACE INTO stock_moves (id, product_id, type, qty_base, unit_cost, ref_type, ref_id, note, user_id, created_at) VALUES
  ('mv_init_coke325',   'p_coke325',   'INIT', 240, 1200, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_pepsi325',  'p_pepsi325',  'INIT', 180, 1200, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_sprite325', 'p_sprite325', 'INIT',  96, 1200, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_coke15',    'p_coke15',    'INIT',  60, 2800, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_sangsom',   'p_sangsom',   'INIT',  36,11000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_hongthong', 'p_hongthong', 'INIT',  24, 8000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_chang620',  'p_chang620',  'INIT',  48, 5200, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_sodasingh', 'p_sodasingh', 'INIT', 120, 1000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_sodaleo',   'p_sodaleo',   'INIT',  60, 1000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_water600',  'p_water600',  'INIT', 240,  500, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_water15',   'p_water15',   'INIT',  96, 1200, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_gas15',     'p_gas15',     'INIT',  30,38000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000)),
  ('mv_init_gas4',      'p_gas4',      'INIT',  18,16000, 'INIT', NULL, 'ยกมา', 'usr_owner', (unixepoch() * 1000));

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BarcodeScanner, ScanButton } from "@/components/barcode-scanner";
import { createSale, type CreateSaleResult } from "./actions";
import { formatTHB } from "@/lib/money";

export type PosProduct = {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseUnit: string;
  packUnit: string;
  packSize: number;
  pricePerBase: number;
  pricePerPack: number;
  stockQty: number;
  reorderPoint: number;
};

export type PosCategory = { id: string; name: string };
export type PosCustomer = {
  id: string;
  name: string;
  creditLimit: number;
  due: number;
};

type SaleUnit = "UNIT" | "PACK";

type Line = {
  key: string;
  product: PosProduct;
  saleUnit: SaleUnit;
  qty: number;
  unitPrice: number;
};

type Method = "CASH" | "TRANSFER" | "CREDIT";

function keyOf(productId: string, unit: SaleUnit) {
  return `${productId}:${unit}`;
}

export function PosClient({
  products,
  categories,
  customers,
}: {
  products: PosProduct[];
  categories: PosCategory[];
  customers: PosCustomer[];
}) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [unit, setUnit] = useState<SaleUnit>("UNIT");
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<
    Extract<CreateSaleResult, { ok: true }> | null
  >(null);
  const [pending, startTransition] = useTransition();

  // checkout state
  const [method, setMethod] = useState<Method>("CASH");
  const [customerId, setCustomerId] = useState<string>("");
  const [cashInput, setCashInput] = useState<string>("");
  const [creditPaidInput, setCreditPaidInput] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  // สแกนบาร์โค้ดด้วยกล้องมือถือ
  const [scannerOpen, setScannerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, activeCat]);

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const discount = Math.min(
    toSatang(discountInput),
    subtotal,
  );
  const total = subtotal - discount;
  const itemCount = cart.reduce((sum, l) => sum + l.qty, 0);

  const cashPaid = toSatang(cashInput);
  const change = Math.max(0, cashPaid - total);
  const cashShort = method === "CASH" ? Math.max(0, total - cashPaid) : 0;
  const creditPaid = Math.min(toSatang(creditPaidInput), total);
  const creditDue = Math.max(0, total - creditPaid);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const projectedDue = selectedCustomer
    ? selectedCustomer.due + creditDue
    : creditDue;
  const overLimit =
    selectedCustomer !== null &&
    selectedCustomer.creditLimit > 0 &&
    projectedDue > selectedCustomer.creditLimit;

  function addToCart(product: PosProduct, saleUnit: SaleUnit) {
    const key = keyOf(product.id, saleUnit);
    setReceipt(null);
    setError(null);
    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) {
        return prev.map((l) =>
          l.key === key ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          product,
          saleUnit,
          qty: 1,
          unitPrice:
            saleUnit === "PACK"
              ? product.pricePerPack
              : product.pricePerBase,
        },
      ];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key ? { ...l, qty: Math.max(0, l.qty + delta) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function switchUnit(key: string) {
    setCart((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const nextUnit: SaleUnit = line.saleUnit === "UNIT" ? "PACK" : "UNIT";
      const nextKey = keyOf(line.product.id, nextUnit);
      const qtyBase = line.qty * (line.saleUnit === "PACK" ? line.product.packSize : 1);
      const nextQty = Math.max(
        1,
        nextUnit === "PACK"
          ? Math.floor(qtyBase / line.product.packSize) || 1
          : qtyBase,
      );
      const merged = prev.filter((l) => l.key !== key && l.key !== nextKey);
      const existing = prev.find((l) => l.key === nextKey);
      return [
        ...merged,
        {
          key: nextKey,
          product: line.product,
          saleUnit: nextUnit,
          qty: (existing?.qty ?? 0) + nextQty,
          unitPrice:
            nextUnit === "PACK"
              ? line.product.pricePerPack
              : line.product.pricePerBase,
        },
      ];
    });
  }

  function setLinePrice(key: string, baht: string) {
    const satang = toSatang(baht);
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, unitPrice: satang } : l)),
    );
  }

  function resetSale() {
    setCart([]);
    setDiscountInput("0");
    setCashInput("");
    setCreditPaidInput("");
    setCustomerId("");
    setNote("");
    setMethod("CASH");
    setError(null);
    setReceipt(null);
    setCartOpen(false);
    setCheckoutOpen(false);
  }

  function openCheckout() {
    setCashInput(String(Math.round(total / 100)));
    setError(null);
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  function confirmSale() {
    setError(null);
    startTransition(async () => {
      const result = await createSale({
        items: cart.map((l) => ({
          productId: l.product.id,
          saleUnit: l.saleUnit,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        discount,
        method,
        customerId: method === "CREDIT" ? customerId || null : null,
        paidAmount: method === "CREDIT" ? creditPaid : total,
        cashReceived: method === "CREDIT" ? 0 : method === "CASH" ? cashPaid : total,
        note: note.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCheckoutOpen(false);
      setReceipt(result);
    });
  }

  /* ------------------------------- camera scan ------------------------------ */

  function openScanner() {
    setError(null);
    setScannerOpen(true);
  }

  function handleScanned(code: string) {
    const product = products.find(
      (p) => (p.barcode ?? "").trim() === code.trim(),
    );
    setScannerOpen(false);
    if (product) {
      addToCart(product, unit);
      setError(null);
    } else {
      setError(`ไม่พบสินค้าจากบาร์โค้ด ${code}`);
    }
  }

  /* ------------------------------- product grid ------------------------------ */

  return (
    <div>
      <div className="sticky top-12 z-20 -mx-4 space-y-2 bg-slate-50/95 px-4 pt-2 pb-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const exact = products.find(
                  (p) => p.barcode && p.barcode === query.trim(),
                );
                if (exact) {
                  addToCart(exact, unit);
                  setQuery("");
                }
              }}
              inputMode="search"
              placeholder="ค้นหาสินค้า / ยิงบาร์โค้ด"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <ScanButton
            active={scannerOpen}
            onClick={scannerOpen ? () => setScannerOpen(false) : openScanner}
          />

          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            {(
              [
                ["UNIT", "เดี่ยว"],
                ["PACK", "ยกลัง"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setUnit(value)}
                className={`h-10 rounded-lg px-3 text-sm font-medium transition ${
                  unit === value
                    ? "bg-brand-600 text-white"
                    : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleScanned}
        />

        {error ? (
          <button
            type="button"
            onClick={() => setError(null)}
            className="block w-full rounded-xl bg-red-50 px-3 py-2 text-left text-xs font-medium text-red-700"
          >
            {error} (แตะเพื่อปิด)
          </button>
        ) : null}

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <Chip
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            label="ทั้งหมด"
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              label={c.name}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          ไม่พบสินค้า
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const price = unit === "PACK" ? p.pricePerPack : p.pricePerBase;
            const low = p.stockQty <= p.reorderPoint;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p, unit)}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition active:scale-[0.97] active:border-brand-400"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800">
                      {p.name}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.categoryName ?? "ไม่ระบุหมวด"} ·{" "}
                    {unit === "PACK"
                      ? `1 ${p.packUnit} = ${p.packSize} ${p.baseUnit}`
                      : p.baseUnit}
                  </p>
                </div>

                <div className="mt-2 flex items-end justify-between">
                  <span className="text-lg font-bold text-brand-700">
                    ฿{formatTHB(price)}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      low
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {p.stockQty} {p.baseUnit}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* cart bar */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 px-4 pb-2">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl bg-brand-700 px-4 py-3 text-white shadow-lg shadow-brand-900/20 transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs">
                {itemCount} ชิ้น
              </span>
              ดูตะกร้า
            </span>
            <span className="text-lg font-bold">฿{formatTHB(total)}</span>
          </button>
        </div>
      ) : null}

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="ตะกร้า">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            ยังไม่มีสินค้าในตะกร้า
          </p>
        ) : (
          <div className="space-y-2">
            {cart.map((l) => (
              <div
                key={l.key}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-semibold text-slate-800">
                    {l.product.name}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCart((prev) => prev.filter((x) => x.key !== l.key))
                    }
                    className="text-xs text-slate-500"
                  >
                    ลบ
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchUnit(l.key)}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                  >
                    {l.saleUnit === "PACK" ? l.product.packUnit : l.product.baseUnit} ⇄
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeQty(l.key, -1)}
                      className="h-9 w-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 active:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-9 text-center text-base font-semibold">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQty(l.key, 1)}
                      className="h-9 w-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 active:bg-slate-100"
                    >
                      +
                    </button>
                  </div>

                  <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                    ราคา
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={String(l.unitPrice / 100)}
                      onChange={(e) => setLinePrice(l.key, e.target.value)}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm text-slate-800"
                    />
                  </label>
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>
                    ตัดสต็อก{" "}
                    {l.qty *
                      (l.saleUnit === "PACK" ? l.product.packSize : 1)}{" "}
                    {l.product.baseUnit}
                  </span>
                  <span className="font-semibold text-slate-800">
                    ฿{formatTHB(l.unitPrice * l.qty)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            <label className="flex items-center justify-between text-sm text-slate-600">
              ส่วนลด (บาท)
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right"
              />
            </label>

            <div className="flex items-center justify-between text-base">
              <span className="text-slate-600">รวมทั้งสิ้น</span>
              <span className="text-xl font-bold text-slate-900">
                ฿{formatTHB(total)}
              </span>
            </div>

            <button
              type="button"
              onClick={openCheckout}
              className="h-13 w-full rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              ชำระเงิน
            </button>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="ชำระเงิน"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex justify-between text-sm text-slate-500">
              <span>รวม</span>
              <span>฿{formatTHB(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>ส่วนลด</span>
              <span>−฿{formatTHB(discount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-lg font-bold text-slate-900">
              <span>ต้องชำระ</span>
              <span>฿{formatTHB(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["CASH", "เงินสด"],
                ["TRANSFER", "โอน"],
                ["CREDIT", "ค้างชำระ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`h-12 rounded-xl border text-sm font-semibold transition ${
                  method === value
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {method === "CASH" ? (
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm text-slate-600">
                รับเงิน (บาท)
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="h-11 w-32 rounded-xl border border-slate-200 px-3 text-right text-base"
                />
              </label>
              <div className="flex gap-2">
                {[total, 10000, 20000, 50000, 100000].map((amount, i) => (
                  <button
                    key={`${amount}-${i}`}
                    type="button"
                    onClick={() => setCashInput(String(amount / 100))}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-medium text-slate-600"
                  >
                    {i === 0 ? "พอดี" : `฿${amount / 100}`}
                  </button>
                ))}
              </div>
              <div
                className={`flex justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                  cashShort > 0
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <span>{cashShort > 0 ? "รับเงินไม่พอ (ขาด)" : "เงินทอน"}</span>
                <span>฿{formatTHB(cashShort > 0 ? cashShort : change)}</span>
              </div>
            </div>
          ) : null}

          {method === "TRANSFER" ? (
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
              บันทึกว่าโอนเงินแล้วเต็มจำนวน (ยังไม่ผูกกับบัญชีธนาคาร)
            </p>
          ) : null}

          {method === "CREDIT" ? (
            <div className="space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">ลูกค้า</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base"
                >
                  <option value="">— เลือกลูกค้า —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.due > 0 ? ` · ค้าง ฿${formatTHB(c.due)}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCustomer ? (
                <p
                  className={`rounded-xl px-3 py-2 text-[11px] ${
                    overLimit
                      ? "bg-red-50 font-medium text-red-700"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {selectedCustomer.creditLimit > 0 ? (
                    <>
                      วงเงิน ฿{formatTHB(selectedCustomer.creditLimit)} · ใช้ไป
                      ฿{formatTHB(selectedCustomer.due)} · บิลนี้จะทำให้ค้างรวม
                      ฿{formatTHB(projectedDue)}
                      {overLimit
                        ? ` — เกินวงเงิน ฿${formatTHB(
                            projectedDue - selectedCustomer.creditLimit,
                          )}`
                        : ""}
                    </>
                  ) : (
                    <>
                      ไม่จำกัดวงเงิน · ค้างอยู่ ฿
                      {formatTHB(selectedCustomer.due)}
                    </>
                  )}
                </p>
              ) : null}

              <label className="flex items-center justify-between text-sm text-slate-600">
                จ่ายมาบางส่วน (บาท)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={creditPaidInput}
                  onChange={(e) => setCreditPaidInput(e.target.value)}
                  className="h-11 w-32 rounded-xl border border-slate-200 px-3 text-right text-base"
                />
              </label>

              <div className="flex justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                <span>ยอดค้าง</span>
                <span>฿{formatTHB(creditDue)}</span>
              </div>
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">หมายเหตุ</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ไม่บังคับ"
              className="h-11 rounded-xl border border-slate-200 px-3 text-base"
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={confirmSale}
            disabled={pending || cart.length === 0 || cashShort > 0}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {pending
              ? "กำลังบันทึก…"
              : cashShort > 0
                ? `รับเงินไม่พอ ขาด ฿${formatTHB(cashShort)}`
                : `ยืนยันรับชำระ ฿${formatTHB(total)}`}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={receipt !== null}
        onClose={resetSale}
        title="บันทึกการขายสำเร็จ"
      >
        {receipt ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✓
            </div>
            <div>
              <p className="text-sm text-slate-500">เลขที่บิล</p>
              <p className="text-lg font-bold text-slate-900">{receipt.code}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดรวม</span>
                <span className="font-semibold">
                  ฿{formatTHB(receipt.total)}
                </span>
              </div>
              {receipt.change > 0 ? (
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-500">เงินทอน</span>
                  <span className="font-semibold text-emerald-700">
                    ฿{formatTHB(receipt.change)}
                  </span>
                </div>
              ) : null}
              {receipt.creditDue > 0 ? (
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-500">ค้างชำระ</span>
                  <span className="font-semibold text-amber-700">
                    ฿{formatTHB(receipt.creditDue)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/sales/${receipt.saleId}`}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
              >
                ดูบิล
              </Link>
              <button
                type="button"
                onClick={resetSale}
                className="rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white"
              >
                ขายต่อ
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/* --------------------------------- helpers --------------------------------- */

function toSatang(input: string): number {
  const raw = (input ?? "").toString().replace(/,/g, "").trim();
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white pb-safe shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500"
          >
            ปิด
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

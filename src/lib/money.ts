/**
 * เงินทั้งระบบเก็บเป็น "สตางค์" (integer) เท่านั้น
 * 1 บาท = 100 สตางค์
 */

export function bahtToSatang(input: string | number): number {
  const raw = typeof input === "number" ? input.toString() : input.trim();
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(normalized)) {
    throw new Error(`จำนวนเงินไม่ถูกต้อง: ${input}`);
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`จำนวนเงินไม่ถูกต้อง: ${input}`);
  return Math.round(value * 100);
}

export function satangToInput(satang: number): string {
  return (satang / 100).toFixed(2);
}

export function formatTHB(satang: number): string {
  return (satang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTHBCompact(satang: number): string {
  const baht = satang / 100;
  if (Number.isInteger(baht)) return baht.toLocaleString("th-TH");
  return formatTHB(satang);
}

export function mulSatang(unitPriceSatang: number, qty: number): number {
  return Math.round(unitPriceSatang * qty);
}

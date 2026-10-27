/**
 * กัน CSV formula injection: ถ้าข้อความขึ้นต้นด้วยอักขระที่ Excel/Sheets
 * ตีความเป็นสูตร (= + - @ tab CR) ให้เติม ' ข้างหน้า
 * ตัวเลขจริงไม่ถูกแตะ เพื่อให้ยอดติดลบยังคำนวณได้
 */
function neutralizeFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** สร้าง CSV (RFC 4180) รองรับภาษาไทย + เปิดใน Excel ได้ */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v) : neutralizeFormula(String(v));
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  // BOM สำหรับ Excel ให้อ่าน UTF-8 ภาษาไทยถูกต้อง
  return "\uFEFF" + lines.join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

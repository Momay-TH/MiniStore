/** สร้าง CSV (RFC 4180) รองรับภาษาไทย + เปิดใน Excel ได้ */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
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

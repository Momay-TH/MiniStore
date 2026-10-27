const TZ = "Asia/Bangkok";

const dateTimeFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(ms: number): string {
  return dateTimeFmt.format(new Date(ms));
}

export function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}

export function formatTime(ms: number): string {
  return timeFmt.format(new Date(ms));
}

/** yyyyMMdd ตามเวลาไทย (ใช้สร้างเลขที่บิล) */
export function bkkDateKey(ms: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return parts.replaceAll("-", "");
}

/** ต้นวันตามเวลาไทย (คืนค่าเป็น ms UTC) */
export function startOfTodayBkk(now: number = Date.now()): number {
  const offsetMs = 7 * 60 * 60 * 1000;
  const shifted = new Date(now + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - offsetMs;
}

/** นับจำนวนวันตามปฏิทิน (เวลาไทย) — ไม่ใช่ช่วง 24 ชม. */
export function daysBetween(fromMs: number, toMs: number = Date.now()): number {
  return Math.floor(
    (startOfTodayBkk(toMs) - startOfTodayBkk(fromMs)) / 86_400_000,
  );
}

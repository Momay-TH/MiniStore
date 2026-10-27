export type AgingBucket = "0-7" | "8-30" | "31-60" | "60+";

export const AGING_BUCKETS: { key: AgingBucket; label: string; style: string }[] = [
  { key: "0-7", label: "0–7 วัน", style: "bg-emerald-100 text-emerald-700" },
  { key: "8-30", label: "8–30 วัน", style: "bg-amber-100 text-amber-700" },
  { key: "31-60", label: "31–60 วัน", style: "bg-orange-100 text-orange-700" },
  { key: "60+", label: "เกิน 60 วัน", style: "bg-red-100 text-red-700" },
];

export function agingBucket(days: number): AgingBucket {
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  return "60+";
}

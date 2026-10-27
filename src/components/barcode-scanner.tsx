"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * กล้องสแกนบาร์โค้ด (ใช้ร่วมกันทุกหน้า)
 * - เปิด/ปิดผ่าน prop `open`
 * - เมื่ออ่านได้จะหยุดกล้องแล้วเรียก `onDetected(code)` ครั้งเดียว
 * - แสดงข้อความ error ในแผงเอง (เช่น ไม่ได้อนุญาตกล้อง)
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  hint = "กำลังสแกน… อ่านบาร์โค้ดจากกล้อง",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  hint?: string;
}) {
  const reactId = useId();
  const elementId = `barcode-scanner-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError(null);

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decodedText) => {
          const code = decodedText.trim();
          if (!code || handledRef.current) return;
          handledRef.current = true;

          const current = scannerRef.current;
          scannerRef.current = null;
          const stop = current
            ? current.stop().catch(() => undefined)
            : Promise.resolve();

          void stop.then(() => onDetected(code));
        },
        () => {
          /* ยังอ่านไม่เจอ → ลองต่อ */
        },
      )
      .catch((err: unknown) => {
        scannerRef.current = null;
        const detail =
          err && typeof err === "object" && "message" in err
            ? `: ${String((err as { message: unknown }).message)}`
            : "";
        setError(
          "ไม่สามารถเปิดกล้องได้ (ตรวจสิทธิ์กล้องหรืออุปกรณ์ไม่รองรับ)" + detail,
        );
      });

    return () => {
      scannerRef.current = null;
      if (scanner.isScanning) {
        scanner.stop().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, elementId]);

  if (!open) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-900">
      <div id={elementId} className="h-56 w-full" />
      <div className="flex items-start justify-between gap-2 bg-slate-900 px-3 py-2">
        <p
          className={`min-w-0 flex-1 text-xs ${
            error ? "text-red-300" : "text-white/70"
          }`}
        >
          {error ?? hint}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
        >
          ปิดกล้อง
        </button>
      </div>
    </div>
  );
}

/** ปุ่มเปิดกล้องสแกน (ใช้คู่กับ BarcodeScanner) */
export function ScanButton({
  active,
  onClick,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "ปิดกล้องสแกนบาร์โค้ด" : "สแกนบาร์โค้ดด้วยกล้อง"}
      className={`h-11 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 active:bg-slate-50 ${className}`}
    >
      <span className="text-lg leading-none" aria-hidden>
        📷
      </span>
    </button>
  );
}

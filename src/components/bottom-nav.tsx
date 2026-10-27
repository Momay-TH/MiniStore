"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const items: Item[] = [
  {
    href: "/",
    label: "ภาพรวม",
    icon: (
      <svg {...iconProps}>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 9.5v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-11" />
      </svg>
    ),
  },
  {
    href: "/pos",
    label: "ขาย",
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3.5h2.2l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3l1.4-6.9H6" />
      </svg>
    ),
  },
  {
    href: "/sales",
    label: "บิล",
    icon: (
      <svg {...iconProps}>
        <path d="M6 2.8h12v18.4l-2.4-1.7-2.4 1.7-2.4-1.7-2.4 1.7-2.4-1.7z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/products",
    label: "สินค้า",
    icon: (
      <svg {...iconProps}>
        <path d="M20.5 7.5 12 3 3.5 7.5 12 12z" />
        <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
        <path d="M12 12v9" />
      </svg>
    ),
  },
  {
    href: "/stock",
    label: "สต็อก",
    icon: (
      <svg {...iconProps}>
        <path d="M3 9.5h18M3 14.5h18" />
        <path d="M5.5 9.5V5.8A1.8 1.8 0 0 1 7.3 4h9.4a1.8 1.8 0 0 1 1.8 1.8v3.7" />
        <path d="M5.5 14.5v3.7A1.8 1.8 0 0 0 7.3 20h9.4a1.8 1.8 0 0 0 1.8-1.8v-3.7" />
      </svg>
    ),
  },
  {
    href: "/customers",
    label: "ลูกค้า",
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" />
        <path d="M16.5 5.2a3 3 0 0 1 0 5.7M18 20c0-2.4-.9-4.2-2.4-5.2" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-safe">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                  active ? "text-brand-600" : "text-slate-400 active:text-slate-600"
                }`}
              >
                <span className={active ? "scale-105" : ""}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

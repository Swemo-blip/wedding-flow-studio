"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

const tabItems = [
  { href: "/", label: "Overview" },
  { href: "/ceremony", label: "Ceremony" },
  { href: "/reception", label: "Reception" },
  { href: "/day-flow", label: "Timeline" },
  { href: "/music", label: "Music" },
  { href: "/speeches", label: "Speeches" },
  { href: "/vendors", label: "Vendors" },
  { href: "/exports", label: "Exports" }
];

export function TabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav aria-label="Planning sections" className="studio-tab-bar">
      {tabItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link aria-current={isActive ? "page" : undefined} data-active={isActive} href={item.href} key={item.href}>
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  Church,
  Clapperboard,
  FileText,
  LayoutGrid,
  Mic2,
  Music2,
  Play,
  Store,
  UtensilsCrossed,
  Wand2,
  type LucideIcon
} from "lucide-react";
import { getNavigationItemForPath, navigationItems } from "@/lib/app-navigation";

type SideNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const sideNavItems: SideNavItem[] = [
  { href: "/", icon: LayoutGrid, label: "Overview" },
  { href: "/preview", icon: Play, label: "Preview Day" },
  { href: "/ceremony", icon: Church, label: "Ceremony" },
  { href: "/reception", icon: UtensilsCrossed, label: "Reception" },
  { href: "/day-flow", icon: CalendarClock, label: "Timeline" },
  { href: "/music", icon: Music2, label: "Music" },
  { href: "/speeches", icon: Mic2, label: "Speeches" },
  { href: "/director", icon: Clapperboard, label: "Director" },
  { href: "/vendors", icon: Store, label: "Vendors" },
  { href: "/exports", icon: FileText, label: "Exports" },
  { href: "/intake", icon: Wand2, label: "New Project" }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="side-nav">
      {sideNavItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" || pathname.startsWith("/studio") : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link aria-current={isActive ? "page" : undefined} className="side-nav-link" data-active={isActive} href={item.href} key={item.href}>
            <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = getNavigationItemForPath(pathname);
  const activeValue = navigationItems.some((item) => item.href === activeItem.href) ? activeItem.href : "/";

  return (
    <select
      aria-label="Choose section"
      className="mobile-nav"
      onChange={(event) => {
        router.push(event.target.value);
      }}
      value={activeValue}
    >
      {navigationItems.map((item) => (
        <option key={item.href} value={item.href}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

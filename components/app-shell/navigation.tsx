"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  Church,
  FileText,
  LayoutGrid,
  Mic2,
  Music2,
  Play,
  Store,
  Users,
  UtensilsCrossed,
  type LucideIcon
} from "lucide-react";
import { getNavigationItemForPath, navigationItems } from "@/lib/app-navigation";
import { useTranslation } from "@/lib/i18n";

type SideNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  // A "jump" link that navigates somewhere shared but does not own that route's
  // active state (e.g. Guests currently opens the guest manager in Reception).
  passive?: boolean;
};

type NavGroup = {
  label: string;
  items: SideNavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Plan",
    items: [
      { href: "/", icon: LayoutGrid, label: "Overview" },
      { href: "/ceremony", icon: Church, label: "Ceremony" },
      { href: "/reception", icon: UtensilsCrossed, label: "Reception" },
      { href: "/day-flow", icon: CalendarClock, label: "Timeline" }
    ]
  },
  {
    label: "Details",
    items: [
      { href: "/reception", icon: Users, label: "Guests", passive: true },
      { href: "/music", icon: Music2, label: "Music" },
      { href: "/speeches", icon: Mic2, label: "Speeches" },
      { href: "/vendors", icon: Store, label: "Vendors" }
    ]
  },
  {
    label: "Output",
    items: [
      { href: "/preview", icon: Play, label: "Preview Day" },
      { href: "/exports", icon: FileText, label: "Exports" }
    ]
  }
];

function isItemActive(item: SideNavItem, pathname: string) {
  if (item.passive) {
    return false;
  }
  if (item.href === "/") {
    return pathname === "/" || pathname.startsWith("/studio");
  }
  return pathname.startsWith(item.href);
}

export function Navigation() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav aria-label="Primary navigation" className="side-nav">
      {navGroups.map((group) => (
        <div className="side-nav-group" key={group.label}>
          <p className="side-nav-group-label">{t(group.label)}</p>
          {group.items.map((item) => {
            const isActive = isItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className="side-nav-link"
                data-active={isActive}
                href={item.href}
                key={item.label}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </div>
      ))}
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

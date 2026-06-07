"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getNavigationItemForPath, navigationItems, type AppNavigationItem } from "@/lib/app-navigation";

export function Navigation() {
  const pathname = usePathname();
  const coreItems = navigationItems.filter((item) => item.group === "Core");
  const detailItems = navigationItems.filter((item) => item.group === "Details");
  const detailIsActive = detailItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav aria-label="Primary navigation" className="nav-list">
      <div className="nav-group">
        <span className="nav-group-title">Studio Flow</span>
        {coreItems.map((item) => renderNavLink(item, pathname))}
      </div>

      <details className="nav-details" open={detailIsActive}>
        <summary>
          <span>Planning Layers</span>
          <small>{detailIsActive ? "Active" : "Open when needed"}</small>
        </summary>
        <div className="nav-group nav-group-collapsed">
          {detailItems.map((item) => renderNavLink(item, pathname))}
        </div>
      </details>
    </nav>
  );
}

function renderNavLink(item: AppNavigationItem, pathname: string) {
  const isActive = item.href === "/" ? pathname === "/" || pathname.startsWith("/studio") : pathname.startsWith(item.href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className="nav-link"
      data-active={isActive}
      data-primary={item.href === "/"}
      href={item.href}
      key={item.href}
    >
      <span>{item.label}</span>
      <small>{item.shortDescription}</small>
    </Link>
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

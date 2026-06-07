"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavigationItemForPath } from "@/lib/app-navigation";

export function RouteRibbon() {
  const pathname = usePathname();
  const activeItem = getNavigationItemForPath(pathname);

  return (
    <section className="route-ribbon" aria-label="Current planning layer">
      <div>
        <span>{activeItem.signal}</span>
        <strong>{activeItem.label}</strong>
      </div>
      <p>{activeItem.summary}</p>
      <Link href={activeItem.primaryActionHref}>{activeItem.primaryActionLabel}</Link>
    </section>
  );
}

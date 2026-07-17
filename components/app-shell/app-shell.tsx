"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/app-shell/navigation";
import { SampleRibbon } from "@/components/app-shell/sample-ribbon";
import { TopBar } from "@/components/app-shell/top-bar";
import { useTranslation } from "@/lib/i18n";
import type { Wedding } from "@/lib/wedding-types";

type AppShellProps = {
  children: React.ReactNode;
  wedding: Wedding;
};

export function AppShell({ children, wedding }: AppShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  // The shared read-only preview is opened by a guest, not the couple — it must
  // stand alone with no editing chrome (sidebar nav, Copy link, Preview Day).
  if (pathname?.startsWith("/shared")) {
    return <>{children}</>;
  }

  const plannerInitials = wedding.plannerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside aria-label="Studio navigation" className="sidebar">
        <div className="brand-mark">
          <span className="brand-symbol" aria-hidden="true">WF</span>
          <p className="brand-kicker">{t("Wedding Flow Studio")}</p>
        </div>
        <Navigation />
        <div className="sidebar-user">
          <span aria-hidden="true" className="sidebar-avatar">{plannerInitials}</span>
          <div>
            <strong>{wedding.plannerName}</strong>
            <span>{t("Planner")}</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        {/* The home route IS the 3D studio workspace — it brings its own minimal
            header (scene selector, Edit/Preview mode, save state, one primary
            action), so the global top bar would only duplicate CTAs above it. */}
        {pathname === "/" ? null : <TopBar wedding={wedding} />}
        <SampleRibbon />
        <main className="page-shell" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/app-shell/navigation";
import { SampleRibbon } from "@/components/app-shell/sample-ribbon";
import { TopBar } from "@/components/app-shell/top-bar";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type AppShellProps = {
  children: React.ReactNode;
  wedding: Wedding;
};

export function AppShell({ children, wedding }: AppShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { hasLocalProject, wedding: localWedding } = useLocalProject();

  // The shared read-only preview is opened by a guest, not the couple — it must
  // stand alone with no editing chrome (sidebar nav, Copy link, Preview Day).
  if (pathname?.startsWith("/shared")) {
    return <>{children}</>;
  }

  // This block used to show `wedding.plannerName` from the sample data — a
  // fictional planner ("Olivia Hart") who stayed in the chrome on every route
  // even after the couple created their own plan. There is no planner account,
  // so the honest occupant of that slot is the couple themselves. On the home
  // route there is no TopBar, which makes this the only place their names appear.
  const identityName = hasLocalProject ? localWedding.coupleNames : null;
  const identityInitials = identityName
    ? identityName
        .split(/\s*&\s*|\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

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
        {identityName ? (
          <div className="sidebar-user">
            <span aria-hidden="true" className="sidebar-avatar">{identityInitials}</span>
            <div>
              <strong>{identityName}</strong>
              <span>{t("Your wedding")}</span>
            </div>
          </div>
        ) : null}
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

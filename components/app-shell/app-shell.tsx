"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Navigation } from "@/components/app-shell/navigation";
import { TabBar } from "@/components/app-shell/tab-bar";
import { TopBar } from "@/components/app-shell/top-bar";
import { useTranslation } from "@/lib/i18n";
import type { Wedding } from "@/lib/wedding-types";

type AppShellProps = {
  children: React.ReactNode;
  wedding: Wedding;
};

export function AppShell({ children, wedding }: AppShellProps) {
  const { t } = useTranslation();
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
        <div className="sidebar-callout">
          <Sparkles aria-hidden="true" size={16} strokeWidth={1.7} />
          <strong>{t("Digital Twin Active")}</strong>
          <span>{t("All changes update your 3D preview.")}</span>
          <Link href="/preview">{t("View Walkthrough")}</Link>
        </div>
        <div className="sidebar-user">
          <span aria-hidden="true" className="sidebar-avatar">{plannerInitials}</span>
          <div>
            <strong>{wedding.plannerName}</strong>
            <span>{t("Planner")}</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <TopBar wedding={wedding} />
        <TabBar />
        <main className="page-shell" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

import { Navigation } from "@/components/app-shell/navigation";
import { RouteRibbon } from "@/components/app-shell/route-ribbon";
import { TopBar } from "@/components/app-shell/top-bar";
import type { Wedding } from "@/lib/wedding-types";

type AppShellProps = {
  children: React.ReactNode;
  wedding: Wedding;
};

export function AppShell({ children, wedding }: AppShellProps) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside aria-label="Studio navigation" className="sidebar">
        <div className="brand-mark">
          <span className="brand-symbol" aria-hidden="true">WF</span>
          <div>
            <p className="brand-kicker">Wedding Flow Studio</p>
            <h2 className="brand-title">Digital Twin Studio</h2>
          </div>
        </div>
        <Navigation />
        <div className="sidebar-footer">
          <strong>Director Mode</strong>
          <span>Role briefs ready</span>
        </div>
      </aside>
      <div className="workspace">
        <TopBar wedding={wedding} />
        <RouteRibbon />
        <main className="page-shell" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

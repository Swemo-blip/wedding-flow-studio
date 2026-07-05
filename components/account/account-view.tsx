"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { CloudCheck, CloudOff, Download, HardDrive, Upload } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { downloadBackup, restoreBackup } from "@/lib/project-backup";
import { useAuth } from "@/lib/use-auth";

export function AccountView() {
  const { t } = useTranslation();
  const { configured, loading, signIn, signOut, signUp, user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  function handleDownloadBackup() {
    setDataError(null);
    downloadBackup();
    setDataNotice(t("Backup downloaded — keep it somewhere safe."));
  }

  async function handleRestoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setDataError(null);
    setDataNotice(null);
    const result = await restoreBackup(file);

    if (!result.ok) {
      setDataError(result.error === "not-json" ? t("Couldn't read that file.") : t("That file isn't a Wedding Flow Studio backup."));
      return;
    }

    setDataNotice(t("Backup restored — reloading your plan…"));
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const action = mode === "signin" ? signIn : signUp;
    const { error: actionError } = await action(email.trim(), password);
    if (actionError) {
      setError(actionError);
    } else if (mode === "signup") {
      setNotice(t("Account created. Check your email to confirm, then sign in."));
      setMode("signin");
    }
    setBusy(false);
  }

  return (
    <StudioRouteFrame
      description="Create an account now. Your plan is saved on this device today — cloud backup and sharing are coming soon."
      eyebrow="Account"
      meta={[{ label: "Cloud", value: configured ? (user ? "Signed in" : "Ready") : "Local only" }]}
      title="Your wedding, everywhere."
    >
      <div className="account-screen">
        {!configured ? (
          <section className="account-card">
            <div className="account-status" data-tone="off">
              <CloudOff aria-hidden="true" size={20} />
              <div>
                <h2>{t("Cloud sync isn't set up yet")}</h2>
                <p>{t("The app is running locally — everything saves to this browser. To enable accounts, cloud sync and sharing, connect a free Supabase project.")}</p>
              </div>
            </div>
            <p className="account-hint">{t("Setup guide: docs/supabase-setup.md (about 5 minutes, no credit card).")}</p>
          </section>
        ) : user ? (
          <section className="account-card">
            <div className="account-status" data-tone="on">
              <CloudCheck aria-hidden="true" size={20} />
              <div>
                <h2>{t("Signed in")}</h2>
                <p>{user.email}</p>
              </div>
            </div>
            <p className="account-hint">{t("Signed in. Your plan is still saved on this device — cloud backup is coming soon.")}</p>
            <button className="account-button account-button-secondary" onClick={() => void signOut()} type="button">
              {t("Sign out")}
            </button>
          </section>
        ) : (
          <section className="account-card">
            <div aria-label={t("Account mode")} className="reception-view-toggle account-mode" role="group">
              <button aria-pressed={mode === "signin"} data-active={mode === "signin"} onClick={() => setMode("signin")} type="button">
                {t("Sign in")}
              </button>
              <button aria-pressed={mode === "signup"} data-active={mode === "signup"} onClick={() => setMode("signup")} type="button">
                {t("Create account")}
              </button>
            </div>
            <form className="account-form" onSubmit={handleSubmit}>
              <label className="account-field">
                <span>{t("Email")}</span>
                <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <label className="account-field">
                <span>{t("Password")}</span>
                <input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              {error ? <p className="account-error">{error}</p> : null}
              {notice ? <p className="account-notice">{notice}</p> : null}
              <button className="account-button" disabled={busy || loading} type="submit">
                {busy ? t("Working…") : mode === "signin" ? t("Sign in") : t("Create account")}
              </button>
            </form>
          </section>
        )}

        <section className="account-card">
          <div className="account-status" data-tone="off">
            <HardDrive aria-hidden="true" size={20} />
            <div>
              <h2>{t("Back up your plan")}</h2>
              <p>{t("Everything you enter is saved in this browser. Download a backup file to keep it safe, or move your plan to another device.")}</p>
            </div>
          </div>
          <div className="account-actions">
            <button className="account-button account-file-button" onClick={handleDownloadBackup} type="button">
              <Download aria-hidden="true" size={16} />
              {t("Download backup")}
            </button>
            <label className="account-button account-button-secondary account-file-button">
              <Upload aria-hidden="true" size={16} />
              {t("Restore from backup")}
              <input accept="application/json,.json" hidden onChange={handleRestoreBackup} type="file" />
            </label>
          </div>
          {dataNotice ? <p className="account-notice">{dataNotice}</p> : null}
          {dataError ? <p className="account-error">{dataError}</p> : null}
        </section>
      </div>
    </StudioRouteFrame>
  );
}

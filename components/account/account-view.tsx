"use client";

import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { CloudCheck, CloudOff, Download, HardDrive, Heart, History, Upload } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { readDailySnapshotSummary, restoreDailySnapshot } from "@/lib/local-project-store";
import { downloadBackup, restoreBackup } from "@/lib/project-backup";
import { useAuth } from "@/lib/use-auth";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

// Mirrors how the intake builds the display name, so editing a partner's name
// keeps the couple line ("Klara & Johan") consistent with a freshly created plan.
function buildCoupleNames(partnerOneName: string, partnerTwoName: string) {
  const firstName = (value: string) => value.trim().split(/\s+/)[0] ?? "";
  return [firstName(partnerOneName), firstName(partnerTwoName)].filter(Boolean).join(" & ");
}

export function AccountView() {
  const { t } = useTranslation();
  // Read after mount: the snapshot lives in localStorage, so reading it during
  // render would make the server output and the first client paint disagree.
  const [snapshot, setSnapshot] = useState<ReturnType<typeof readDailySnapshotSummary>>(null);
  useEffect(() => {
    queueMicrotask(() => setSnapshot(readDailySnapshotSummary()));
  }, []);
  const { configured, loading, signIn, signOut, signUp, user } = useAuth();
  const { hasLocalProject, updatedAt, updateWedding, wedding } = useLocalProject();
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  function handleSaveDetails(draft: Wedding) {
    setDetailsNotice(null);
    setDetailsError(null);

    if (!draft.partnerOneName.trim() || !draft.partnerTwoName.trim()) {
      setDetailsError(t("Add both of your names before creating the plan."));
      return;
    }

    if (!draft.date.trim()) {
      setDetailsError(t("Add your wedding date before creating the plan."));
      return;
    }

    updateWedding({
      coupleNames: buildCoupleNames(draft.partnerOneName, draft.partnerTwoName),
      ceremonyLocation: draft.ceremonyLocation.trim(),
      date: draft.date.trim(),
      guestCount: Math.max(2, Math.min(300, Math.round(draft.guestCount) || 2)),
      partnerOneName: draft.partnerOneName.trim(),
      partnerTwoName: draft.partnerTwoName.trim(),
      receptionLocation: draft.receptionLocation.trim()
    });
    setDetailsNotice(t("Wedding details saved."));
  }
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

  function handleRestoreSnapshot() {
    setDataError(null);
    setDataNotice(null);
    if (!restoreDailySnapshot()) {
      setDataError(t("That saved version could not be read."));
      return;
    }
    setDataNotice(t("Restored — reloading your plan…"));
    window.setTimeout(() => window.location.reload(), 900);
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
      eyebrow="Account"
      title="Keep your plan safe."
    >
      <div className="account-screen">
        {/* The couple's own facts were writable only by the intake, which replaces
            the entire plan — so correcting a date meant destroying guests, seating,
            timeline, speeches, budget and checklist and starting again. */}
        {hasLocalProject ? (
          <section className="account-card">
            <div className="account-status" data-tone="on">
              <Heart aria-hidden="true" size={20} />
              <div>
                <h2>{t("Your wedding details")}</h2>
                <p>{t("Change these whenever plans change — the rest of your plan stays exactly as it is.")}</p>
              </div>
            </div>
            {/* Keyed on the stored wedding's updatedAt so the draft is initialised
                once per saved version — a restore or another tab's edit remounts it
                with fresh values, and there is no state written during render. */}
            <WeddingDetailsForm key={updatedAt ?? "initial"} onSave={handleSaveDetails} wedding={wedding}>
              {detailsError ? <p className="account-error">{detailsError}</p> : null}
              {detailsNotice ? <p className="account-notice">{detailsNotice}</p> : null}
            </WeddingDetailsForm>
          </section>
        ) : null}

        {!configured ? (
          <section className="account-card">
            <div className="account-status" data-tone="off">
              <CloudOff aria-hidden="true" size={20} />
              <div>
                <h2>{t("Cloud sync isn't set up yet")}</h2>
                <p>{t("The app is running locally — everything saves to this browser. To add an account (cloud backup is coming soon), connect a free Supabase project.")}</p>
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

          {/* The automatic net, shown only when there is actually something in it.
              The download above is the copy you have to remember; this is the one
              the app keeps for you. It states what it holds, because restoring
              blind is how you lose a second version on top of the first. */}
          {snapshot ? (
            <div className="account-snapshot">
              <div>
                <span>{t("Kept automatically")}</span>
                <strong>
                  {t("How your plan looked on {date}", { date: snapshot.savedOn })}
                </strong>
                <small>
                  {snapshot.coupleNames ? `${snapshot.coupleNames} · ` : ""}
                  {t("{guests} guests · {moments} moments", { guests: snapshot.guests, moments: snapshot.moments })}
                </small>
              </div>
              <button className="account-button account-button-secondary" onClick={handleRestoreSnapshot} type="button">
                <History aria-hidden="true" size={16} />
                {t("Go back to this")}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </StudioRouteFrame>
  );
}

// The wedding-details form owns its own draft so typing never writes to the store;
// the couple presses Save. Its parent keys it by the stored `updatedAt`, so the
// draft is seeded from props exactly once per saved version.
function WeddingDetailsForm({
  children,
  onSave,
  wedding
}: {
  children: ReactNode;
  onSave: (draft: Wedding) => void;
  wedding: Wedding;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(wedding);

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label className="account-field">
        <span>{t("Partner one")}</span>
        <input onChange={(event) => setDraft({ ...draft, partnerOneName: event.target.value })} value={draft.partnerOneName} />
      </label>
      <label className="account-field">
        <span>{t("Partner two")}</span>
        <input onChange={(event) => setDraft({ ...draft, partnerTwoName: event.target.value })} value={draft.partnerTwoName} />
      </label>
      <label className="account-field">
        <span>{t("Wedding date")}</span>
        <input onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} />
      </label>
      <label className="account-field">
        <span>{t("Ceremony venue")}</span>
        <input
          onChange={(event) => setDraft({ ...draft, ceremonyLocation: event.target.value })}
          placeholder={t("Not booked yet")}
          value={draft.ceremonyLocation}
        />
      </label>
      <label className="account-field">
        <span>{t("Reception venue")}</span>
        <input
          onChange={(event) => setDraft({ ...draft, receptionLocation: event.target.value })}
          placeholder={t("Not booked yet")}
          value={draft.receptionLocation}
        />
      </label>
      <label className="account-field">
        <span>{t("Guest count")}</span>
        <input
          inputMode="numeric"
          max={300}
          min={2}
          onChange={(event) => setDraft({ ...draft, guestCount: Number(event.target.value) })}
          type="number"
          value={draft.guestCount}
        />
      </label>
      {children}
      <button className="account-button" type="submit">
        {t("Save details")}
      </button>
    </form>
  );
}

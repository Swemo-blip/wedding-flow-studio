"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { decodeSnapshot, readShareHash, type ShareSnapshot } from "@/lib/share-snapshot";

type LoadState = { status: "loading" } | { status: "empty" } | { status: "ready"; snapshot: ShareSnapshot };

export default function SharedPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    // Read + decode the hash only after mount so the first client paint matches
    // the prerendered "loading" state (no hydration mismatch).
    const payload = readShareHash();
    const snapshot = payload ? decodeSnapshot(payload) : null;
    queueMicrotask(() => setState(snapshot ? { status: "ready", snapshot } : { status: "empty" }));
  }, []);

  if (state.status === "loading") {
    return (
      <div className="shared-view shared-view-center">
        <p className="shared-loading">{t("Opening the plan…")}</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="shared-view shared-view-center">
        <span className="eyebrow">{t("Wedding Flow Studio")}</span>
        <h1 className="shared-couple">{t("This link has no plan to show.")}</h1>
        <p className="shared-meta">{t("Ask for a fresh link, or start your own wedding preview.")}</p>
        <Link className="button button-primary" href="/">{t("Open Wedding Flow Studio")}</Link>
      </div>
    );
  }

  const { snapshot } = state;
  const facts: Array<{ label: string; value: string }> = [
    { label: t("Date"), value: snapshot.wedding.date },
    { label: t("Ceremony"), value: snapshot.wedding.ceremonyLocation },
    { label: t("Reception"), value: snapshot.wedding.receptionLocation },
    { label: t("Guests"), value: `${snapshot.guests.attending} / ${snapshot.guests.invited}` },
    { label: t("Style"), value: snapshot.wedding.style }
  ].filter((fact) => fact.value);

  return (
    <div className="shared-view">
      <header className="shared-hero">
        <span className="eyebrow">{t("A wedding preview")}</span>
        <h1 className="shared-couple">{snapshot.wedding.coupleNames}</h1>
        <p className="shared-meta">
          {snapshot.wedding.date}
          {snapshot.wedding.ceremonyLocation ? ` · ${snapshot.wedding.ceremonyLocation}` : ""}
        </p>
      </header>

      <section className="shared-facts" aria-label={t("Wedding facts")}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </section>

      {snapshot.timeline.length > 0 ? (
        <section className="shared-timeline" aria-label={t("Run of show")}>
          <h2>{t("Run of show")}</h2>
          <ol>
            {snapshot.timeline.map((item, index) => (
              <li key={`${item.time}-${item.title}-${index}`}>
                <span className="shared-time">{item.time}</span>
                <div>
                  <strong>{item.title}</strong>
                  {item.location ? <p>{item.location}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="shared-footer">
        <span>{t("Previewed with Wedding Flow Studio")}</span>
        <Link href="/">{t("Plan your own")}</Link>
      </footer>
    </div>
  );
}

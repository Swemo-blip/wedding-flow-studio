"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { formatCurrency } from "@/lib/wedding-budget";
import { useBudget } from "@/lib/use-budget";
import { useChecklist } from "@/lib/use-checklist";

export function SummaryView() {
  const { t } = useTranslation();
  const { guests, timelineItems, wedding } = useLocalProject();
  const { items: budgetItems, target } = useBudget();
  const { tasks } = useChecklist();
  const [daysToGo, setDaysToGo] = useState<number | null>(null);

  useEffect(() => {
    const weddingDate = new Date(wedding.date);
    if (Number.isNaN(weddingDate.getTime())) return;
    queueMicrotask(() => setDaysToGo(Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000))));
  }, [wedding.date]);

  const guestStats = useMemo(() => {
    const attending = guests.filter((guest) => guest.rsvpStatus === "attending").length;
    const pending = guests.filter((guest) => guest.rsvpStatus === "pending").length;
    const declined = guests.filter((guest) => guest.rsvpStatus === "declined").length;
    const meals = new Map<string, number>();
    for (const guest of guests) {
      if (guest.rsvpStatus !== "attending") continue;
      const meal = guest.mealChoice.trim() || t("Not chosen");
      meals.set(meal, (meals.get(meal) ?? 0) + 1);
    }
    return { invited: guests.length, attending, pending, declined, meals: Array.from(meals.entries()).sort((a, b) => b[1] - a[1]) };
  }, [guests, t]);

  const budgetStats = useMemo(() => {
    const estimate = budgetItems.reduce((sum, item) => sum + (Number(item.estimate) || 0), 0);
    const paid = budgetItems.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
    return { estimate, paid, remaining: Math.max(0, estimate - paid), overBudget: estimate > target, target };
  }, [budgetItems, target]);

  const checklistStats = useMemo(() => {
    const done = tasks.filter((task) => task.done).length;
    return { done, total: tasks.length, percent: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0 };
  }, [tasks]);

  return (
    <div className="summary-screen">
      <div className="summary-actions no-print">
        <p className="summary-actions-note">{t("A one-page overview to print or share with your partner and vendors.")}</p>
        <button className="account-button" onClick={() => window.print()} type="button">
          <Printer aria-hidden="true" size={15} />
          {t("Print / Save as PDF")}
        </button>
      </div>

      <article className="summary-sheet">
        <header className="summary-head">
          <p className="eyebrow">{t("Wedding summary")}</p>
          <h1 className="summary-couple">{wedding.coupleNames}</h1>
          <p className="summary-meta">
            {wedding.date}
            {daysToGo !== null ? ` · ${daysToGo} ${t("days to go")}` : ""} · {wedding.ceremonyLocation}
            {wedding.receptionLocation && wedding.receptionLocation !== wedding.ceremonyLocation ? ` → ${wedding.receptionLocation}` : ""}
          </p>
        </header>

        <div className="summary-grid">
          <section className="summary-block">
            <h2>{t("Guests")}</h2>
            <ul className="summary-stats">
              <li><span>{t("Invited")}</span><strong>{guestStats.invited}</strong></li>
              <li><span>{t("Attending")}</span><strong>{guestStats.attending}</strong></li>
              <li><span>{t("Pending")}</span><strong>{guestStats.pending}</strong></li>
              <li><span>{t("Declined")}</span><strong>{guestStats.declined}</strong></li>
            </ul>
            {guestStats.meals.length > 0 ? (
              <p className="summary-note">
                {guestStats.meals.map(([meal, count]) => `${meal} ${count}`).join(" · ")}
              </p>
            ) : null}
          </section>

          <section className="summary-block">
            <h2>{t("Budget")}</h2>
            <ul className="summary-stats">
              <li><span>{t("Total budget")}</span><strong>{formatCurrency(budgetStats.target)}</strong></li>
              <li><span>{t("Estimated")}</span><strong>{formatCurrency(budgetStats.estimate)}</strong></li>
              <li><span>{t("Paid")}</span><strong>{formatCurrency(budgetStats.paid)}</strong></li>
              <li><span>{t("Left to pay")}</span><strong>{formatCurrency(budgetStats.remaining)}</strong></li>
            </ul>
            <p className="summary-note" data-tone={budgetStats.overBudget ? "alert" : "good"}>
              {budgetStats.overBudget
                ? t("{amount} over budget", { amount: formatCurrency(budgetStats.estimate - budgetStats.target) })
                : t("{amount} under budget", { amount: formatCurrency(budgetStats.target - budgetStats.estimate) })}
            </p>
          </section>

          <section className="summary-block">
            <h2>{t("Checklist")}</h2>
            <ul className="summary-stats">
              <li><span>{t("Complete")}</span><strong>{checklistStats.percent}%</strong></li>
              <li><span>{t("Done")}</span><strong>{checklistStats.done}</strong></li>
              <li><span>{t("Still to do")}</span><strong>{checklistStats.total - checklistStats.done}</strong></li>
            </ul>
          </section>

          <section className="summary-block summary-block-wide">
            <h2>{t("Timeline")}</h2>
            <ul className="summary-timeline">
              {timelineItems.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <span className="summary-timeline-time">{item.time}</span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { Donut } from "@/components/ui/donut";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/wedding-budget";
import { BUDGET_CATEGORIES, VENDOR_TO_BUDGET_CATEGORY, useBudget } from "@/lib/use-budget";
import { useLocalProject } from "@/lib/use-local-project";

type BookedVendor = { id: string; name: string; quote: number };

export function BudgetView() {
  const { t } = useTranslation();
  const { addItem, items, removeItem, setTarget, target, updateItem } = useBudget();
  const { vendorCandidates } = useLocalProject();

  const totals = useMemo(() => {
    const estimate = items.reduce((sum, item) => sum + (Number(item.estimate) || 0), 0);
    const paid = items.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
    return { estimate, paid };
  }, [items]);

  const paidPercent = totals.estimate > 0 ? Math.min(100, Math.round((totals.paid / totals.estimate) * 100)) : 0;

  // Spend by category (share of the estimated total) — shows where the money goes.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const amount = Number(item.estimate) || 0;
      if (amount <= 0) continue;
      map.set(item.category, (map.get(item.category) ?? 0) + amount);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: totals.estimate > 0 ? Math.round((amount / totals.estimate) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [items, totals.estimate]);

  // Booked vendors (with their quote) grouped under the budget category they map
  // to — this is what ties the Vendors studio to the budget. Only booked ones.
  const bookedByCategory = useMemo(() => {
    const map = new Map<string, BookedVendor[]>();
    for (const candidate of vendorCandidates) {
      if (candidate.status !== "booked") continue;
      const category = VENDOR_TO_BUDGET_CATEGORY[candidate.categoryId] ?? "Other";
      const list = map.get(category) ?? [];
      list.push({ id: candidate.id, name: candidate.name, quote: Number(candidate.quote) || 0 });
      map.set(category, list);
    }
    return map;
  }, [vendorCandidates]);

  const bookedTotal = useMemo(
    () =>
      vendorCandidates
        .filter((candidate) => candidate.status === "booked")
        .reduce((sum, candidate) => sum + (Number(candidate.quote) || 0), 0),
    [vendorCandidates]
  );

  // What the couple has actually committed: the budgeted estimate plus any
  // booked vendor spend the estimate lines don't already cover. Reconciled per
  // category so a caterer you both estimated AND booked isn't counted twice —
  // only the amount a booking runs *beyond* its category's estimate is added.
  const committed = useMemo(() => {
    const estimateByCategory = new Map<string, number>();
    for (const item of items) {
      estimateByCategory.set(item.category, (estimateByCategory.get(item.category) ?? 0) + (Number(item.estimate) || 0));
    }

    let uncoveredBooked = 0;
    for (const [category, vendors] of bookedByCategory) {
      const bookedSum = vendors.reduce((sum, vendor) => sum + vendor.quote, 0);
      uncoveredBooked += Math.max(0, bookedSum - (estimateByCategory.get(category) ?? 0));
    }

    return totals.estimate + uncoveredBooked;
  }, [bookedByCategory, items, totals.estimate]);

  const remaining = Math.max(0, committed - totals.paid);
  const overBudget = committed > target;

  // Categories that have a booked vendor but no budget line yet — surfaced so a
  // booking never hides just because you haven't budgeted for it.
  const bookedOnlyCategories = useMemo(
    () => Array.from(bookedByCategory.keys()).filter((category) => !byCategory.some((row) => row.category === category)),
    [bookedByCategory, byCategory]
  );

  function renderBookedVendors(booked: BookedVendor[]) {
    return (
      <ul className="budget-breakdown-vendors">
        {booked.map((vendor) => (
          <li key={vendor.id}>
            <span className="budget-vendor-name">{vendor.name}</span>
            <span className="budget-vendor-quote">{vendor.quote > 0 ? formatCurrency(vendor.quote) : t("Booked")}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <StudioRouteFrame
      description="Track every cost in one place — estimate each line, log what's paid, and always see what's left."
      eyebrow="Budget"
      meta={[
        { label: "Estimated", value: formatCurrency(totals.estimate) },
        { label: "Paid", value: formatCurrency(totals.paid) },
        { label: "Left to pay", value: formatCurrency(remaining) }
      ]}
      primaryAction={{ href: "/exports", label: "Export summary" }}
      title="Where the money goes."
    >
      <div className="budget-screen">
        <section className="budget-summary" aria-label={t("Budget summary")}>
          <div className="budget-summary-donut">
            <Donut percent={paidPercent} tone="sage">
              <strong>{paidPercent}%</strong>
              <span>{t("paid")}</span>
            </Donut>
          </div>
          <div className="budget-summary-stats">
            <div>
              <span>{t("Estimated total")}</span>
              <strong>{formatCurrency(totals.estimate)}</strong>
            </div>
            <div>
              <span>{t("Paid so far")}</span>
              <strong>{formatCurrency(totals.paid)}</strong>
            </div>
            <div data-tone={remaining > 0 ? "due" : "clear"}>
              <span>{t("Left to pay")}</span>
              <strong>{formatCurrency(remaining)}</strong>
            </div>
          </div>
          <div className="budget-target">
            <label className="budget-target-field">
              <span>{t("Your total budget")}</span>
              <span className="budget-target-input">
                <span aria-hidden="true" className="budget-money-prefix">$</span>
                <input
                  aria-label={t("Your total budget")}
                  className="guests-cell-input"
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => setTarget(Number(event.target.value))}
                  type="number"
                  value={target}
                />
              </span>
            </label>
            <span className="budget-target-badge" data-over={overBudget ? "true" : undefined}>
              {overBudget
                ? t("{amount} over budget", { amount: formatCurrency(committed - target) })
                : t("{amount} under budget", { amount: formatCurrency(target - committed) })}
            </span>
          </div>
        </section>

        {byCategory.length > 0 || bookedByCategory.size > 0 ? (
          <section aria-label={t("Where it goes")} className="budget-breakdown">
            <div className="budget-breakdown-head">
              <h3>{t("Where it goes")}</h3>
              {bookedTotal > 0 ? (
                <span className="budget-breakdown-booked">
                  <strong>{formatCurrency(bookedTotal)}</strong> {t("booked with vendors")}
                </span>
              ) : null}
            </div>
            <div className="budget-breakdown-list">
              {byCategory.map((row) => {
                const booked = bookedByCategory.get(row.category) ?? [];
                const bookedSum = booked.reduce((sum, vendor) => sum + vendor.quote, 0);
                const overBooked = bookedSum > row.amount;
                return (
                  <div className="budget-breakdown-group" key={row.category}>
                    <div className="budget-breakdown-row">
                      <span className="budget-breakdown-label">{t(row.category)}</span>
                      <span aria-hidden="true" className="budget-breakdown-bar">
                        <span style={{ width: `${row.pct}%` }} />
                      </span>
                      <span className="budget-breakdown-amount">
                        {formatCurrency(row.amount)} · {row.pct}%
                      </span>
                    </div>
                    {booked.length > 0 ? renderBookedVendors(booked) : null}
                    {overBooked ? (
                      <span className="budget-breakdown-over">
                        {t("Booked {amount} over this estimate", { amount: formatCurrency(bookedSum - row.amount) })}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {bookedOnlyCategories.map((category) => (
                <div className="budget-breakdown-group" key={category}>
                  <div className="budget-breakdown-row">
                    <span className="budget-breakdown-label">{t(category)}</span>
                    <span aria-hidden="true" className="budget-breakdown-bar" />
                    <span className="budget-breakdown-amount budget-breakdown-note">{t("Not budgeted yet")}</span>
                  </div>
                  {renderBookedVendors(bookedByCategory.get(category) ?? [])}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="budget-toolbar">
          <span className="budget-count">{t("{count} line items", { count: items.length })}</span>
          <button className="guests-add" onClick={addItem} type="button">
            <Plus aria-hidden="true" size={15} />
            {t("Add item")}
          </button>
        </div>

        <div aria-label={t("Budget items")} className="budget-list" role="table">
          <div className="budget-row budget-row-head" role="row">
            <span role="columnheader">{t("Item")}</span>
            <span role="columnheader">{t("Category")}</span>
            <span className="budget-num-head" role="columnheader">{t("Estimate")}</span>
            <span className="budget-num-head" role="columnheader">{t("Paid")}</span>
            <span className="budget-num-head" role="columnheader">{t("Left")}</span>
            <span className="sr-only" role="columnheader">{t("Actions")}</span>
          </div>
          {items.map((item) => {
            const left = Math.max(0, (Number(item.estimate) || 0) - (Number(item.paid) || 0));
            return (
              <div className="budget-row" key={item.id} role="row">
                <span role="cell">
                  <input
                    aria-label={t("Item")}
                    className="guests-cell-input guests-cell-input-name"
                    onChange={(event) => updateItem(item.id, { label: event.target.value })}
                    placeholder={t("Item")}
                    value={item.label}
                  />
                </span>
                <span role="cell">
                  <select
                    aria-label={t("Category")}
                    className="budget-category-select"
                    onChange={(event) => updateItem(item.id, { category: event.target.value })}
                    value={item.category}
                  >
                    {BUDGET_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {t(category)}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="budget-num" role="cell">
                  <span aria-hidden="true" className="budget-money-prefix">$</span>
                  <input
                    aria-label={t("Estimate")}
                    className="guests-cell-input budget-money-input"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => updateItem(item.id, { estimate: Math.max(0, Number(event.target.value) || 0) })}
                    type="number"
                    value={item.estimate}
                  />
                </span>
                <span className="budget-num" role="cell">
                  <span aria-hidden="true" className="budget-money-prefix">$</span>
                  <input
                    aria-label={t("Paid")}
                    className="guests-cell-input budget-money-input"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => updateItem(item.id, { paid: Math.max(0, Number(event.target.value) || 0) })}
                    type="number"
                    value={item.paid}
                  />
                </span>
                <span className="budget-num budget-left" data-due={left > 0 ? "true" : undefined} role="cell">
                  {formatCurrency(left)}
                </span>
                <span className="guests-cell-actions" role="cell">
                  <button
                    aria-label={t("Remove {name}", { name: item.label })}
                    className="guests-remove"
                    onClick={() => removeItem(item.id)}
                    title={t("Remove item")}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </span>
              </div>
            );
          })}
          {items.length === 0 ? <p className="guests-empty">{t("No budget items yet. Add your first cost.")}</p> : null}
        </div>
      </div>
    </StudioRouteFrame>
  );
}

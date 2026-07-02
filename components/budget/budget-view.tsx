"use client";

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { Donut } from "@/components/ui/donut";
import { useTranslation } from "@/lib/i18n";
import { BUDGET_CATEGORIES, useBudget } from "@/lib/use-budget";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function BudgetView() {
  const { t } = useTranslation();
  const { addItem, items, removeItem, setTarget, target, updateItem } = useBudget();

  const totals = useMemo(() => {
    const estimate = items.reduce((sum, item) => sum + (Number(item.estimate) || 0), 0);
    const paid = items.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
    return { estimate, paid, remaining: Math.max(0, estimate - paid) };
  }, [items]);

  const paidPercent = totals.estimate > 0 ? Math.min(100, Math.round((totals.paid / totals.estimate) * 100)) : 0;
  const overBudget = totals.estimate > target;

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

  return (
    <StudioRouteFrame
      description="Track every cost in one place — estimate each line, log what's paid, and always see what's left."
      eyebrow="Budget"
      meta={[
        { label: "Estimated", value: money.format(totals.estimate) },
        { label: "Paid", value: money.format(totals.paid) },
        { label: "Left to pay", value: money.format(totals.remaining) }
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
              <strong>{money.format(totals.estimate)}</strong>
            </div>
            <div>
              <span>{t("Paid so far")}</span>
              <strong>{money.format(totals.paid)}</strong>
            </div>
            <div data-tone={totals.remaining > 0 ? "due" : "clear"}>
              <span>{t("Left to pay")}</span>
              <strong>{money.format(totals.remaining)}</strong>
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
                ? t("{amount} over budget", { amount: money.format(totals.estimate - target) })
                : t("{amount} under budget", { amount: money.format(target - totals.estimate) })}
            </span>
          </div>
        </section>

        {byCategory.length > 0 ? (
          <section aria-label={t("Where it goes")} className="budget-breakdown">
            <h3>{t("Where it goes")}</h3>
            <div className="budget-breakdown-list">
              {byCategory.map((row) => (
                <div className="budget-breakdown-row" key={row.category}>
                  <span className="budget-breakdown-label">{t(row.category)}</span>
                  <span aria-hidden="true" className="budget-breakdown-bar">
                    <span style={{ width: `${row.pct}%` }} />
                  </span>
                  <span className="budget-breakdown-amount">
                    {money.format(row.amount)} · {row.pct}%
                  </span>
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
                  {money.format(left)}
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

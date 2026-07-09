"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useBudget } from "@/lib/use-budget";
import { useLocalProject } from "@/lib/use-local-project";
import { formatCurrency } from "@/lib/wedding-budget";

type CategoryRow = { allocated: number; category: string; spent: number };

export function BudgetSheet() {
  const { t } = useTranslation();
  const { items } = useBudget();
  const { wedding } = useLocalProject();

  // Aggregate the couple's own budget line items (the same store the Budget
  // page edits) into per-category rows so the exported sheet always mirrors
  // what they actually entered — never a separate hard-coded model.
  const { rows, spent, total } = useMemo(() => {
    const byCategory = new Map<string, CategoryRow>();
    for (const item of items) {
      const row = byCategory.get(item.category) ?? { allocated: 0, category: item.category, spent: 0 };
      row.allocated += item.estimate;
      row.spent += item.paid;
      byCategory.set(item.category, row);
    }
    const nextRows = Array.from(byCategory.values()).sort((a, b) => b.allocated - a.allocated);
    return {
      rows: nextRows,
      spent: nextRows.reduce((sum, row) => sum + row.spent, 0),
      total: nextRows.reduce((sum, row) => sum + row.allocated, 0)
    };
  }, [items]);

  return (
    <article className="export-sheet">
      <div className="summary-between">
        <div>
          <p className="eyebrow">{t("Budget Overview")}</p>
          <h3 className="card-title">{t("Wedding Budget")}</h3>
          <p className="card-copy">
            {wedding.coupleNames} · {wedding.date}
          </p>
        </div>
        <div className="export-contact">
          <span>{t("Total Budget")}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>

      <div className="budget-table-wrap">
        <table className="budget-table">
        <thead>
          <tr>
            <th scope="col">{t("Category")}</th>
            <th scope="col">{t("Allocated")}</th>
            <th scope="col">{t("Spent")}</th>
            <th scope="col">{t("Remaining")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <td>{t(row.category)}</td>
              <td>{formatCurrency(row.allocated)}</td>
              <td>{formatCurrency(row.spent)}</td>
              <td>{formatCurrency(row.allocated - row.spent)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("Total")}</td>
            <td>{formatCurrency(total)}</td>
            <td>{formatCurrency(spent)}</td>
            <td>{formatCurrency(total - spent)}</td>
          </tr>
        </tfoot>
        </table>
      </div>
    </article>
  );
}

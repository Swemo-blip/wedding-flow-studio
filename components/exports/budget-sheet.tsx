"use client";

import { useTranslation } from "@/lib/i18n";
import { budgetCategories, calculateBudgetSummary, formatCurrency } from "@/lib/wedding-budget";
import { sampleWedding } from "@/lib/wedding-data";

export function BudgetSheet() {
  const { t } = useTranslation();
  const summary = calculateBudgetSummary();

  return (
    <article className="export-sheet">
      <div className="summary-between">
        <div>
          <p className="eyebrow">{t("Budget Overview")}</p>
          <h3 className="card-title">{t("Wedding Budget")}</h3>
          <p className="card-copy">
            {sampleWedding.coupleNames} · {sampleWedding.date}
          </p>
        </div>
        <div className="export-contact">
          <span>{t("Total Budget")}</span>
          <strong>{formatCurrency(summary.total)}</strong>
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
          {budgetCategories.map((category) => (
            <tr key={category.id}>
              <td>{t(category.label)}</td>
              <td>{formatCurrency(category.allocated)}</td>
              <td>{formatCurrency(category.spent)}</td>
              <td>{formatCurrency(category.allocated - category.spent)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("Total")}</td>
            <td>{formatCurrency(summary.total)}</td>
            <td>{formatCurrency(summary.spent)}</td>
            <td>{formatCurrency(summary.remaining)}</td>
          </tr>
        </tfoot>
        </table>
      </div>
    </article>
  );
}

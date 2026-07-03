// Single source for the mock wedding budget. Amounts are in USD to match the
// Napa Valley sample wedding. Keep all budget mock data here, never scattered
// across components.

export type BudgetCategory = {
  id: string;
  label: string;
  allocated: number;
  spent: number;
};

export type BudgetSummary = {
  total: number;
  spent: number;
  remaining: number;
  spentPercent: number;
  categories: BudgetCategory[];
};

export const budgetCategories: BudgetCategory[] = [
  { id: "venue", label: "Venue & Rentals", allocated: 22000, spent: 15000 },
  { id: "catering", label: "Catering & Bar", allocated: 19500, spent: 12000 },
  { id: "photography", label: "Photography & Film", allocated: 9000, spent: 9000 },
  { id: "florals", label: "Florals & Decor", allocated: 8500, spent: 4200 },
  { id: "attire", label: "Attire & Beauty", allocated: 6500, spent: 2500 },
  { id: "music", label: "Music & Entertainment", allocated: 5500, spent: 2500 },
  { id: "coordination", label: "Planning & Coordination", allocated: 4500, spent: 0 },
  { id: "stationery", label: "Stationery & Favors", allocated: 3000, spent: 0 }
];

export function calculateBudgetSummary(categories: BudgetCategory[] = budgetCategories): BudgetSummary {
  const total = categories.reduce((sum, category) => sum + category.allocated, 0);
  const spent = categories.reduce((sum, category) => sum + category.spent, 0);
  const remaining = total - spent;
  const spentPercent = total > 0 ? Math.round((spent / total) * 100) : 0;

  return { total, spent, remaining, spentPercent, categories };
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount) || 0;

  return currencyFormatter.format(rounded);
}

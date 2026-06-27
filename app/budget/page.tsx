import type { Metadata } from "next";
import { BudgetView } from "@/components/budget/budget-view";

export const metadata: Metadata = {
  title: "Budget",
  description: "Track every wedding cost in one place — estimate each line, log what's paid, and always see what's left."
};

export default function BudgetPage() {
  return <BudgetView />;
}

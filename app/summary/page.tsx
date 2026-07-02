import type { Metadata } from "next";
import { SummaryView } from "@/components/summary/summary-view";

export const metadata: Metadata = {
  title: "Summary",
  description: "A one-page wedding overview — guests, budget, checklist and timeline — to print or share with your partner and vendors."
};

export default function SummaryPage() {
  return <SummaryView />;
}

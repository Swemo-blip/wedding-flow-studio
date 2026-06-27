import type { Metadata } from "next";
import { ChecklistView } from "@/components/checklist/checklist-view";

export const metadata: Metadata = {
  title: "Checklist",
  description: "Every task on the road to the wedding day — grouped by how far out, checked off as you go."
};

export default function ChecklistPage() {
  return <ChecklistView />;
}

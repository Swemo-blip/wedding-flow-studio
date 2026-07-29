import type { Metadata } from "next";
import { PrintSheets } from "@/components/print/print-sheets";

export const metadata: Metadata = {
  title: "Print",
  description: "Print place cards, a table plan and an order of service straight from your own guest list, seating, timeline and menu."
};

export default function PrintPage() {
  return <PrintSheets />;
}

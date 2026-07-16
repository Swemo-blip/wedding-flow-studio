import type { Metadata } from "next";
import { ExportStudio } from "@/components/exports/export-studio";

export const metadata: Metadata = {
  title: "Exports",
  description:
    "Turn your plan into clean, share-ready sheets — the day's schedule, seating, and a brief for each vendor and helper."
};

export default function ExportsPage() {
  return <ExportStudio />;
}

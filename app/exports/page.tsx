import type { Metadata } from "next";
import { ExportStudio } from "@/components/exports/export-studio";

export const metadata: Metadata = {
  title: "Exportable Run of Show",
  description:
    "Turn the wedding digital twin into focused run-of-show, cue sheet, vendor brief, seating, ceremony, catering, and venue setup previews."
};

export default function ExportsPage() {
  return (
    <div className="page-grid">
      <ExportStudio />
    </div>
  );
}

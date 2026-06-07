import type { Metadata } from "next";
import { ReceptionStudio } from "@/components/reception/reception-studio";

export const metadata: Metadata = {
  title: "Reception and Seating",
  description:
    "Map the reception room, tables, guest notes, meal constraints, accessibility flow, service path, cake table, bar, dance floor, and seating risks."
};

export default function ReceptionPage() {
  return (
    <div className="page-grid">
      <ReceptionStudio />
    </div>
  );
}

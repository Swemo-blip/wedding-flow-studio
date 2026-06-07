import type { Metadata } from "next";
import { VendorSourcingStudio } from "@/components/vendors/vendor-sourcing-studio";

export const metadata: Metadata = {
  title: "Production Sourcing",
  description:
    "Find, shortlist, compare, and track wedding vendor candidates for catering, music, rentals, transport, guest support, and production services."
};

export default function VendorsPage() {
  return (
    <div className="page-grid">
      <VendorSourcingStudio />
    </div>
  );
}

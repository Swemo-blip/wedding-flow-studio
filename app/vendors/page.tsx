import type { Metadata } from "next";
import { VendorSourcingStudio } from "@/components/vendors/vendor-sourcing-studio";

export const metadata: Metadata = {
  title: "Vendors",
  description: "Turn each party need into a local search, save the best candidates, and track quotes and bookings in one place."
};

export default function VendorsPage() {
  return <VendorSourcingStudio />;
}

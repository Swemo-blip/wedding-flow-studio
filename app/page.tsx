import type { Metadata } from "next";
import Link from "next/link";
import { WeddingStudio } from "@/components/wedding-studio/wedding-studio";

export const metadata: Metadata = {
  title: {
    absolute: "Wedding Studio | Wedding Flow Studio"
  },
  description:
    "Design the wedding-day digital twin through one focused 3D planning studio, then move into role briefs, timeline repair, vendor sourcing, and exports when needed."
};

const intelligenceLinks = [
  {
    href: "/preview",
    label: "Preview Wedding Day",
    meta: "Walk the day in sequence"
  },
  {
    href: "/day-flow",
    label: "Repair Day Flow",
    meta: "Fix timing and cue risks"
  },
  {
    href: "/director",
    label: "Director Mode",
    meta: "Role-specific production boards"
  },
  {
    href: "/vendors",
    label: "Vendor Intelligence",
    meta: "Source and compare real services"
  },
  {
    href: "/exports",
    label: "Export Briefs",
    meta: "Create run-of-show handoffs"
  }
];

export default function OverviewPage() {
  return (
    <div className="page-grid">
      <WeddingStudio />

      <details className="studio-intelligence-drawer">
        <summary>
          <span>Production Intelligence</span>
          <small>Open advanced planning layers when the studio needs deeper detail.</small>
        </summary>

        <div className="studio-intelligence-links" aria-label="Advanced production layers">
          {intelligenceLinks.map((item) => (
            <Link href={item.href} key={item.href}>
              <span>{item.label}</span>
              <small>{item.meta}</small>
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

import Link from "next/link";

const planningToolkits = [
  {
    href: "/reception",
    label: "Guest Intelligence",
    summary: "Meal notes, allergies, family groups, and seating context stay connected to the floor plan.",
    status: "Live"
  },
  {
    href: "/",
    label: "Floor Plan Editing",
    summary: "Move ceremony and reception objects directly in the 3D studio, then refine with precise nudges.",
    status: "Live"
  },
  {
    href: "/vendors",
    label: "Vendor Fit",
    summary: "Source categories by location and attach real-world services to the wedding-day digital twin.",
    status: "Live"
  },
  {
    href: "/exports",
    label: "Export Settings",
    summary: "Turn the plan into role-specific briefs so each vendor sees only what they need.",
    status: "Live"
  }
];

export function StudioToolkit() {
  return (
    <details className="studio-toolkit-panel" aria-label="Connected planning toolkit">
      <summary className="studio-toolkit-heading">
        <span>Connected Toolkit</span>
        <strong>Open linked planning layers</strong>
      </summary>

      <div className="studio-toolkit-grid">
        {planningToolkits.map((toolkit) => (
          <Link className="studio-toolkit-item" href={toolkit.href} key={toolkit.label}>
            <span>{toolkit.status}</span>
            <strong>{toolkit.label}</strong>
            <small>{toolkit.summary}</small>
          </Link>
        ))}
      </div>
    </details>
  );
}

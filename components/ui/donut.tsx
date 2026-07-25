import type { ReactNode } from "react";

// Small progress ring with a value in the center. Shared by the Overview,
// Ceremony and Reception summary rails. Styling lives in `.studio-donut`.
export function Donut({ children, percent, tone }: { children: ReactNode; percent: number; tone: "sage" | "gold" }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  // Draw from the locked tokens rather than near-miss copies. The ring used to be
  // #6f8a5e / #c9a25c with a bronze track from the previous light-gallery theme
  // (rgba(146,118,73,…) instead of the current --line rgba(120,106,74,…)).
  const stroke = tone === "sage" ? "var(--accent)" : "var(--gilt)";

  return (
    <div className="studio-donut">
      <svg aria-hidden="true" viewBox="0 0 84 84">
        <circle cx="42" cy="42" fill="none" r={radius} stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          fill="none"
          r={radius}
          stroke={stroke}
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="7"
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="studio-donut-center">{children}</div>
    </div>
  );
}

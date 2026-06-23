import type { ReactNode } from "react";

// Small progress ring with a value in the center. Shared by the Overview,
// Ceremony and Reception summary rails. Styling lives in `.studio-donut`.
export function Donut({ children, percent, tone }: { children: ReactNode; percent: number; tone: "sage" | "gold" }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = tone === "sage" ? "#6f8a5e" : "#c9a25c";

  return (
    <div className="studio-donut">
      <svg aria-hidden="true" viewBox="0 0 84 84">
        <circle cx="42" cy="42" fill="none" r={radius} stroke="rgba(146, 118, 73, 0.16)" strokeWidth="7" />
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

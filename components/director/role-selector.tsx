"use client";

import type { RoleBrief } from "@/lib/wedding-types";

type RoleSelectorProps = {
  activeRole: string;
  briefs: RoleBrief[];
  onChange: (role: string) => void;
};

export function RoleSelector({ activeRole, briefs, onChange }: RoleSelectorProps) {
  const activeBrief = briefs.find((brief) => brief.role === activeRole) ?? briefs[0];

  return (
    <section className="director-role-picker" aria-label="Director role selector">
      <div>
        <p className="eyebrow">Role View</p>
        <h2>{activeBrief.title}</h2>
      </div>
      <label className="field director-role-select">
        <span>Director view</span>
        <select aria-label="Choose Director Mode role" onChange={(event) => onChange(event.target.value)} value={activeRole}>
          {briefs.map((brief) => (
            <option key={brief.role} value={brief.role}>
              {brief.title}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

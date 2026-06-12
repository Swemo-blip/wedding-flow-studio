"use client";

import type { RoleBrief } from "@/lib/wedding-types";

type RoleSelectorProps = {
  activeRole: string;
  briefs: RoleBrief[];
  onChange: (role: string) => void;
};

export function RoleSelector({ activeRole, briefs, onChange }: RoleSelectorProps) {
  return (
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
  );
}

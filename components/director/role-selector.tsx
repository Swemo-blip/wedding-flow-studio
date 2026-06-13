"use client";

import { useTranslation } from "@/lib/i18n";
import type { RoleBrief } from "@/lib/wedding-types";

type RoleSelectorProps = {
  activeRole: string;
  briefs: RoleBrief[];
  onChange: (role: string) => void;
};

export function RoleSelector({ activeRole, briefs, onChange }: RoleSelectorProps) {
  const { t } = useTranslation();

  return (
    <label className="field director-role-select">
      <span>{t("Director view")}</span>
      <select aria-label={t("Choose Director Mode role")} onChange={(event) => onChange(event.target.value)} value={activeRole}>
        {briefs.map((brief) => (
          <option key={brief.role} value={brief.role}>
            {brief.title}
          </option>
        ))}
      </select>
    </label>
  );
}

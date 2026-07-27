"use client";

import { useTranslation } from "@/lib/i18n";

type RoleSelectorProps = {
  activeRole: string;
  onChange: (role: string) => void;
  // Only the roles this plan actually has, in the order the boards were derived.
  roles: Array<{ role: string; title: string }>;
};

export function RoleSelector({ activeRole, onChange, roles }: RoleSelectorProps) {
  const { t } = useTranslation();

  return (
    <label className="field director-role-select">
      <span>{t("Director view")}</span>
      <select aria-label={t("Choose Director Mode role")} onChange={(event) => onChange(event.target.value)} value={activeRole}>
        {roles.map((role) => (
          <option key={role.role} value={role.role}>
            {role.title}
          </option>
        ))}
      </select>
    </label>
  );
}

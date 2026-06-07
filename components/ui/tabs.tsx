"use client";

import type { ReactNode } from "react";

type TabOption = {
  id: string;
  label: string;
};

type TabsProps = {
  activeId: string;
  ariaLabel: string;
  children?: ReactNode;
  onChange: (id: string) => void;
  options: TabOption[];
};

export function Tabs({ activeId, ariaLabel, children, onChange, options }: TabsProps) {
  return (
    <div>
      <div aria-label={ariaLabel} className="tabs" role="tablist">
        {options.map((option) => (
          <button
            aria-selected={activeId === option.id}
            className="tab-button"
            data-active={activeId === option.id}
            key={option.id}
            onClick={() => onChange(option.id)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

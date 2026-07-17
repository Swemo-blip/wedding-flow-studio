"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";

// A calm, honest banner so a couple always knows whether they're looking at the
// sample wedding or their own. Shown only while there's no local project, and
// never on the intake flow (where they're busy creating theirs).
export function SampleRibbon() {
  const { hasLocalProject } = useLocalProject();
  const pathname = usePathname();
  const { t } = useTranslation();

  if (hasLocalProject || pathname?.startsWith("/intake")) {
    return null;
  }

  return (
    <div className="sample-ribbon" role="status">
      <span className="sample-ribbon-text">
        <Sparkles aria-hidden="true" size={15} strokeWidth={1.8} />
        {t("You're exploring a sample wedding — create yours to make everything your own.")}
      </span>
      <Link className="sample-ribbon-cta" href="/intake">
        {t("Create your wedding")}
      </Link>
    </div>
  );
}

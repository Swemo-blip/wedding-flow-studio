"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readStoredRiskResolutions,
  resolveStoredRisk,
  type StoredRiskResolution
} from "@/lib/local-project-store";
import type { RiskItem } from "@/lib/wedding-types";

export function useRiskResolutions() {
  const [resolutions, setResolutions] = useState<StoredRiskResolution[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setResolutions(readStoredRiskResolutions());
    });
  }, []);

  const resolvedRiskIds = useMemo(
    () => resolutions.map((resolution) => resolution.riskId),
    [resolutions]
  );

  function resolveRisk(riskId: string) {
    setResolutions(resolveStoredRisk(riskId));
  }

  return {
    resolvedRiskIds,
    resolveRisk,
    resolutions
  };
}

export function filterResolvedRisks(risks: RiskItem[], resolvedRiskIds: string[]) {
  const resolvedRiskSet = new Set(resolvedRiskIds);

  return risks.filter((risk) => !resolvedRiskSet.has(risk.id));
}

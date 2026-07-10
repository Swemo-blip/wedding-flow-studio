"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { Donut } from "@/components/ui/donut";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { CHECKLIST_PHASES, useChecklist } from "@/lib/use-checklist";

// Roughly how far before the wedding each phase should be wrapped up.
const PHASE_OFFSET_DAYS: Record<string, number> = {
  "12+ months": 365,
  "9 months": 274,
  "6 months": 183,
  "3 months": 91,
  "1 month": 30,
  "Final week": 7,
  "Day of": 0
};

export function ChecklistView() {
  const { t } = useTranslation();
  const { addTask, removeTask, tasks, toggleTask, updateTask } = useChecklist();
  const { wedding } = useLocalProject();
  const [hideDone, setHideDone] = useState(false);
  // "Today" is read after mount so the overdue/soon flags don't cause a
  // server/client hydration mismatch.
  const [todayMs, setTodayMs] = useState<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => setTodayMs(Date.now()));
  }, []);

  function phaseTarget(phase: string): Date | null {
    const weddingDate = new Date(wedding.date);
    if (Number.isNaN(weddingDate.getTime())) {
      return null;
    }
    return new Date(weddingDate.getTime() - (PHASE_OFFSET_DAYS[phase] ?? 0) * 86400000);
  }

  const counts = useMemo(() => {
    const done = tasks.filter((task) => task.done).length;
    return { done, total: tasks.length, open: tasks.length - done };
  }, [tasks]);

  const percent = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  // Group tasks by phase, preserving the canonical phase order; any custom phase
  // falls to the end.
  const grouped = useMemo(() => {
    const order = new Map(CHECKLIST_PHASES.map((phase, index) => [phase, index]));
    const byPhase = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const list = byPhase.get(task.phase) ?? [];
      list.push(task);
      byPhase.set(task.phase, list);
    }
    return Array.from(byPhase.entries()).sort(
      (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99)
    );
  }, [tasks]);

  return (
    <StudioRouteFrame
      eyebrow="Checklist"
      primaryAction={{ href: "/day-flow", label: "Open timeline" }}
      title="The road to the day."
    >
      <div className="checklist-screen">
        <section className="budget-summary" aria-label={t("Progress")}>
          <div className="budget-summary-donut">
            <Donut percent={percent} tone={percent >= 100 ? "sage" : "gold"}>
              <strong>{percent}%</strong>
              <span>{t("done")}</span>
            </Donut>
          </div>
          <div className="budget-summary-stats">
            <div>
              <span>{t("Done")}</span>
              <strong>{counts.done}</strong>
            </div>
            <div data-tone={counts.open > 0 ? "due" : "clear"}>
              <span>{t("Still to do")}</span>
              <strong>{counts.open}</strong>
            </div>
            <div>
              <span>{t("Total tasks")}</span>
              <strong>{counts.total}</strong>
            </div>
          </div>
          <label className="checklist-hide">
            <input checked={hideDone} onChange={() => setHideDone((value) => !value)} type="checkbox" />
            {t("Hide completed")}
          </label>
        </section>

        <div className="checklist-phases">
          {grouped.map(([phase, phaseTasks]) => {
            const visible = hideDone ? phaseTasks.filter((task) => !task.done) : phaseTasks;
            const phaseDone = phaseTasks.filter((task) => task.done).length;
            if (hideDone && visible.length === 0) {
              return null;
            }
            const allDone = phaseDone === phaseTasks.length;
            const target = phaseTarget(phase);
            let dateStatus: "overdue" | "soon" | "upcoming" | "done" = allDone ? "done" : "upcoming";
            if (!allDone && target && todayMs !== null) {
              const diff = target.getTime() - todayMs;
              if (diff < 0) {
                dateStatus = "overdue";
              } else if (diff < 30 * 86400000) {
                dateStatus = "soon";
              }
            }
            const dateLabel = target ? target.toLocaleDateString("en", { month: "short", year: "numeric" }) : null;
            return (
              <section className="checklist-phase" key={phase}>
                <div className="checklist-phase-head">
                  <h2>{t(phase)}</h2>
                  <div className="checklist-phase-meta">
                    {dateLabel ? (
                      <span className="checklist-phase-date" data-status={dateStatus}>
                        {dateStatus === "overdue"
                          ? `${t("Overdue")} · ${dateLabel}`
                          : dateStatus === "soon"
                            ? `${t("Soon")} · ${dateLabel}`
                            : dateLabel}
                      </span>
                    ) : null}
                    <span className="checklist-phase-count">
                      {phaseDone}/{phaseTasks.length}
                    </span>
                  </div>
                </div>
                <ul className="checklist-tasks">
                  {visible.map((task) => (
                    <li className="checklist-task" data-done={task.done ? "true" : undefined} key={task.id}>
                      <label className="checklist-check">
                        <input checked={task.done} onChange={() => toggleTask(task.id)} type="checkbox" />
                        <span aria-hidden="true" className="checklist-check-box" />
                      </label>
                      <input
                        aria-label={t("Task")}
                        className="guests-cell-input checklist-task-input"
                        onChange={(event) => updateTask(task.id, event.target.value)}
                        value={task.title}
                      />
                      <button
                        aria-label={t("Remove task")}
                        className="guests-remove"
                        onClick={() => removeTask(task.id)}
                        title={t("Remove task")}
                        type="button"
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="checklist-add" onClick={() => addTask(phase)} type="button">
                  <Plus aria-hidden="true" size={14} />
                  {t("Add task")}
                </button>
              </section>
            );
          })}
        </div>
      </div>
    </StudioRouteFrame>
  );
}

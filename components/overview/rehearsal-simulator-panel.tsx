import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RehearsalScenario, RehearsalSimulation } from "@/lib/rehearsal-simulator";

type RehearsalSimulatorPanelProps = {
  hasRun: boolean;
  onRun: () => void;
  onScenarioChange: (scenarioId: string) => void;
  scenarios: RehearsalScenario[];
  selectedScenarioId: string;
  simulation: RehearsalSimulation;
};

export function RehearsalSimulatorPanel({
  hasRun,
  onRun,
  onScenarioChange,
  scenarios,
  selectedScenarioId,
  simulation
}: RehearsalSimulatorPanelProps) {
  return (
    <section className="rehearsal-simulator-panel" aria-label="Rehearsal Simulator">
      <div className="rehearsal-simulator-header">
        <div>
          <p className="eyebrow">Rehearsal Simulator</p>
          <h3>{simulation.headline}</h3>
          <p>{simulation.summary}</p>
        </div>
        <Badge tone={simulation.outcomeTone}>{simulation.dayFeelLabel}</Badge>
      </div>

      <div className="rehearsal-control-row">
        <label className="rehearsal-scenario-field">
          <span>Scenario</span>
          <select
            aria-label="Choose rehearsal simulation scenario"
            onChange={(event) => onScenarioChange(event.target.value)}
            value={selectedScenarioId}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.title}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={onRun} size="small">
          Run Rehearsal Simulation
        </Button>
      </div>

      <div className="rehearsal-score-strip">
        <div>
          <span>Day Feel</span>
          <strong>{simulation.dayFeelScore}%</strong>
        </div>
        <div>
          <span>Delay Pressure</span>
          <strong>{simulation.delayPropagationMinutes} min</strong>
        </div>
        <div>
          <span>Risk Delta</span>
          <strong>
            {simulation.riskDelta.before}
            {" -> "}
            {simulation.riskDelta.after}
          </strong>
        </div>
      </div>

      <div className="rehearsal-recovery-card" data-run={hasRun}>
        <span>{hasRun ? "Recovery plan" : "Simulation ready"}</span>
        <strong>{simulation.recoveryWindow}</strong>
        <ol>
          {simulation.recoveryPlan.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="rehearsal-impact-grid">
        <ImpactColumn title="Timeline Impact" items={simulation.timelineImpact} />
        <ImpactColumn title="Role Load" items={simulation.roleLoad} />
        <ImpactColumn title="Brief Impact" items={simulation.briefImpact} />
      </div>

      <div className="rehearsal-signal-row">
        <SignalCard item={simulation.cueConfidence} />
        <SignalCard item={simulation.guestJourneyImpact} />
      </div>

      <div className="rehearsal-downstream">
        <span>Downstream effects</span>
        <ul>
          {simulation.downstreamEffects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ImpactColumn({ items, title }: { items: RehearsalSimulation["timelineImpact"]; title: string }) {
  return (
    <div className="rehearsal-impact-column">
      <span>{title}</span>
      {items.map((item) => (
        <article key={`${title}-${item.label}-${item.before}`}>
          <div className="summary-between">
            <strong>{item.label}</strong>
            <Badge tone={item.tone}>{item.tone === "confirmed" ? "clear" : item.tone}</Badge>
          </div>
          <p>
            <small>Before</small>
            {item.before}
          </p>
          <p>
            <small>After</small>
            {item.after}
          </p>
        </article>
      ))}
    </div>
  );
}

function SignalCard({ item }: { item: RehearsalSimulation["cueConfidence"] }) {
  return (
    <article className="rehearsal-signal-card">
      <div className="summary-between">
        <strong>{item.label}</strong>
        <Badge tone={item.tone}>{item.tone === "confirmed" ? "stable" : item.tone}</Badge>
      </div>
      <p>
        <small>Before</small>
        {item.before}
      </p>
      <p>
        <small>After</small>
        {item.after}
      </p>
    </article>
  );
}

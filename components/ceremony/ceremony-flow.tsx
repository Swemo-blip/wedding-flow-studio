import { Badge } from "@/components/ui/badge";
import { musicCues } from "@/lib/wedding-data";

const ceremonyMoments = [
  "Prelude",
  "Wedding party entrance",
  "Couple entrance",
  "Welcome",
  "Readings",
  "Vows",
  "Ring exchange",
  "Solo performance",
  "Pronouncement",
  "Recessional"
];

export function CeremonyFlow() {
  return (
    <div>
      <h3 className="card-title">Ceremony Flow</h3>
      <ol className="ceremony-flow">
        {ceremonyMoments.map((moment, index) => {
          const cue = musicCues.find((musicCue) => musicCue.moment.toLowerCase().includes(moment.toLowerCase().split(" ")[0]));

          return (
            <li key={moment}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{moment}</strong>
                {cue ? <Badge tone={cue.status === "confirmed" ? "confirmed" : "medium"}>{cue.songTitle}</Badge> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

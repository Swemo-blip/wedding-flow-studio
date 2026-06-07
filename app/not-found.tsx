import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="route-state" aria-label="Page not found">
      <div>
        <p className="eyebrow">Studio Map</p>
        <h2>This part of the wedding flow is not in the studio yet.</h2>
        <p>Return to the main digital twin and continue from the guided Studio Workflow.</p>
        <Button href="/">Open Studio</Button>
      </div>
    </section>
  );
}

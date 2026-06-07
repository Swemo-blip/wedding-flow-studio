"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <section className="route-state" aria-label="Studio error">
      <div>
        <p className="eyebrow">Studio Recovery</p>
        <h2>The digital twin needs a quick reset.</h2>
        <p>The current view could not finish rendering. Reset the studio view and continue from the same wedding project.</p>
        <Button onClick={reset}>Reset Studio View</Button>
      </div>
    </section>
  );
}

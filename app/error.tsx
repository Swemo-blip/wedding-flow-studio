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
    <section className="route-state" aria-label="Something went wrong">
      <div>
        <p className="eyebrow">A small hiccup</p>
        <h2>This page didn’t quite load.</h2>
        <p>Something interrupted this view. Try again and you’ll pick up right where you left off — your wedding plan is safe.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}

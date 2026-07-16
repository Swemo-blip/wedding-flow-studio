import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="route-state" aria-label="Page not found">
      <div>
        <p className="eyebrow">Page not found</p>
        <h2>We couldn’t find that page.</h2>
        <p>The page you’re looking for isn’t here. Head back to your studio and keep planning the day.</p>
        <Button href="/">Back to your studio</Button>
      </div>
    </section>
  );
}

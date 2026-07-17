export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function percent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

// The wedding date is stored ISO (YYYY-MM-DD, from a real date picker). Parse it
// as a LOCAL date (not UTC midnight, which can render as the day before), and
// tolerate any legacy free-text value by returning it unchanged.
export function parseWeddingDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const date = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// One place to turn a stored wedding date into a warm, readable label
// ("June 14, 2027"). Falls back to the raw value if it can't be parsed.
export function formatWeddingDate(value: string): string {
  const date = parseWeddingDate(value);
  if (!date) {
    return value;
  }
  return date.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
}

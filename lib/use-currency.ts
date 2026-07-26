"use client";

import { useCallback, useSyncExternalStore } from "react";
import { safeSetItem } from "@/lib/persistence-status";

// Every amount in the app used to render as US dollars, from a formatter
// hardcoded to `en-US`/`USD` plus three literal "$" input adornments — in a
// product that ships a Swedish translation and a Swedish/English toggle. For the
// couple who would actually pay for this, budgeting their wedding in dollars is an
// immediate "this isn't for me".
//
// Currency is deliberately NOT derived from the language toggle: a Swedish couple
// may well use the English interface and still budget in kronor, and the reverse
// happens too. Money and language are separate choices.
export const CURRENCY_KEY = "wedding-flow-studio.currency.v1";

// A small, explicit list rather than every ISO code — this is a wedding planner,
// not a trading terminal, and a short list keeps the control quiet.
export const supportedCurrencies = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"] as const;
export type SupportedCurrency = (typeof supportedCurrencies)[number];

// The product is Swedish-built and Swedish-first, so kronor is the honest default.
// It is only a starting value: the couple's own choice always wins, and switching
// changes the symbol only — amounts are stored as plain numbers and never converted.
export const defaultCurrency: SupportedCurrency = "SEK";

// The locale that formats each currency, so 45 000 kr groups the way a Swedish
// reader expects rather than as 45,000.
const currencyLocales: Record<SupportedCurrency, string> = {
  SEK: "sv-SE",
  EUR: "de-DE",
  USD: "en-US",
  GBP: "en-GB",
  NOK: "nb-NO",
  DKK: "da-DK"
};

export function getCurrencyLocale(currency: SupportedCurrency): string {
  return currencyLocales[currency] ?? "en-US";
}

function isSupportedCurrency(value: string | null): value is SupportedCurrency {
  return value !== null && supportedCurrencies.includes(value as SupportedCurrency);
}

export function readStoredCurrency(): SupportedCurrency {
  if (typeof window === "undefined") {
    return defaultCurrency;
  }
  const raw = window.localStorage.getItem(CURRENCY_KEY);
  return isSupportedCurrency(raw) ? raw : defaultCurrency;
}

export function clearStoredCurrency() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CURRENCY_KEY);
  cachedCurrency = null;
  for (const listener of listeners) {
    listener();
  }
}

// Read through useSyncExternalStore rather than an effect: it is the right tool for
// external state like localStorage, it gives the server render an explicit
// snapshot (so no hydration mismatch), and it keeps every mounted surface on the
// same currency — switching on /budget updates the summary and the exports too.
const listeners = new Set<() => void>();
let cachedCurrency: SupportedCurrency | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SupportedCurrency {
  cachedCurrency ??= readStoredCurrency();
  return cachedCurrency;
}

function getServerSnapshot(): SupportedCurrency {
  return defaultCurrency;
}

export function useCurrency() {
  const currency = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCurrency = useCallback((next: SupportedCurrency) => {
    cachedCurrency = next;
    safeSetItem(CURRENCY_KEY, next);
    for (const listener of listeners) {
      listener();
    }
  }, []);

  return { currency, setCurrency };
}

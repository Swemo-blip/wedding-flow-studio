"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "sv";

const STORAGE_KEY = "wfs-language";

// English source string -> Swedish translation. Missing keys fall back to the
// English source, so the app is always readable while translation expands.
const sv: Record<string, string> = {
  // Shell + navigation
  "Overview": "Översikt",
  "Preview Day": "Förhandsvisa dagen",
  "Ceremony": "Vigsel",
  "Reception": "Mottagning",
  "Timeline": "Tidslinje",
  "Music": "Musik",
  "Speeches": "Tal",
  "Director": "Regissör",
  "Vendors": "Leverantörer",
  "Exports": "Export",
  "New Project": "Nytt projekt",
  "Wedding Flow Studio": "Wedding Flow Studio",
  "Digital Twin Active": "Digital tvilling aktiv",
  "All changes update your 3D preview.": "Alla ändringar uppdaterar din 3D-förhandsvisning.",
  "View Walkthrough": "Se genomgång",
  "Planner": "Planerare",
  "Planning sections": "Planeringsavsnitt",
  // Header
  "Your Wedding Studio": "Din bröllopsstudio",
  "Preview your wedding day before it unfolds": "Förhandsvisa er bröllopsdag innan den utspelar sig",
  "All changes saved": "Alla ändringar sparade",
  "Sample wedding": "Exempelbröllop",
  "Share Studio": "Dela studio",
  "Link copied": "Länk kopierad",
  "Copy the address bar link": "Kopiera länken i adressfältet",
  // Welcome
  "You are viewing a sample wedding.": "Du tittar på ett exempelbröllop.",
  "Explore freely — then create your own in about two minutes.": "Utforska fritt — skapa sedan ert eget på cirka två minuter.",
  "Create your wedding": "Skapa ert bröllop",
  "Dismiss welcome message": "Stäng välkomstmeddelandet",
  // Venue hero
  "3D Venue Preview": "3D-förhandsvisning av lokal",
  "Choose preview scene": "Välj förhandsvisningsscen",
  "Ceremony – {venue}": "Vigsel – {venue}",
  "Reception – {venue}": "Mottagning – {venue}",
  "Choose 2D or 3D view": "Välj 2D- eller 3D-vy",
  "Switch to golden-hour lighting": "Byt till skymningsljus",
  "Switch to daylight": "Byt till dagsljus",
  "Toggle fullscreen preview": "Växla helskärm",
  "Zoom controls": "Zoomkontroller",
  "Zoom out": "Zooma ut",
  "Zoom in": "Zooma in",
  "Edit in 3D Studio": "Redigera i 3D-studion",
  "Close 3D Studio": "Stäng 3D-studion",
  "Preparing your venue…": "Förbereder er lokal…",
  // Style studio (scene editor)
  "Style Studio": "Stilstudio",
  "Close style studio": "Stäng stilstudion",
  "Venue": "Lokal",
  "Choose venue type": "Välj lokaltyp",
  "Style": "Stil",
  "Choose wedding style": "Välj bröllopsstil",
  "Color direction": "Färgriktning",
  "Choose color direction": "Välj färgriktning",
  "Decor level": "Dekornivå",
  "Choose decor level": "Välj dekornivå",
  "Guests": "Gäster",
  "Guest count": "Antal gäster",
  "Accessible seats": "Tillgänglighetsplatser",
  // Venue / style / decor option labels
  "Church": "Kyrka",
  "Garden": "Trädgård",
  "Beach": "Strand",
  "Hall": "Festlokal",
  "Classic": "Klassisk",
  "Modern": "Modern",
  "Romantic": "Romantisk",
  "Rustic": "Rustik",
  "Essential": "Enkel",
  "Elevated": "Förhöjd",
  "Signature": "Signatur",
  // Overview glance cards
  "Timeline at a Glance": "Tidslinjen i korthet",
  "View Full Timeline": "Se hela tidslinjen",
  "Guest Count": "Antal gäster",
  "Expected": "Förväntat",
  "Manage Guests": "Hantera gäster",
  "Seating Overview": "Placeringsöversikt",
  "Open Seating Plan": "Öppna placeringsplan",
  "Style & Design": "Stil & design",
  "Open Style Studio": "Öppna stilstudion",
  // Overview rail
  "Wedding Overview": "Bröllopsöversikt",
  "Edit": "Redigera",
  "Date": "Datum",
  "invited": "inbjudna",
  "seats": "platser",
  "Theme Colors": "Temafärger",
  "Start over with a new project": "Börja om med ett nytt projekt",
  "Plan Readiness": "Planens status",
  "On Track": "På rätt spår",
  "In Review": "Under granskning",
  "Ready moments": "Klara moment",
  "Needs review": "Behöver granskas",
  "Needs attention": "Behöver åtgärdas",
  "View Timeline": "Se tidslinje",
  "Cue Sheet": "Cue-lista",
  "Confirmed cues": "Bekräftade cues",
  "View Cue Sheet": "Se cue-lista",
  "Everything autosaves locally on this device.": "Allt sparas automatiskt lokalt på den här enheten.",
  // Language toggle
  "Language": "Språk",
  "English": "English",
  "Svenska": "Svenska"
};

const dictionaries: Record<Language, Record<string, string>> = { en: {}, sv };

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "sv" || stored === "en") {
        setLanguageState(stored);
        document.documentElement.lang = stored;
      }
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (source: string) => dictionaries[language][source] ?? source,
    [language]
  );

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);

  if (!context) {
    return { language: "en" as Language, setLanguage: () => {}, t: (source: string) => source };
  }

  return context;
}

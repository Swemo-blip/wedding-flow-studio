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
  "Svenska": "Svenska",
  // Route headers — eyebrows
  "Brief Builder": "Brief-byggare",
  "Ceremony Studio": "Vigselstudio",
  "Day Flow Studio": "Dagsflödesstudio",
  "Director Mode": "Regissörsläge",
  "Music Cue Studio": "Musik-cue-studio",
  "Preview Wedding Day": "Förhandsvisa bröllopsdagen",
  "Print Preview": "Utskriftsförhandsvisning",
  "Production Sourcing": "Produktionsupphandling",
  "Reception Digital Twin": "Mottagningens digitala tvilling",
  "Speech Studio": "Talstudio",
  "Secret Layers": "Hemliga lager",
  "Timeline Repair": "Tidslinjereparation",
  "Vendor Fit": "Leverantörspassning",
  "Cue Control": "Cue-kontroll",
  "Role-Ready View": "Rollklar vy",
  "Seating Logic": "Placeringslogik",
  "Ceremony Plan": "Vigselplan",
  "Day Sequence": "Dagsföljd",
  "Project Composer": "Projektskapare",
  // Route headers — titles
  "Build the ceremony around what guests will see.": "Bygg vigseln kring det gästerna ser.",
  "Ceremony scene": "Vigselscen",
  "Coordinate the soundtrack as one cue sheet.": "Samordna musiken som en enda cue-lista.",
  "Design the room around the guest journey.": "Forma rummet kring gästernas resa.",
  "Find, shortlist, and compare the real-world services behind the wedding flow.": "Hitta, gallra och jämför tjänsterna bakom bröllopsflödet.",
  "Give every role exactly what they need.": "Ge varje roll exakt det de behöver.",
  "Guest Journey Readiness": "Gästresans status",
  "Music Readiness": "Musikens status",
  "Reception room scene": "Mottagningsscen",
  "Repair the wedding day from one selected moment.": "Justera bröllopsdagen utifrån ett valt moment.",
  "Run the wedding day by role.": "Driv bröllopsdagen roll för roll.",
  "See the day before it unfolds.": "Se dagen innan den utspelar sig.",
  "Shape the program without exposing surprises too early.": "Forma programmet utan att avslöja överraskningar för tidigt.",
  "Speech Readiness": "Talens status",
  "Turn the plan into one clear brief at a time.": "Förvandla planen till en tydlig brief i taget.",
  // Primary actions
  "Open Director Mode": "Öppna regissörsläge",
  "Repair Flow": "Åtgärda flödet",
  "Export Brief": "Exportera brief",
  "Prepare Brief": "Förbered brief",
  "Prepare Vendor Brief": "Förbered leverantörsbrief",
  "Preview Ceremony": "Förhandsvisa vigsel",
  "Preview Cues": "Förhandsvisa cues",
  "Open 3D Studio": "Öppna 3D-studion",
  "Open Cue Sheet": "Öppna cue-lista",
  "Reset music cues": "Återställ musik-cues",
  "Reset timeline": "Återställ tidslinje",
  "Reset speeches": "Återställ tal",
  "Export Seating Plan": "Exportera placeringsplan",
  "Export Seating": "Exportera placering",
  "Export Cue Sheet": "Exportera cue-lista",
  "Export Role Briefs": "Exportera rollbriefer",
  "Prepare Run of Show": "Förbered körschema",
  "Preview Again": "Förhandsvisa igen",
  "Brief Toastmaster": "Briefa toastmaster",
  "Focus Decision": "Fokusera beslut",
  "Apply Best Fix": "Tillämpa bästa åtgärd",
  "Apply Action": "Tillämpa åtgärd",
  "Open Studio": "Öppna studion",
  "Repair Active Moment": "Åtgärda aktivt moment",
  "Find risks before they become problems": "Hitta risker innan de blir problem",
  "Flow Analysis": "Flödesanalys",
  // Risk severities
  "low": "låg",
  "medium": "medel",
  "high": "hög",
  // Risk titles
  "Group photos may need more time.": "Gruppfotona kan behöva mer tid.",
  "A music cue is missing a backup plan.": "En musik-cue saknar reservplan.",
  "A music cue needs an exact start cue.": "En musik-cue behöver en exakt startsignal.",
  "A ceremony music cue still needs confirmation.": "En vigselmusik-cue behöver fortfarande bekräftas.",
  "Speech timing may make the reception feel long.": "Talens tider kan få mottagningen att kännas lång.",
  "Catering needs final allergy details.": "Cateringen behöver slutgiltiga allergiuppgifter.",
  "Meal preferences need final confirmation.": "Måltidsönskemål behöver slutbekräftas.",
  "Child meals need setup notes.": "Barnmåltider behöver upplägg.",
  "Review accessibility seating and guest flow.": "Se över tillgänglighetsplatser och gästflöde.",
  "Seating conflict detected.": "Placeringskonflikt upptäckt.",
  "Secret item requires vendor coordination.": "Hemlig punkt kräver samordning med leverantör.",
  "Photographer balcony position requires venue approval.": "Fotografens balkongposition kräver lokalens godkännande.",
  "Keep the catering service path clear.": "Håll cateringens serveringsväg fri.",
  // Static risk descriptions
  "The ceremony plan includes a balcony photographer position that should be approved by the chapel.": "Vigselplanen innehåller en balkongposition för fotografen som bör godkännas av kyrkan.",
  "The east wall service path must remain open during dinner and speeches.": "Serveringsvägen längs östra väggen måste hållas öppen under middag och tal.",
  // Quick action (ActionDock)
  "Quick action": "Snabbåtgärd",
  "Applies right here": "Tillämpas direkt här",
  "Opens the right view": "Öppnar rätt vy",
  "Open Action": "Öppna åtgärd",
  "Ready to apply inside the local wedding plan.": "Redo att tillämpas i den lokala bröllopsplanen.",
  "Opens the connected studio view.": "Öppnar den kopplade studiovyn.",
  "moment action": "momentåtgärd",
  // Music selected cue
  "Active cue": "Aktiv cue",
  "Selected cue": "Vald cue",
  "Moment": "Moment",
  "Responsible": "Ansvarig",
  "Start cue": "Startsignal",
  "Backup": "Reserv",
  "Cue readiness": "Cue-status",
  // Reception guest inspector
  "Guest Inspector": "Gästinspektör",
  "Accessibility": "Tillgänglighet",
  "Active guest": "Aktiv gäst",
  "Arrival": "Ankomst",
  "Table": "Bord",
  "Meal": "Måltid",
  "Notes": "Anteckningar",
  "Best seating decision": "Bästa placeringsbeslut",
  "Best vendor decision": "Bästa leverantörsbeslut",
  "Suggested fix": "Föreslagen åtgärd",
  "Focused moment": "Fokuserat moment",
  // Music studio body
  "Choose music cue": "Välj musik-cue",
  "Production trigger": "Produktionssignal",
  "Offline fallback": "Offline-reserv",
  "Missing": "Saknas",
  "Best Cue Fix": "Bästa cue-åtgärd",
  "Apply Fix": "Tillämpa åtgärd",
  "Cue Readiness": "Cue-status",
  "This cue is ready for the production map.": "Den här cuen är redo för produktionskartan.",
  "Preview, Director Mode, and Exports can use this cue without an active music warning.": "Förhandsvisning, Regissörsläge och Export kan använda cuen utan en aktiv musikvarning.",
  "Edit selected cue details": "Redigera vald cue",
  "Song title": "Låttitel",
  "Artist or composer": "Artist eller kompositör",
  "Responsible person": "Ansvarig person",
  "Status": "Status",
  "Planning link": "Planeringslänk",
  "Backup plan": "Reservplan",
  "Production notes": "Produktionsanteckningar",
  "Confirmed": "Bekräftad",
  "Needs Confirmation": "Behöver bekräftas",
  "Needs Backup": "Behöver reserv",
  "Needs Cue": "Behöver cue"
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

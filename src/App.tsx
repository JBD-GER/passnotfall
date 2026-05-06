import { type FormEvent, useEffect, useMemo, useState } from "react";

type Airport = {
  name: string;
  office: string;
  address: string;
  phone: string;
  note: string;
  type: "Bundespolizei" | "Bayerische Grenzpolizei";
};

type AffectedPerson = {
  id: string;
  label: string;
  ageGroup: string;
  problem: string;
};

type Answers = {
  purpose: string;
  location: string;
  airport: string;
  time: string;
  destination: string;
  nationality: string;
  customerEmail: string;
  problem: string;
  affectedPersons: AffectedPerson[];
  documents: string[];
};

type BillingData = {
  firstName: string;
  lastName: string;
  company: string;
  street: string;
  zip: string;
  city: string;
  country: string;
};

type CheckoutConsent = {
  agb: boolean;
  privacy: boolean;
  digitalWaiver: boolean;
};

type PendingCheckout = {
  reference: string;
  answers: Answers;
  billingData: BillingData;
  createdAt: number;
  sessionId?: string;
};

type VerifiedCheckoutSession = {
  id: string;
  status: string;
  payment_status: string;
  customer_email?: string;
  reference?: string;
  invoice?: {
    id: string;
    number?: string;
    hosted_invoice_url?: string;
    invoice_pdf?: string;
    status?: string;
  } | null;
};

type SingleAnswerKey = Exclude<keyof Answers, "documents" | "affectedPersons">;

type ChoiceStep = {
  key: SingleAnswerKey;
  eyebrow: string;
  question: string;
  type: "choice";
  options: string[];
  shouldShow?: (answers: Answers) => boolean;
};

type SelectStep = {
  key: "airport" | "destination";
  eyebrow: string;
  question: string;
  type: "airport" | "country";
};

type MultiStep = {
  key: "documents";
  eyebrow: string;
  question: string;
  type: "multi";
  options: string[];
};

type PeopleStep = {
  key: "affectedPersons";
  eyebrow: string;
  question: string;
  type: "people";
};

type EmailStep = {
  key: "customerEmail";
  eyebrow: string;
  question: string;
  type: "email";
};

type FormStep = ChoiceStep | SelectStep | MultiStep | PeopleStep | EmailStep;
type View = "start" | "form" | "checkout" | "loading" | "result";
type LegalRoute = "impressum" | "datenschutz" | "agb";
type SeoRoute = "reisepass-abgelaufen" | "personalausweis-abgelaufen";
type Route = "home" | LegalRoute | SeoRoute;
type ConfirmationStatus = "idle" | "sending" | "sent" | "error" | "skipped";
type LegalModal = "agb" | "privacy" | null;

type ConsentSettings = {
  statistics: boolean;
  marketing: boolean;
};

type PageMeta = {
  title: string;
  description: string;
  path: string;
  robots?: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const airports: Airport[] = [
  {
    name: "Frankfurt am Main",
    office: "Bundespolizei Flughafen Frankfurt",
    address: "Flughafen, Gebäude 177, 60549 Frankfurt am Main",
    phone: "069 6800-0",
    note: "Gebäude 177; mehrere Bundespolizei-Einheiten am Standort",
    type: "Bundespolizei"
  },
  {
    name: "München",
    office: "Bundespolizei Flughafen München",
    address: "Nordallee 2, 85356 München-Flughafen",
    phone: "089 97307-0",
    note: "Servicebereich auch im Munich Airport Center, Ebene 04",
    type: "Bundespolizei"
  },
  {
    name: "Berlin Brandenburg BER",
    office: "Bundespolizeiinspektion Flughafen Berlin Brandenburg",
    address: "Hugo-Eckener-Allee 7, 12529 Schönefeld",
    phone: "030 856211-0",
    note: "Offizielle Dienststelle am BER",
    type: "Bundespolizei"
  },
  {
    name: "Düsseldorf",
    office: "Bundespolizeiinspektion Flughafen Düsseldorf",
    address: "Flughafenstraße 75, 40474 Düsseldorf",
    phone: "0211 9518-0",
    note: "Bundespolizei am Flughafen Düsseldorf",
    type: "Bundespolizei"
  },
  {
    name: "Hamburg",
    office: "Bundespolizeiinspektion Flughafen Hamburg",
    address: "Flughafenstraße 1-3, 22335 Hamburg",
    phone: "040 50027-0",
    note: "Offizielle Dienststelle am Flughafen",
    type: "Bundespolizei"
  },
  {
    name: "Köln/Bonn",
    office: "Bundespolizeiinspektion Flughafen Köln/Bonn",
    address: "Terminal 1, Ankunft C, 51147 Köln",
    phone: "02203 9522-0",
    note: "Terminal 1, Ankunft C",
    type: "Bundespolizei"
  },
  {
    name: "Stuttgart",
    office: "Bundespolizeiinspektion Flughafen Stuttgart",
    address: "Flughafenstraße 34, 70629 Stuttgart",
    phone: "0711 78781-0",
    note: "Dienststelle am Flughafen Stuttgart",
    type: "Bundespolizei"
  },
  {
    name: "Hannover",
    office: "Bundespolizeiinspektion Flughafen Hannover",
    address: "Benkendorffstraße 30, 30855 Langenhagen",
    phone: "0511 7281-0",
    note: "Leitstelle der Bundespolizei",
    type: "Bundespolizei"
  },
  {
    name: "Bremen",
    office: "Bundespolizeirevier Flughafen Bremen",
    address: "Flughafenallee 21, 28199 Bremen",
    phone: "0421 53616-6",
    note: "Bundespolizei-Revier am Flughafen",
    type: "Bundespolizei"
  },
  {
    name: "Dortmund",
    office: "Bundespolizeirevier Flughafen Dortmund",
    address: "Flughafenring 1, 44319 Dortmund",
    phone: "0231 5655780-1110",
    note: "Bundespolizei-Revier am Flughafen",
    type: "Bundespolizei"
  },
  {
    name: "Dresden",
    office: "Bundespolizeirevier Flughafen Dresden",
    address: "Flughafenstraße 100, 01109 Dresden",
    phone: "0351 205422-0",
    note: "Bundespolizei-Revier am Flughafen",
    type: "Bundespolizei"
  },
  {
    name: "Leipzig/Halle",
    office: "Bundespolizei Flughafen Leipzig/Halle",
    address: "Torweg 7, 04435 Schkeuditz",
    phone: "034204 736-0",
    note: "Bundespolizei am Flughafen Leipzig/Halle",
    type: "Bundespolizei"
  },
  {
    name: "Karlsruhe/Baden-Baden",
    office: "Bundespolizei Flughafen Karlsruhe/Baden-Baden",
    address: "Airport Boulevard B 210, 77836 Rheinmünster",
    phone: "07229 66124-0",
    note: "Bundespolizei am Flughafen Karlsruhe/Baden-Baden",
    type: "Bundespolizei"
  },
  {
    name: "Saarbrücken",
    office: "Bundespolizeirevier Flughafen Saarbrücken",
    address: "Balthasar-Goldstein-Straße 28, 66131 Saarbrücken",
    phone: "06893 9493-0",
    note: "Bundespolizei-Revier am Flughafen",
    type: "Bundespolizei"
  },
  {
    name: "Erfurt-Weimar",
    office: "Bundespolizei Flughafen Erfurt-Weimar",
    address: "Binderslebener Landstraße 100, 99092 Erfurt",
    phone: "0361 22008-0",
    note: "Bundespolizei am Flughafen Erfurt-Weimar",
    type: "Bundespolizei"
  },
  {
    name: "Frankfurt-Hahn",
    office: "Bundespolizei Flughafen Hahn",
    address: "Terminal, 55483 Lautzenhausen",
    phone: "06543 509340",
    note: "Bundespolizei am Flughafen Hahn",
    type: "Bundespolizei"
  },
  {
    name: "Nürnberg",
    office: "Grenzpolizeiinspektion Nürnberg-Flughafen",
    address: "Flughafenstraße 100, 90411 Nürnberg",
    phone: "0911 93592-0",
    note: "Bayerische Grenzpolizei; Servicepoint in Abflughalle 2",
    type: "Bayerische Grenzpolizei"
  },
  {
    name: "Memmingen",
    office: "Grenzpolizeiinspektion Memmingen-Flughafen",
    address: "Am Flughafen 90, 87766 Memmingerberg",
    phone: "08331 100-511",
    note: "Bayerische Grenzpolizei am Flughafen Memmingen",
    type: "Bayerische Grenzpolizei"
  }
];

const countries = [
  "Spanien",
  "Italien",
  "Frankreich",
  "Österreich",
  "Schweiz",
  "Niederlande",
  "Griechenland",
  "Türkei",
  "Großbritannien",
  "USA",
  "Kanada",
  "Ägypten",
  "Vereinigte Arabische Emirate",
  "Thailand",
  "Andere / unklar"
];

const idCardTravelCountries = new Set([
  "Spanien",
  "Italien",
  "Frankreich",
  "Österreich",
  "Schweiz",
  "Niederlande",
  "Griechenland"
]);

const documentProblemOptions = [
  "Reisepass abgelaufen",
  "Personalausweis abgelaufen",
  "Reisepass fehlt / vergessen",
  "Personalausweis fehlt / vergessen",
  "Pass verloren",
  "Kinderausweis/Reisedokument Problem",
  "Name stimmt nicht mit Ticket überein",
  "Dokument beschädigt"
];

const personLabelOptions = ["Ich selbst", "Partner/Elternteil", "Kind", "Weitere Person"];
const personAgeOptions = ["Erwachsene Person", "0-5 Jahre", "6-11 Jahre", "12-15 Jahre", "16-17 Jahre"];

const formSteps: FormStep[] = [
  {
    key: "purpose",
    eyebrow: "Worum geht es?",
    question: "Wofür brauchst du das Dokument jetzt?",
    type: "choice",
    options: [
      "Flug / Grenzübertritt",
      "Identitätsprüfung / Legitimation",
      "Hotel, Mietwagen oder Check-in",
      "Behörde, Bank oder Vertrag",
      "Ich bin unsicher"
    ]
  },
  {
    key: "location",
    eyebrow: "Aktuelle Lage",
    question: "Wo bist du gerade?",
    type: "choice",
    options: ["Zuhause", "Auf dem Weg zum Flughafen", "Bereits am Flughafen", "Im Ausland"]
  },
  {
    key: "airport",
    eyebrow: "Abflug",
    question: "Von welchem Flughafen fliegst du?",
    type: "airport"
  },
  {
    key: "time",
    eyebrow: "Zeitfenster",
    question: "Wann geht dein Flug?",
    type: "choice",
    options: [
      "In weniger als 3 Stunden",
      "In 3-6 Stunden",
      "In 6-12 Stunden",
      "In 12-24 Stunden",
      "In 1-3 Tagen",
      "Später als 3 Tage"
    ]
  },
  {
    key: "destination",
    eyebrow: "Zielland",
    question: "Wohin fliegst du?",
    type: "country"
  },
  {
    key: "nationality",
    eyebrow: "Staatsangehörigkeit",
    question: "Welche Staatsangehörigkeit hast du?",
    type: "choice",
    options: ["Deutsche Staatsangehörigkeit", "Andere Staatsangehörigkeit"]
  },
  {
    key: "affectedPersons",
    eyebrow: "Betroffene Personen",
    question: "Bei wem besteht welches Dokumentproblem?",
    type: "people"
  },
  {
    key: "customerEmail",
    eyebrow: "Bestätigung",
    question: "An welche E-Mail-Adresse sollen wir die PDF-Bestätigung senden?",
    type: "email"
  },
  {
    key: "documents",
    eyebrow: "Vorhandene Unterlagen",
    question: "Welche Dokumente hast du aktuell dabei?",
    type: "multi",
    options: [
      "Abgelaufener Reisepass",
      "Gültiger Reisepass",
      "Vorläufiger Reisepass",
      "Gültiger Personalausweis",
      "Abgelaufener Personalausweis",
      "Führerschein",
      "Geburtsurkunde",
      "Flugticket/Buchungsbestätigung",
      "Biometrisches Passfoto",
      "Keine Dokumente"
    ]
  }
];

const loadingChecks = [
  "Zielland und Dokumentart prüfen",
  "Zeitfenster bewerten",
  "zuständige Stelle ermitteln",
  "nächste Schritte sortieren"
];

const defaultConsent: ConsentSettings = {
  statistics: false,
  marketing: false
};

const pendingCheckoutStorageKey = "passnotfall_pending_checkout";

const legalHighlights = [
  "+25 tägliche Hilfen",
  "+2.500 Kunden unterstützt",
  "PDF-Bestätigung per E-Mail",
  "Zielland, Zeitfenster und Dokumentproblem werden abgefragt",
  "Geeignet bei Reisepass abgelaufen oder Personalausweis abgelaufen"
];

const siteUrl = "https://passnotfall.de";

const pageMeta: Record<Route, PageMeta> = {
  home: {
    title: "PassNotfall: Reisepass oder Personalausweis abgelaufen vor dem Flug",
    description:
      "Reisepass abgelaufen, Personalausweis abgelaufen oder Dokument vergessen? PassNotfall erstellt eine private Sofort-Auswertung mit Stelle, Unterlagen und nächsten Schritten.",
    path: "/"
  },
  "reisepass-abgelaufen": {
    title: "Reisepass abgelaufen vor dem Flug: Was jetzt tun?",
    description:
      "Was tun, wenn der Reisepass abgelaufen ist und der Flug bald startet? Überblick zu Airline, Passbehörde, Flughafen-Stelle, Ersatzdokumenten und Unterlagen.",
    path: "/reisepass-abgelaufen"
  },
  "personalausweis-abgelaufen": {
    title: "Personalausweis abgelaufen vor Reise oder Flug: schnelle Orientierung",
    description:
      "Personalausweis abgelaufen oder vergessen? Erfahre, wann ein Ausweis relevant sein kann, welche Stellen du kontaktieren solltest und welche Nachweise helfen.",
    path: "/personalausweis-abgelaufen"
  },
  impressum: {
    title: "Impressum | PassNotfall",
    description: "Impressum der Flaaq Holding GmbH für PassNotfall.",
    path: "/impressum",
    robots: "noindex,follow"
  },
  datenschutz: {
    title: "Datenschutz | PassNotfall",
    description: "Datenschutzhinweise von PassNotfall zur Verarbeitung von Formular-, Checkout- und Nutzungsdaten.",
    path: "/datenschutz",
    robots: "noindex,follow"
  },
  agb: {
    title: "AGB | PassNotfall",
    description: "Allgemeine Geschäftsbedingungen für die private digitale Orientierungshilfe PassNotfall.",
    path: "/agb",
    robots: "noindex,follow"
  }
};

const seoPages: Record<
  SeoRoute,
  {
    kicker: string;
    title: string;
    intro: string;
    sections: Array<{ title: string; body: string; items: string[] }>;
    faqs: Array<{ question: string; answer: string }>;
  }
> = {
  "reisepass-abgelaufen": {
    kicker: "Ratgeber",
    title: "Reisepass abgelaufen vor dem Flug",
    intro:
      "Wenn der Reisepass abgelaufen ist, entscheidet vor allem die Kombination aus Zielland, Zeitfenster, Airline-Regel und vorhandenen Ersatznachweisen. Diese Seite sortiert die typischen nächsten Schritte.",
    sections: [
      {
        title: "Kurz vor Abflug",
        body:
          "Bei wenigen Stunden bis zum Abflug solltest du nicht zuerst lange recherchieren. Kläre sofort, ob Airline und Zielstaat ein Ersatzdokument akzeptieren können und ob die zuständige Stelle am Flughafen erreichbar ist.",
        items: [
          "Airline mit Buchungsnummer kontaktieren und Dokumentproblem klar benennen.",
          "Flughafen-Stelle oder Bundespolizei anrufen und Zielland, Abflugzeit und vorhandene Unterlagen nennen.",
          "Alle vorhandenen Pässe, Ausweise, Tickets, Fotos und Nachweise griffbereit halten."
        ]
      },
      {
        title: "Noch mehr als ein Tag Zeit",
        body:
          "Wenn noch ein oder mehrere Tage bleiben, ist die Passbehörde meist der sauberere erste Weg. Ein vorläufiger Reisepass oder ein neuer Ausweis kann je nach Fall hilfreicher sein als eine Lösung direkt am Flughafen.",
        items: [
          "Notfalltermin bei Bürgeramt, Bürgerbüro oder Passbehörde anfragen.",
          "Biometrisches Passfoto, alte Dokumente und Reiseunterlagen vorbereiten.",
          "Parallel Airline-Regeln und Einreiseanforderungen prüfen."
        ]
      },
      {
        title: "Typische Risiken",
        body:
          "Ein Ersatzdokument ist keine automatische Garantie. Boarding und Einreise können weiterhin scheitern, wenn Airline, Zielland oder Grenzstelle das Dokument nicht akzeptieren.",
        items: [
          "Drittstaaten sind oft kritischer als Reisen innerhalb Europas.",
          "Mindestgültigkeit, Visum und Ticketname müssen zusätzlich passen.",
          "Bei Kindern können Zustimmung und Nachweise der Sorgeberechtigten nötig sein."
        ]
      }
    ],
    faqs: [
      {
        question: "Kann ich mit abgelaufenem Reisepass fliegen?",
        answer:
          "Das ist riskant und hängt vom Ziel, der Airline und den Grenzregeln ab. Verlasse dich nicht auf mündliche Vermutungen und frage Airline sowie zuständige Stelle direkt."
      },
      {
        question: "Hilft ein vorläufiger Reisepass immer?",
        answer:
          "Nein. Ein vorläufiger Reisepass kann helfen, wird aber nicht für jedes Ziel und nicht in jeder Situation akzeptiert."
      },
      {
        question: "Was macht PassNotfall?",
        answer:
          "PassNotfall erstellt eine private Orientierung mit nächstem Schritt, zuständiger Stelle, Unterlagenliste und Warnhinweisen. Es ist keine Behörde und stellt keine Dokumente aus."
      }
    ]
  },
  "personalausweis-abgelaufen": {
    kicker: "Ratgeber",
    title: "Personalausweis abgelaufen vor Reise oder Flug",
    intro:
      "Ein abgelaufener Personalausweis ist nicht immer gleich kritisch, aber vor dem Flug zählt die konkrete Reisesituation. Entscheidend sind Zielland, vorhandene Dokumente, Alter der betroffenen Person und die Airline-Vorgaben.",
    sections: [
      {
        title: "Wenn du innerhalb Europas reist",
        body:
          "Für viele europäische Ziele kann ein gültiger Personalausweis relevant sein. Ist er abgelaufen, solltest du prüfen, ob ein Reisepass, vorläufiges Dokument oder eine behördliche Lösung verfügbar ist.",
        items: [
          "Zielland und Airline-Vorgaben vor dem Weg zum Flughafen prüfen.",
          "Gültigen Reisepass nutzen, falls vorhanden und passend zum Ticket.",
          "Bei knapper Zeit zuständige Flughafen-Stelle telefonisch vorab fragen."
        ]
      },
      {
        title: "Wenn du nur einen abgelaufenen Ausweis hast",
        body:
          "Ohne gültiges Ausweisdokument steigt das Risiko deutlich. Wichtig ist dann, möglichst viele Ersatznachweise mitzunehmen und früh zu klären, welche Stelle überhaupt zuständig ist.",
        items: [
          "Abgelaufenen Ausweis trotzdem mitnehmen.",
          "Führerschein, Geburtsurkunde, Meldebescheinigung, Ticket und Buchungsbestätigung bereithalten.",
          "Nicht blind zum Schalter laufen, wenn noch telefonische Klärung möglich ist."
        ]
      },
      {
        title: "Ausweis für Legitimation statt Reise",
        body:
          "Wenn der Ausweis für Hotel, Mietwagen, Bank, Behörde oder Vertrag gebraucht wird, ist meist die prüfende Stelle entscheidend. Frage dort konkret, welche Ersatznachweise akzeptiert werden.",
        items: [
          "Direkt die Stelle kontaktieren, die deine Identität prüfen will.",
          "Klären, ob Reisepass, Führerschein oder digitale Nachweise ausreichen.",
          "Keine Flughafen-Lösung erwarten, wenn es nicht um Grenzübertritt oder Flug geht."
        ]
      }
    ],
    faqs: [
      {
        question: "Reicht ein abgelaufener Personalausweis im Notfall?",
        answer:
          "Darauf solltest du dich nicht verlassen. Manche Stellen können abgelaufene Dokumente als Zusatznachweis würdigen, verbindlich ist das aber nicht."
      },
      {
        question: "Was ist besser: Reisepass oder Personalausweis?",
        answer:
          "Das hängt vom Ziel ab. Für viele Drittstaaten ist ein Reisepass erforderlich, für manche europäische Ziele kann ein gültiger Personalausweis reichen."
      },
      {
        question: "Wann sollte ich die Passbehörde kontaktieren?",
        answer:
          "Sobald mehr als wenige Stunden bleiben, ist ein Notfalltermin bei Bürgeramt oder Passbehörde oft der bessere erste Schritt."
      }
    ]
  }
};

function getInitialBillingData(): BillingData {
  return {
    firstName: "",
    lastName: "",
    company: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland"
  };
}

function createCheckoutReference() {
  return `PN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function readPendingCheckout(): PendingCheckout | null {
  try {
    const stored = localStorage.getItem(pendingCheckoutStorageKey);
    return stored ? (JSON.parse(stored) as PendingCheckout) : null;
  } catch {
    return null;
  }
}

function savePendingCheckout(pendingCheckout: PendingCheckout) {
  localStorage.setItem(pendingCheckoutStorageKey, JSON.stringify(pendingCheckout));
}

function clearPendingCheckout() {
  localStorage.removeItem(pendingCheckoutStorageKey);
}

function updateGoogleConsent(consent: ConsentSettings) {
  window.gtag?.("consent", "update", {
    analytics_storage: consent.statistics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted"
  });
}

function trackEvent(eventName: string) {
  window.gtag?.("event", eventName, {
    event_category: "passnotfall",
    non_interaction: false
  });
}

function getRouteFromPath(pathname: string): Route {
  if (pathname === "/reisepass-abgelaufen") {
    return "reisepass-abgelaufen";
  }

  if (pathname === "/personalausweis-abgelaufen") {
    return "personalausweis-abgelaufen";
  }

  if (pathname === "/impressum") {
    return "impressum";
  }

  if (pathname === "/datenschutz") {
    return "datenschutz";
  }

  if (pathname === "/agb") {
    return "agb";
  }

  return "home";
}

function isLegalRoute(route: Route): route is LegalRoute {
  return route === "impressum" || route === "datenschutz" || route === "agb";
}

function isSeoRoute(route: Route): route is SeoRoute {
  return route === "reisepass-abgelaufen" || route === "personalausweis-abgelaufen";
}

function getMetaElement(attribute: "name" | "property", value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }

  return element;
}

function getLinkElement(rel: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  return element;
}

function createStructuredData(route: Route) {
  const meta = pageMeta[route];
  const baseData: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "PassNotfall",
      url: siteUrl,
      logo: `${siteUrl}/Logo_Passnotfall.png`,
      contactPoint: {
        "@type": "ContactPoint",
        email: "hilfe@passnotfall.de",
        contactType: "customer support",
        areaServed: "DE",
        availableLanguage: "de"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "PassNotfall",
      url: siteUrl,
      inLanguage: "de-DE",
      description: pageMeta.home.description
    }
  ];

  if (route === "home") {
    baseData.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Kann die Bundespolizei immer helfen?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nein. Ersatzdokumente hängen vom Einzelfall, Zielland und der Airline ab."
          }
        },
        {
          "@type": "Question",
          name: "Reicht ein Personalausweis?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "In vielen europäischen Ländern kann ein gültiger Personalausweis reichen. Für andere Ziele ist oft ein Reisepass erforderlich."
          }
        }
      ]
    });
  }

  if (isSeoRoute(route)) {
    const page = seoPages[route];

    baseData.push(
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.title,
        description: meta.description,
        url: `${siteUrl}${meta.path}`,
        inLanguage: "de-DE",
        publisher: {
          "@type": "Organization",
          name: "PassNotfall",
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/Logo_Passnotfall.png`
          }
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer
          }
        }))
      }
    );
  }

  return baseData;
}

function updatePageMeta(route: Route, view: View) {
  const meta = pageMeta[route];
  const canonicalUrl = `${siteUrl}${meta.path}`;
  const shouldNoIndex = view !== "start" || Boolean(meta.robots);
  const robots = shouldNoIndex ? meta.robots || "noindex,follow" : "index,follow";

  document.documentElement.lang = "de";
  document.title = meta.title;
  getMetaElement("name", "description").content = meta.description;
  getMetaElement("name", "robots").content = robots;
  getMetaElement("property", "og:type").content = isSeoRoute(route) ? "article" : "website";
  getMetaElement("property", "og:locale").content = "de_DE";
  getMetaElement("property", "og:site_name").content = "PassNotfall";
  getMetaElement("property", "og:title").content = meta.title;
  getMetaElement("property", "og:description").content = meta.description;
  getMetaElement("property", "og:url").content = canonicalUrl;
  getMetaElement("property", "og:image").content = `${siteUrl}/Logo_Passnotfall.png`;
  getMetaElement("name", "twitter:card").content = "summary_large_image";
  getMetaElement("name", "twitter:title").content = meta.title;
  getMetaElement("name", "twitter:description").content = meta.description;
  getMetaElement("name", "twitter:image").content = `${siteUrl}/Logo_Passnotfall.png`;
  getLinkElement("canonical").href = canonicalUrl;

  let script = document.getElementById("passnotfall-structured-data") as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.id = "passnotfall-structured-data";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(createStructuredData(route));
}

function getInitialAnswers(): Answers {
  return {
    purpose: "Flug / Grenzübertritt",
    location: "Bereits am Flughafen",
    airport: "Frankfurt am Main",
    time: "In 3-6 Stunden",
    destination: "Türkei",
    nationality: "Deutsche Staatsangehörigkeit",
    customerEmail: "",
    problem: "Reisepass abgelaufen",
    affectedPersons: [
      {
        id: "person-1",
        label: "Ich selbst",
        ageGroup: "Erwachsene Person",
        problem: "Reisepass abgelaufen"
      }
    ],
    documents: ["Abgelaufener Reisepass", "Flugticket/Buchungsbestätigung"]
  };
}

function createAssessment(answers: Answers) {
  const airport = airports.find((item) => item.name === answers.airport) || airports[0];
  const acceptsGermanIdCard = idCardTravelCountries.has(answers.destination);
  const isGerman = answers.nationality === "Deutsche Staatsangehörigkeit";
  const affectedPersons =
    answers.affectedPersons.length > 0
      ? answers.affectedPersons
      : [{ id: "person-1", label: "Ich selbst", ageGroup: "Erwachsene Person", problem: answers.problem }];
  const primaryProblem = affectedPersons[0]?.problem || answers.problem;
  const hasMinorAffected = affectedPersons.some((person) => person.ageGroup !== "Erwachsene Person" || person.label === "Kind");
  const hasMultipleAffected = affectedPersons.length > 1;
  const onlyMinorAffected = affectedPersons.length === 1 && hasMinorAffected;
  const affectedSummary = affectedPersons.map((person) => `${person.label}: ${person.problem}`).join("; ");
  const isShortTime = ["In weniger als 3 Stunden", "In 3-6 Stunden"].includes(answers.time);
  const isMediumTime = ["In 6-12 Stunden", "In 12-24 Stunden"].includes(answers.time);
  const hasValidPassport = answers.documents.includes("Gültiger Reisepass");
  const hasTemporaryPassport = answers.documents.includes("Vorläufiger Reisepass");
  const hasValidId = answers.documents.includes("Gültiger Personalausweis");
  const hasNoDocs = answers.documents.includes("Keine Dokumente");
  const isLegitimation =
    answers.purpose === "Identitätsprüfung / Legitimation" ||
    answers.purpose === "Hotel, Mietwagen oder Check-in" ||
    answers.purpose === "Behörde, Bank oder Vertrag";

  let headline = "Dein nächster Schritt steht fest";
  let verdict = "Nicht auf gut Glück warten. Kläre jetzt die zuständige Stelle und nimm alle Nachweise mit.";
  let risk = "Mittel";
  let primaryAction = "Rufe die zuständige Flughafen-Stelle an und gehe danach direkt dorthin.";
  let route = "Flughafen-Stelle zuerst, Passbehörde parallel prüfen.";
  let documents = [
    "Flugticket oder Buchungsbestätigung",
    "alle vorhandenen Ausweise und Pässe",
    "biometrisches Passfoto, falls vorhanden",
    "EC-/Kreditkarte oder Bargeld für Gebühren"
  ];

  if (isLegitimation) {
    headline = hasValidId || hasValidPassport ? "Nutze dein gültiges Ausweisdokument" : "Kläre Ersatznachweise direkt mit der Stelle";
    verdict = hasValidId || hasValidPassport
      ? "Für reine Legitimation brauchst du meistens keinen Reisepass. Entscheidend ist, was die prüfende Stelle akzeptiert."
      : "Ohne gültiges Ausweisdokument musst du sofort fragen, welche Ersatznachweise akzeptiert werden.";
    risk = hasValidId || hasValidPassport ? "Niedrig bis mittel" : "Mittel";
    primaryAction = "Rufe die Stelle an, die deine Identität prüfen will, und frage nach akzeptierten Ersatznachweisen.";
    route = "Nicht zuerst zur Bundespolizei. Zuständig ist die Stelle, die den Nachweis verlangt.";
  } else if (!isGerman) {
    headline = "Kontaktiere deine Auslandsvertretung";
    verdict = "Die deutsche Bundespolizei kann nicht für jede Staatsangehörigkeit ein Ersatzdokument ausstellen.";
    risk = "Hoch";
    primaryAction = "Rufe sofort deine Botschaft oder dein Konsulat an.";
    route = "Auslandsvertretung zuerst. Airline zusätzlich informieren.";
  } else if (hasNoDocs) {
    headline = "Ohne Nachweis ist das Risiko sehr hoch";
    verdict = "Ohne Identitätsnachweis ist eine schnelle Lösung unsicher.";
    risk = "Sehr hoch";
    primaryAction = "Rufe zuerst die Flughafen-Stelle an. Fahre nicht blind los, wenn du noch nicht am Flughafen bist.";
    route = "Telefonische Vorabklärung zuerst, danach nur mit klarer Anweisung zur Stelle gehen.";
  } else if (hasValidPassport) {
    headline = "Dein Reisepass löst den Notfall wahrscheinlich";
    verdict = "Wenn der Pass gültig, unbeschädigt und auf denselben Namen wie das Ticket ausgestellt ist, ist das Passproblem meist erledigt.";
    risk = "Niedrig";
    primaryAction = "Prüfe jetzt Ticketname, Visum, Mindestgültigkeit und Airline-Regeln.";
    route = "Keine Notfallstelle nötig, solange alle Reisedaten passen.";
  } else if (hasValidId && acceptsGermanIdCard) {
    headline = "Der Personalausweis kann für dieses Ziel reichen";
    verdict = "Für dieses Reiseziel ist ein gültiger deutscher Personalausweis oft ausreichend. Lass es trotzdem direkt von Airline oder offizieller Stelle bestätigen.";
    risk = isShortTime ? "Niedrig bis mittel" : "Niedrig";
    primaryAction = "Prüfe sofort die Airline-Vorgaben und nutze den gültigen Personalausweis als Hauptdokument.";
    route = "Airline prüfen. Bundespolizei nur, wenn die Airline ein Problem sieht.";
  } else if (hasValidId && !acceptsGermanIdCard) {
    headline = "Der Personalausweis reicht voraussichtlich nicht";
    verdict = "Für dieses Zielland brauchst du wahrscheinlich einen Reisepass oder ein akzeptiertes Ersatzdokument.";
    risk = isShortTime ? "Hoch" : "Mittel";
    primaryAction = isShortTime
      ? "Rufe sofort Airline und Flughafen-Stelle an. Frage ausdrücklich, ob Boarding mit Ersatzdokument möglich ist."
      : "Rufe sofort die Passbehörde wegen eines vorläufigen Reisepasses an.";
    route = isShortTime
      ? "Flughafen-Stelle und Airline zuerst, Passbehörde nur wenn zeitlich erreichbar."
      : "Passbehörde zuerst, Flughafen-Stelle als Backup.";
  } else if (isShortTime && acceptsGermanIdCard) {
    headline = "Gehe jetzt zur Flughafen-Stelle";
    verdict = "Mit abgelaufenen oder beschädigten Dokumenten kann am Flughafen eventuell ein Ersatz geprüft werden. Eine Garantie ist das nicht.";
    risk = "Mittel";
    primaryAction = "Packe alle Nachweise ein und gehe direkt zur zuständigen Stelle am Flughafen.";
    route = "Flughafen-Stelle zuerst. Airline parallel informieren.";
  } else if (isShortTime && !acceptsGermanIdCard) {
    headline = "Nicht auf Passersatz verlassen";
    verdict = "Für Drittstaaten ist ein Reiseausweis als Passersatz oft kritisch. Boarding oder Einreise kann verweigert werden.";
    risk = "Hoch";
    primaryAction = "Rufe sofort Airline und Flughafen-Stelle an, bevor du dich auf eine Lösung am Schalter verlässt.";
    route = "Airline-Bestätigung zuerst. Ohne Bestätigung ist der Weg riskant.";
  } else if (isMediumTime) {
    headline = "Passbehörde und Flughafen parallel klären";
    verdict = "Du hast noch etwas Zeit, aber nicht genug für Umwege.";
    risk = "Mittel";
    primaryAction = "Rufe die Passbehörde wegen eines vorläufigen Reisepasses an und kontaktiere zusätzlich die Flughafen-Stelle.";
    route = "Passbehörde zuerst, Flughafen-Stelle als zweite Spur.";
  } else {
    headline = "Gehe zuerst zur Passbehörde";
    verdict = "Bei mehr als einem Tag Restzeit ist ein offizielles Dokument über Bürgeramt oder Passbehörde meist der sauberere Weg.";
    risk = "Mittel";
    primaryAction = "Buche oder verlange sofort einen Notfalltermin bei Bürgeramt, Bürgerbüro oder Passbehörde.";
    route = "Passbehörde zuerst. Flughafen-Stelle nur als Backup.";
  }

  if (hasTemporaryPassport) {
    documents = ["vorläufiger Reisepass", ...documents];
  }

  if (hasMultipleAffected) {
    headline = "Dokumentprobleme je Person getrennt klären";
    verdict = "Bei mehreren betroffenen Personen kann jede Person andere Dokumente, Nachweise oder eine andere Lösung brauchen.";
    risk = isShortTime ? "Hoch" : "Mittel";
    primaryAction = "Rufe Airline und zuständige Stelle an und schildere die Dokumentprobleme getrennt je betroffener Person.";
    route = "Personen einzeln prüfen: Airline-Bestätigung, zuständige Stelle und Unterlagen je Person klären.";
  }

  if (hasMinorAffected || primaryProblem === "Kinderausweis/Reisedokument Problem") {
    headline = hasMultipleAffected ? "Dokumentprobleme je Person getrennt klären" : "Kinderdokument gesondert klären";
    verdict = onlyMinorAffected
      ? "Bei einem betroffenen Kind zählen zusätzlich Zustimmung und Nachweise der Sorgeberechtigten."
      : "Die nächsten Schritte müssen zum Zielland, zur Airline und zu jeder betroffenen Person passen. Minderjährige brauchen zusätzlich eigene Nachweise.";
    risk = "Hoch";
    primaryAction = onlyMinorAffected
      ? "Rufe sofort Airline und zuständige Stelle an und frage nach den konkreten Nachweisen für das Kind."
      : "Rufe sofort Airline und zuständige Stelle an und schildere alle betroffenen Personen mit ihrem jeweiligen Dokumentproblem.";
    route = onlyMinorAffected
      ? "Airline, zuständige Stelle und Sorgeberechtigten-Nachweise parallel klären."
      : "Airline und zuständige Stelle zuerst. Personenbezogene Nachweise danach getrennt prüfen.";
    documents = [
      "Geburtsurkunde des Kindes",
      "Ausweise der Sorgeberechtigten",
      "Zustimmung der Sorgeberechtigten",
      ...documents
    ];
  }

  const personNotices = affectedPersons.map((person, index) => {
    const isMinor = person.ageGroup !== "Erwachsene Person" || person.label === "Kind";

    return {
      title: `Person ${index + 1}: ${person.label}${person.ageGroup !== "Erwachsene Person" ? ` (${person.ageGroup})` : ""}`,
      text: `${person.problem}. ${
        isMinor
          ? "Für diese minderjährige Person müssen Zustimmung und Nachweise der Sorgeberechtigten zusätzlich geprüft werden."
          : "Für diese Person separat prüfen, welche Dokumente und Ersatznachweise akzeptiert werden."
      }`,
      items: isMinor
        ? [
            "Airline fragen, ob Boarding mit dem vorhandenen Kinder-Dokument oder Ersatzdokument möglich ist.",
            "Geburtsurkunde, Ausweise der Sorgeberechtigten und Zustimmungserklärung bereithalten.",
            "Falls nur ein Sorgeberechtigter reist: Zustimmung oder Nachweis der alleinigen Sorge bereithalten.",
            "Name, Geburtsdatum und Schreibweise auf Ticket und Dokumenten genau vergleichen."
          ]
        : [
            "Problem dieser Person separat bei Airline und zuständiger Stelle nennen.",
            "Alle vorhandenen Ausweise, Pässe und Nachweise dieser Person bereithalten.",
            "Name und Schreibweise auf Ticket und Dokumenten genau vergleichen."
          ]
    };
  });

  const childNotice = hasMinorAffected
    ? {
        title: "Zusatzhinweis für minderjährige betroffene Personen",
        text:
          "Kläre vor dem Weg zum Schalter ausdrücklich, welche Unterlagen für das Kind akzeptiert werden. Bei Minderjährigen können Geburtsurkunde, Ausweise der Sorgeberechtigten, Zustimmungserklärung und Nachweise zum Sorgerecht verlangt werden.",
        items: [
          "Airline fragen, ob Boarding mit dem vorhandenen Kinder-Dokument oder Ersatzdokument möglich ist.",
          "Falls nur ein Sorgeberechtigter reist: Zustimmung oder Nachweis der alleinigen Sorge bereithalten.",
          "Name, Geburtsdatum und Schreibweise auf Ticket und Dokumenten genau vergleichen.",
          "Für Kinder keine Annahme treffen, dass Erwachsenen-Regeln automatisch gleich gelten."
        ]
      }
    : null;

  return {
    airport,
    headline,
    verdict,
    risk,
    primaryAction,
    route,
    childNotice,
    personNotices,
    documents: Array.from(new Set(documents)),
    steps: [
      primaryAction,
      `Rufe ${airport.office} unter ${airport.phone} an und schildere: Ziel ${answers.destination}, Abflug ${answers.time}, Probleme: ${affectedSummary}.`,
      "Sage der Airline Bescheid und frage, ob Boarding mit den vorhandenen Dokumenten oder Ersatzdokumenten möglich ist.",
      "Nimm alle Unterlagen mit und plane zusätzliche Zeit für Gebühren, Prüfung und Rückfragen ein."
    ],
    warnings: [
      acceptsGermanIdCard
        ? "Personalausweis kann für dieses Ziel relevant sein, muss aber zur Reise und zum Ticket passen."
        : "Für dieses Ziel ist ein Reisepass oder akzeptiertes Ersatzdokument besonders wichtig.",
      "Diese Auswertung ersetzt keine verbindliche Auskunft von Airline, Behörde, Bundespolizei oder Konsulat.",
      "Ein Ersatzdokument garantiert nicht automatisch Boarding oder Einreise.",
      ...(hasMinorAffected
        ? ["Bei Minderjährigen müssen Dokumente, Zustimmung und Sorgeberechtigung immer gesondert geprüft werden."]
        : [])
    ]
  };
}

type Assessment = ReturnType<typeof createAssessment>;
type AiAssessment = Partial<Pick<Assessment, "headline" | "verdict" | "primaryAction" | "route" | "steps" | "warnings">>;

function mergeAssessment(localAssessment: Assessment, aiAssessment: AiAssessment | null): Assessment {
  if (!aiAssessment) {
    return localAssessment;
  }

  return {
    ...localAssessment,
    headline: typeof aiAssessment.headline === "string" ? aiAssessment.headline : localAssessment.headline,
    verdict: typeof aiAssessment.verdict === "string" ? aiAssessment.verdict : localAssessment.verdict,
    primaryAction:
      typeof aiAssessment.primaryAction === "string" ? aiAssessment.primaryAction : localAssessment.primaryAction,
    route: typeof aiAssessment.route === "string" ? aiAssessment.route : localAssessment.route,
    steps:
      Array.isArray(aiAssessment.steps) && aiAssessment.steps.length > 0
        ? aiAssessment.steps.slice(0, 5)
        : localAssessment.steps,
    warnings:
      Array.isArray(aiAssessment.warnings) && aiAssessment.warnings.length > 0
        ? aiAssessment.warnings.slice(0, 5)
        : localAssessment.warnings
  };
}

function CookieBanner() {
  const [storedConsent, setStoredConsent] = useState(() => localStorage.getItem("passnotfall_cookie_consent"));
  const [settings, setSettings] = useState<ConsentSettings>(defaultConsent);

  if (storedConsent) {
    return null;
  }

  function saveConsent(nextSettings: ConsentSettings) {
    localStorage.setItem("passnotfall_cookie_consent", JSON.stringify(nextSettings));
    updateGoogleConsent(nextSettings);
    setStoredConsent(JSON.stringify(nextSettings));
  }

  return (
    <div className="cookie-backdrop" role="presentation">
      <section className="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
        <p className="section-kicker">Datenschutz-Einstellungen</p>
        <h2 id="cookie-title">Bitte Cookie-Auswahl treffen</h2>
        <p>
          Wir nutzen essentielle Speicherungen für den Betrieb der Seite. Statistik und Conversion-Tracking
          setzen wir nur ein, wenn du zustimmst. Der Banner kann erst nach einer Auswahl geschlossen werden.
        </p>

        <div className="cookie-options">
          <label>
            <input type="checkbox" checked disabled />
            <span>
              <strong>Essentiell</strong>
              Notwendig für Grundfunktionen, Sicherheit und deine Cookie-Auswahl.
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.statistics}
              onChange={(event) => setSettings((current) => ({ ...current, statistics: event.target.checked }))}
            />
            <span>
              <strong>Statistik</strong>
              Hilft uns zu verstehen, welche Bereiche genutzt werden.
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.marketing}
              onChange={(event) => setSettings((current) => ({ ...current, marketing: event.target.checked }))}
            />
            <span>
              <strong>Conversion-Tracking</strong>
              Erlaubt Messung von Anzeigen-Ergebnissen und Google-Ads-Conversions.
            </span>
          </label>
        </div>

        <div className="cookie-actions">
          <button type="button" className="secondary-button" onClick={() => saveConsent(defaultConsent)}>
            Nur essentielle
          </button>
          <button type="button" className="secondary-button" onClick={() => saveConsent(settings)}>
            Auswahl speichern
          </button>
          <button type="button" className="primary-button" onClick={() => saveConsent({ statistics: true, marketing: true })}>
            Alle akzeptieren
          </button>
        </div>
      </section>
    </div>
  );
}

function LegalPage({ route }: { route: LegalRoute }) {
  const content = {
    impressum: {
      kicker: "Impressum",
      title: "Angaben gemäß § 5 DDG",
      body: (
        <>
          <p>
            Flaaq Holding GmbH
            <br />
            Geschäftsführer: Christoph Pfad
            <br />
            Großer Kamp 5a
            <br />
            31633 Leese
            <br />
            Deutschland
          </p>
          <p>
            Registereintrag: Amtsgericht Hannover, HRB 223594
            <br />
            Telefon: <a href="tel:+4957618429666">05761 8429666</a>
            <br />
            Telefax: 05761 84296661
            <br />
            E-Mail: <a href="mailto:hilfe@passnotfall.de">hilfe@passnotfall.de</a>
          </p>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE352217621</p>
          <p>
            Die frühere Plattform der EU-Kommission zur Online-Streitbeilegung wurde zum 20. Juli 2025
            eingestellt. Informationen zu anerkannten Verbraucherschlichtungsstellen finden Sie unter{" "}
            <a href="https://consumer-redress.ec.europa.eu/dispute-resolution-bodies" target="_blank" rel="noreferrer">
              consumer-redress.ec.europa.eu/dispute-resolution-bodies
            </a>
            . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </>
      )
    },
    datenschutz: {
      kicker: "Datenschutz",
      title: "Datenschutzhinweise",
      body: (
        <>
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlich ist die Flaaq Holding GmbH, Großer Kamp 5a, 31633 Leese, E-Mail:
            <a href="mailto:hilfe@passnotfall.de">hilfe@passnotfall.de</a>. Wenn du Fragen zum Datenschutz hast
            oder deine Rechte ausüben möchtest, kannst du dich jederzeit an diese Adresse wenden.
          </p>
          <h2>2. Verarbeitete Daten</h2>
          <p>
            Wir verarbeiten Daten, die du im Notfallcheck und Checkout eingibst. Dazu gehören insbesondere
            Reiseziel, Flughafen, Zeitfenster, Staatsangehörigkeit, Dokumentproblem, betroffene Personen,
            Altersgruppen bei minderjährigen Personen, vorhandene Unterlagen, E-Mail-Adresse, Rechnungsdaten,
            technische Nutzungsdaten sowie Zahlungs- und Transaktionsinformationen, soweit ein Zahlungsanbieter
            eingebunden wird.
          </p>
          <h2>3. Zwecke und Rechtsgrundlagen</h2>
          <p>
            Die Verarbeitung erfolgt zur Erstellung deiner digitalen Orientierungshilfe, zur Abwicklung des
            Checkouts, zur Rechnungsstellung, zur Bereitstellung der PDF-Bestätigung, zur Kundenkommunikation,
            zur technischen Sicherheit und zur Erfüllung gesetzlicher Pflichten. Rechtsgrundlagen sind Art. 6
            Abs. 1 lit. b DSGVO für vorvertragliche und vertragliche Leistungen, Art. 6 Abs. 1 lit. c DSGVO für
            gesetzliche Aufbewahrungs- und Nachweispflichten, Art. 6 Abs. 1 lit. f DSGVO für technische
            Sicherheit und Missbrauchsprävention sowie Art. 6 Abs. 1 lit. a DSGVO für einwilligungsbasierte
            Statistik-, Marketing- und Conversion-Dienste.
          </p>
          <h2>4. Dienstleister und Empfänger</h2>
          <p>
            Das Hosting der Website erfolgt über Vercel. Anwendungsbezogene Daten können in Supabase gespeichert
            werden. E-Mail-Benachrichtigungen und PDF-Bestätigungen werden über Resend versendet. Zur
            Formulierung und Verbesserung der Auswertung kann ein KI-Dienstleister wie OpenAI eingebunden werden.
            Zahlungsdaten werden bei Einbindung eines Zahlungsanbieters wie Stripe oder Mollie über diesen
            Anbieter verarbeitet. Soweit Dienstleister personenbezogene Daten in unserem Auftrag verarbeiten,
            erfolgt dies auf Grundlage entsprechender Auftragsverarbeitungsverträge.
          </p>
          <h2>5. Cookies, Statistik und Conversion-Tracking</h2>
          <p>
            Essentielle Cookies und lokale Speicherungen dienen dem Betrieb der Website und der Speicherung deiner
            Cookie-Auswahl. Statistik und Conversion-Tracking werden nur nach deiner Einwilligung aktiviert. Für
            Google-Tags ist der Standard auf abgelehnt gesetzt. Bei Einwilligung werden die Consent-Signale
            analytics_storage, ad_storage, ad_user_data und ad_personalization aktualisiert. Conversion-Tracking
            kann dazu dienen, zu messen, ob ein Besuch zu einem gestarteten Check, Checkout oder Kauf geführt hat.
          </p>
          <h2>6. Speicherdauer</h2>
          <p>
            Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist.
            Rechnungs- und Buchungsdaten können aufgrund gesetzlicher handels- und steuerrechtlicher Pflichten
            regelmäßig bis zu zehn Jahre aufbewahrt werden. Daten aus Support- und Transaktionskommunikation
            speichern wir nur solange, wie dies zur Bearbeitung und Nachvollziehbarkeit erforderlich ist.
          </p>
          <h2>7. Drittlandübermittlungen</h2>
          <p>
            Bei Dienstleistern mit Sitz oder Infrastruktur außerhalb der EU/des EWR kann eine Übermittlung in
            Drittländer stattfinden. In diesen Fällen achten wir auf geeignete Garantien, etwa EU-
            Standardvertragsklauseln, Angemessenheitsbeschlüsse oder zusätzliche Schutzmaßnahmen, soweit diese
            erforderlich sind.
          </p>
          <h2>8. Deine Rechte</h2>
          <p>
            Du hast nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der
            Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine erteilte Einwilligung kannst du jederzeit mit
            Wirkung für die Zukunft widerrufen, zum Beispiel durch Löschen der Browserdaten für diese Website
            oder durch Kontaktaufnahme per E-Mail. Außerdem hast du das Recht, dich bei einer Datenschutz-
            Aufsichtsbehörde zu beschweren.
          </p>
          <h2>9. Keine automatisierte Entscheidung</h2>
          <p>
            Die Auswertung dient der Orientierung und führt nicht zu einer rechtlich verbindlichen automatisierten
            Entscheidung im Sinne von Art. 22 DSGVO. Verbindliche Entscheidungen treffen ausschließlich Airlines,
            Behörden, Bundespolizei, Grenzpolizei, Konsulate oder andere zuständige Stellen.
          </p>
        </>
      )
    },
    agb: {
      kicker: "AGB",
      title: "Allgemeine Geschäftsbedingungen",
      body: (
        <>
          <h2>1. Anbieter und Vertragsgegenstand</h2>
          <p>
            PassNotfall ist eine private, kostenpflichtige Informations- und Orientierungshilfe. Wir sind keine
            Behörde, keine Auslandsvertretung, keine Fluggesellschaft und kein autorisierter Aussteller amtlicher
            Dokumente. Über diese Website können keine Reisepässe, Personalausweise, Visa oder Ersatzdokumente
            gekauft, beantragt oder ausgestellt werden.
          </p>
          <h2>2. Leistung</h2>
          <p>
            Die Dienstleistung ist eine digitale Orientierungshilfe auf Basis deiner Eingaben und unseres aktuellen
            Kenntnisstands. Der Standardpreis beträgt 49 EUR inkl. MwSt. Es gibt keine Garantie für Boarding,
            Einreise, Termine oder die Ausstellung offizieller Dokumente.
          </p>
          <h2>3. Vertragsschluss und Checkout</h2>
          <p>
            Vor Erstellung der kostenpflichtigen Auswertung gibst du die erforderlichen Rechnungsdaten an und
            bestätigst diese AGB sowie die Datenschutzhinweise. Der Vertrag kommt zustande, wenn du den
            kostenpflichtigen Checkout abschließt und die Auswertung freigeschaltet beziehungsweise erstellt wird.
            Bei Einbindung eines Zahlungsanbieters kann die Leistung erst nach erfolgreicher Zahlungsbestätigung
            bereitgestellt werden.
          </p>
          <h2>4. Mitwirkung und Eingaben</h2>
          <p>
            Die Auswertung basiert auf deinen Eingaben und unserem aktuellen Kenntnisstand. Sie ersetzt keine
            verbindliche Auskunft von Behörden, Bundespolizei, Grenzpolizei, Auslandsvertretungen oder
            Fluggesellschaften. Einreisebestimmungen, Airline-Regeln, Öffnungszeiten und Zuständigkeiten können
            sich ändern.
          </p>
          <h2>5. Preis, Zahlung und Rechnung</h2>
          <p>
            Der angezeigte Preis versteht sich inklusive gesetzlicher Umsatzsteuer. Die Rechnung kann auf Basis
            der im Checkout angegebenen Rechnungsdaten erstellt werden. Bei Nutzung externer Zahlungsanbieter
            gelten zusätzlich deren Zahlungsbedingungen, soweit sie den Zahlungsvorgang betreffen.
          </p>
          <h2>6. Keine Erfolgsgarantie</h2>
          <p>
            Wir schulden keine erfolgreiche Reise, keine Einreise, kein Boarding, keinen Termin und keine
            Ausstellung eines Ersatzdokuments. Dass eine Auswertung im Einzelfall nicht zum gewünschten Ergebnis
            führt, ist allein kein Erstattungsgrund. Bei vorsätzlich falschen Eingaben, unvollständigen Angaben
            oder nachträglichen Änderungen der tatsächlichen Lage kann die Auswertung abweichen.
          </p>
          <h2>7. Widerruf und digitale Leistung</h2>
          <p>
            Verbraucher können grundsätzlich ein gesetzliches Widerrufsrecht haben. Bei digitalen Inhalten oder
            digitalen Dienstleistungen kann das Widerrufsrecht unter den gesetzlichen Voraussetzungen erlöschen,
            wenn du ausdrücklich zustimmst, dass wir vor Ablauf der Widerrufsfrist mit der Leistung beginnen, und
            du bestätigst, dass du dadurch dein Widerrufsrecht verlieren kannst. Diese Erklärung sollte im
            Checkout gesondert abgefragt werden, sobald der echte Zahlungsprozess aktiviert wird.
          </p>
          <p>
            Die PassNotfall-Auswertung und die PDF-Bestätigung sind digitale Inhalte beziehungsweise digitale
            Leistungen. Bei nicht auf einem körperlichen Datenträger bereitgestellten digitalen Inhalten kann das
            Widerrufsrecht nach § 356 Abs. 5 BGB erlöschen, wenn du ausdrücklich zustimmst, dass wir vor Ablauf
            der Widerrufsfrist mit der Ausführung beginnen, und du deine Kenntnis bestätigst, dass dein
            Widerrufsrecht mit Beginn der Ausführung erlöschen kann.
          </p>
          <h2>8. Haftung</h2>
          <p>
            Für falsche, veraltete oder missverständliche Auskünfte haften wir nur nach Maßgabe der gesetzlichen
            Vorschriften. Verbindliche Entscheidungen treffen ausschließlich die zuständigen Stellen.
          </p>
          <h2>9. Rechnung und Kommunikation</h2>
          <p>
            Für die Rechnungsstellung verarbeiten wir die im Checkout angegebenen Rechnungsdaten. Die
            PDF-Bestätigung und weitere transaktionsbezogene Hinweise können per E-Mail versendet werden.
          </p>
          <h2>10. Schlussbestimmungen</h2>
          <p>
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften
            bleiben unberührt. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen
            Bestimmungen unberührt.
          </p>
        </>
      )
    }
  }[route];

  return (
    <section className="legal-page">
      <article className="legal-document">
        <p className="section-kicker">{content.kicker}</p>
        <h1>{content.title}</h1>
        {content.body}
      </article>
    </section>
  );
}

function SeoPage({
  route,
  startCheck,
  navigateTo
}: {
  route: SeoRoute;
  startCheck: () => void;
  navigateTo: (path: string) => void;
}) {
  const page = seoPages[route];
  const otherRoute: SeoRoute =
    route === "reisepass-abgelaufen" ? "personalausweis-abgelaufen" : "reisepass-abgelaufen";
  const otherMeta = pageMeta[otherRoute];

  return (
    <>
      <section className="guide-hero">
        <p className="section-kicker">{page.kicker}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <button className="primary-button" type="button" onClick={startCheck}>
          Notfallcheck starten
        </button>
      </section>

      <section className="guide-section" aria-label="Schnelle Einordnung">
        <div className="guide-grid">
          {page.sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section guide-faq">
        <p className="section-kicker">Häufige Fragen</p>
        <h2>Wichtige Antworten für den Notfall</h2>
        <div className="faq-grid">
          {page.faqs.map((faq) => (
            <details key={faq.question} open>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="guide-section guide-cta">
        <div>
          <p className="section-kicker">Nächster Schritt</p>
          <h2>Erstelle jetzt deine konkrete Auswertung</h2>
          <p>
            Der Ratgeber erklärt die typischen Wege. Der Check verbindet Zielland, Flughafen, Zeitfenster,
            Dokumentproblem und vorhandene Unterlagen zu einer konkreten Reihenfolge.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={startCheck}>
          Soforthilfe prüfen
        </button>
      </section>

      <section className="more-info-section">
        <p className="section-kicker">Weiterlesen</p>
        <h2>Weitere PassNotfall-Hilfen</h2>
        <div className="info-card-grid">
          <a href={otherMeta.path} onClick={(event) => { event.preventDefault(); navigateTo(otherMeta.path); }}>
            <span>{seoPages[otherRoute].title}</span>
            {otherMeta.description}
          </a>
          <a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>
            <span>Notfallcheck</span>
            Starte die digitale Auswertung für deinen konkreten Fall.
          </a>
          <a href="/#faq">
            <span>Hinweise und FAQ</span>
            Lies die wichtigsten Grenzen und Warnhinweise zur privaten Orientierungshilfe.
          </a>
        </div>
      </section>
    </>
  );
}

type ResultAnswerEditorProps = {
  answers: Answers;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  updateAnswer: (key: SingleAnswerKey, value: string) => void;
  addAffectedPerson: () => void;
  removeAffectedPerson: (id: string) => void;
  updateAffectedPerson: (id: string, key: keyof Omit<AffectedPerson, "id">, value: string) => void;
  toggleDocument: (document: string) => void;
};

type AffectedPeopleEditorProps = {
  people: AffectedPerson[];
  addAffectedPerson: () => void;
  removeAffectedPerson: (id: string) => void;
  updateAffectedPerson: (id: string, key: keyof Omit<AffectedPerson, "id">, value: string) => void;
};

function AffectedPeopleEditor({
  people,
  addAffectedPerson,
  removeAffectedPerson,
  updateAffectedPerson
}: AffectedPeopleEditorProps) {
  return (
    <fieldset className="people-editor">
      <legend>Betroffene Personen</legend>
      <div className="people-list">
        {people.map((person, index) => (
          <article className="person-card" key={person.id}>
            <div className="person-card-header">
              <strong>Person {index + 1}</strong>
              {people.length > 1 && (
                <button type="button" className="text-button" onClick={() => removeAffectedPerson(person.id)}>
                  Entfernen
                </button>
              )}
            </div>
            <div className="person-fields">
              <label>
                <span>Wer ist betroffen?</span>
                <select value={person.label} onChange={(event) => updateAffectedPerson(person.id, "label", event.target.value)}>
                  {personLabelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Alter</span>
                <select value={person.ageGroup} onChange={(event) => updateAffectedPerson(person.id, "ageGroup", event.target.value)}>
                  {personAgeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Problem</span>
                <select value={person.problem} onChange={(event) => updateAffectedPerson(person.id, "problem", event.target.value)}>
                  {documentProblemOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>
      <button type="button" className="secondary-button small add-person-button" onClick={addAffectedPerson}>
        Weitere Person hinzufügen
      </button>
    </fieldset>
  );
}

function LegalInfoModal({ type, onClose }: { type: LegalModal; onClose: () => void }) {
  if (!type) {
    return null;
  }

  const content =
    type === "agb"
      ? {
          title: "AGB",
          body: (
            <>
              <h3>Private Orientierungshilfe</h3>
              <p>
                PassNotfall ist keine Behörde, keine Auslandsvertretung, keine Fluggesellschaft und kein
                autorisierter Aussteller amtlicher Dokumente. Über diese Website werden keine Reisepässe,
                Personalausweise, Visa oder Ersatzdokumente beantragt, verkauft oder ausgestellt.
              </p>
              <h3>Leistung und Preis</h3>
              <p>
                Die kostenpflichtige Leistung besteht in einer digitalen Orientierungshilfe auf Basis deiner
                Eingaben. Der Standardpreis beträgt 49 EUR inkl. MwSt. Die Auswertung ersetzt keine verbindliche
                Auskunft zuständiger Stellen.
              </p>
              <h3>Keine Erfolgsgarantie</h3>
              <p>
                Wir garantieren kein Boarding, keine Einreise, keinen Termin und keine Ausstellung eines
                Ersatzdokuments. Entscheidend bleiben Airline, Behörden, Bundespolizei, Grenzpolizei, Konsulate
                oder andere zuständige Stellen.
              </p>
              <h3>Deine Angaben</h3>
              <p>
                Die Auswertung hängt von deinen Eingaben ab. Falsche, unvollständige oder nachträglich geänderte
                Angaben können zu abweichenden Ergebnissen führen. Kritische Fälle müssen direkt bei Airline oder
                zuständiger Stelle bestätigt werden.
              </p>
              <h3>Rechnung und digitale Leistung</h3>
              <p>
                Für die Rechnungsstellung nutzen wir die angegebenen Rechnungsdaten. Bei Aktivierung eines echten
                Zahlungsanbieters wird die Auswertung erst nach erfolgreicher Zahlungsbestätigung erstellt oder
                freigeschaltet.
              </p>
            </>
          )
        }
      : {
          title: "Datenschutz",
          body: (
            <>
              <h3>Verantwortlicher und Zwecke</h3>
              <p>
                Verantwortlich ist die Flaaq Holding GmbH. Wir verarbeiten deine Check-Eingaben,
                E-Mail-Adresse und Rechnungsdaten zur Erstellung der Auswertung, zur Abwicklung, zur Rechnung und
                zur PDF-Bestätigung.
              </p>
              <h3>Dienstleister</h3>
              <p>
                Hosting läuft über Vercel. Anwendungsdaten können in Supabase gespeichert werden.
                E-Mail-Benachrichtigungen und PDF-Bestätigungen laufen über Resend. Für die Formulierung der
                Auswertung kann ein KI-Dienstleister wie OpenAI eingesetzt werden. Zahlungsdaten können über
                Stripe oder Mollie verarbeitet werden, sobald ein echter Zahlungsprozess aktiv ist.
              </p>
              <h3>Conversion-Tracking</h3>
              <p>
                Statistik und Conversion-Tracking werden nur nach Einwilligung aktiviert. Bei Google-Tags werden
                die Consent-Signale analytics_storage, ad_storage, ad_user_data und ad_personalization zunächst
                abgelehnt und erst nach Einwilligung aktualisiert.
              </p>
              <h3>Rechte</h3>
              <p>
                Du hast Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit,
                Widerspruch und Widerruf erteilter Einwilligungen. Außerdem kannst du dich bei einer
                Datenschutzaufsichtsbehörde beschweren.
              </p>
            </>
          )
        };

  return (
    <div className="legal-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" onClick={(event) => event.stopPropagation()}>
        <p className="section-kicker">{type === "agb" ? "AGB" : "Datenschutz"}</p>
        <h2 id="legal-modal-title">{content.title}</h2>
        <div className="legal-modal-scroll">{content.body}</div>
        <div className="legal-modal-actions">
          <button className="primary-button small" type="button" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </section>
    </div>
  );
}

function ResultAnswerEditor({
  answers,
  isOpen,
  onToggle,
  updateAnswer,
  addAffectedPerson,
  removeAffectedPerson,
  updateAffectedPerson,
  toggleDocument
}: ResultAnswerEditorProps) {
  const choiceSteps = formSteps.filter((step): step is ChoiceStep => step.type === "choice");

  return (
    <section className="result-editor" id="result-editor">
      <details open={isOpen} onToggle={(event) => onToggle(event.currentTarget.open)}>
        <summary>
          <span>
            <strong>Angaben bearbeiten</strong>
            <small>Die Auswertung aktualisiert sich direkt.</small>
          </span>
          <span className="edit-summary-chips" aria-hidden="true">
            <span>{answers.airport}</span>
            <span>{answers.destination}</span>
            <span>{answers.time}</span>
          </span>
        </summary>

        <div className="result-edit-grid">
          <label>
            <span>E-Mail</span>
            <input
              type="email"
              value={answers.customerEmail}
              onChange={(event) => updateAnswer("customerEmail", event.target.value)}
              placeholder="name@example.de"
              autoComplete="email"
            />
          </label>

          {choiceSteps.map((step) => (
            <label key={step.key}>
              <span>{step.eyebrow}</span>
              <select value={answers[step.key]} onChange={(event) => updateAnswer(step.key, event.target.value)}>
                {step.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label>
            <span>Abflug</span>
            <select value={answers.airport} onChange={(event) => updateAnswer("airport", event.target.value)}>
              {airports.map((airport) => (
                <option key={airport.name} value={airport.name}>
                  {airport.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Zielland</span>
            <select value={answers.destination} onChange={(event) => updateAnswer("destination", event.target.value)}>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AffectedPeopleEditor
          people={answers.affectedPersons}
          addAffectedPerson={addAffectedPerson}
          removeAffectedPerson={removeAffectedPerson}
          updateAffectedPerson={updateAffectedPerson}
        />

        <fieldset className="document-editor">
          <legend>Vorhandene Unterlagen</legend>
          <div>
            {formSteps
              .find((step): step is MultiStep => step.type === "multi")
              ?.options.map((option) => (
                <button
                  className={answers.documents.includes(option) ? "choice active" : "choice"}
                  key={option}
                  type="button"
                  onClick={() => toggleDocument(option)}
                >
                  {option}
                </button>
              ))}
          </div>
        </fieldset>
      </details>
    </section>
  );
}

function App() {
  const [answers, setAnswers] = useState(getInitialAnswers);
  const [activeStep, setActiveStep] = useState(0);
  const [view, setView] = useState<View>("start");
  const [route, setRoute] = useState<Route>(() => getRouteFromPath(window.location.pathname));
  const [aiAssessment, setAiAssessment] = useState<AiAssessment | null>(null);
  const [isResultEditorOpen, setIsResultEditorOpen] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationStatus>("idle");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationReference, setConfirmationReference] = useState("");
  const [billingData, setBillingData] = useState(getInitialBillingData);
  const [checkoutConsent, setCheckoutConsent] = useState<CheckoutConsent>({
    agb: false,
    privacy: false,
    digitalWaiver: false
  });
  const [checkoutError, setCheckoutError] = useState("");
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [stripeInvoiceUrl, setStripeInvoiceUrl] = useState("");
  const [stripeInvoiceNumber, setStripeInvoiceNumber] = useState("");
  const [legalModal, setLegalModal] = useState<LegalModal>(null);
  const visibleFormSteps = useMemo(
    () => formSteps.filter((step) => !("shouldShow" in step) || !step.shouldShow || step.shouldShow(answers)),
    [answers]
  );
  const localAssessment = useMemo(() => createAssessment(answers), [answers]);
  const assessment = useMemo(() => mergeAssessment(localAssessment, aiAssessment), [localAssessment, aiAssessment]);
  const currentStep = visibleFormSteps[Math.min(activeStep, visibleFormSteps.length - 1)];
  const progress = Math.round(((Math.min(activeStep, visibleFormSteps.length - 1) + 1) / visibleFormSteps.length) * 100);

  useEffect(() => {
    setActiveStep((step) => Math.min(step, visibleFormSteps.length - 1));
  }, [visibleFormSteps.length]);

  useEffect(() => {
    updatePageMeta(route, view);
  }, [route, view]);

  useEffect(() => {
    function handlePopState() {
      setRoute(getRouteFromPath(window.location.pathname));
      setView("start");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkout === "success" && sessionId) {
      completeStripeCheckout(sessionId);
      return;
    }

    if (checkout === "cancel") {
      const pendingCheckout = readPendingCheckout();

      if (pendingCheckout) {
        setAnswers(pendingCheckout.answers);
        setBillingData(pendingCheckout.billingData);
      }

      window.history.replaceState({}, "", "/");
      setView("checkout");
      setCheckoutError("Zahlung wurde abgebrochen. Deine Rechnungsdaten bleiben im Formular erhalten.");
    }
  }, []);

  useEffect(() => {
    if (view !== "result" || confirmationStatus !== "idle") {
      return;
    }

    sendConfirmationEmail();
  }, [view, confirmationStatus]);

  function navigateTo(path: string) {
    window.history.pushState({}, "", path);
    setRoute(getRouteFromPath(path));
    setView("start");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateAnswer(key: SingleAnswerKey, value: string) {
    setAiAssessment(null);
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateBillingData(key: keyof BillingData, value: string) {
    setCheckoutError("");
    setBillingData((current) => ({ ...current, [key]: value }));
  }

  function addAffectedPerson() {
    setAiAssessment(null);
    setAnswers((current) => {
      const nextIndex = current.affectedPersons.length + 1;

      return {
        ...current,
        affectedPersons: [
          ...current.affectedPersons,
          {
            id: `person-${Date.now()}-${nextIndex}`,
            label: nextIndex === 1 ? "Ich selbst" : "Weitere Person",
            ageGroup: "Erwachsene Person",
            problem: current.affectedPersons[0]?.problem || current.problem
          }
        ]
      };
    });
  }

  function removeAffectedPerson(id: string) {
    setAiAssessment(null);
    setAnswers((current) => {
      const affectedPersons = current.affectedPersons.filter((person) => person.id !== id);
      const nextPersons = affectedPersons.length > 0 ? affectedPersons : current.affectedPersons;

      return {
        ...current,
        problem: nextPersons[0]?.problem || current.problem,
        affectedPersons: nextPersons
      };
    });
  }

  function updateAffectedPerson(id: string, key: keyof Omit<AffectedPerson, "id">, value: string) {
    setAiAssessment(null);
    setAnswers((current) => {
      const affectedPersons = current.affectedPersons.map((person) => {
        if (person.id !== id) {
          return person;
        }

        const nextPerson = { ...person, [key]: value };

        if (key === "label" && value === "Kind" && nextPerson.ageGroup === "Erwachsene Person") {
          nextPerson.ageGroup = "6-11 Jahre";
        }

        return nextPerson;
      });

      return {
        ...current,
        problem: affectedPersons[0]?.problem || current.problem,
        affectedPersons
      };
    });
  }

  function toggleDocument(document: string) {
    setAiAssessment(null);
    setAnswers((current) => {
      const exists = current.documents.includes(document);
      const nextDocuments = exists
        ? current.documents.filter((item) => item !== document)
        : [...current.documents.filter((item) => item !== "Keine Dokumente"), document];

      return {
        ...current,
        documents: document === "Keine Dokumente" ? ["Keine Dokumente"] : nextDocuments
      };
    });
  }

  function startCheck() {
    if (route !== "home") {
      window.history.pushState({}, "", "/");
      setRoute("home");
    }

    setView("form");
    window.setTimeout(() => document.getElementById("check")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function submitForm(nextAnswers: Answers = answers) {
    trackEvent("notfallcheck_form_submit");
    setView("loading");
    window.scrollTo({ top: 0, behavior: "smooth" });

    const startedAt = Date.now();
    const nextLocalAssessment = createAssessment(nextAnswers);

    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers, localAssessment: nextLocalAssessment })
      });

      if (response.ok) {
        const data = await response.json();

        if (data.assessment) {
          setAiAssessment(data.assessment);
        }
      }
    } catch {
      setAiAssessment(null);
    }

    window.setTimeout(() => {
      setIsResultEditorOpen(false);
      setConfirmationStatus("idle");
      setConfirmationMessage("");
      setConfirmationReference("");
      setView("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, Math.max(0, 1100 - (Date.now() - startedAt)));
  }

  async function completeStripeCheckout(sessionId: string) {
    const pendingCheckout = readPendingCheckout();

    window.history.replaceState({}, "", "/");
    setRoute("home");
    setCheckoutError("");
    setView("loading");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!pendingCheckout) {
      setView("checkout");
      setCheckoutError(
        "Zahlung wurde gefunden, aber die lokalen Formularangaben fehlen. Bitte starte den Check auf diesem Gerät erneut oder kontaktiere den Support mit deiner Stripe-Zahlung."
      );
      return;
    }

    try {
      const response = await fetch(`/api/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
      const verifiedSession = (await response.json()) as VerifiedCheckoutSession;

      if (!response.ok || verifiedSession.payment_status !== "paid") {
        throw new Error("Stripe-Zahlung ist nicht bezahlt.");
      }

      if (verifiedSession.reference && verifiedSession.reference !== pendingCheckout.reference) {
        throw new Error("Stripe-Referenz passt nicht zu diesem Checkout.");
      }

      setAnswers(pendingCheckout.answers);
      setBillingData(pendingCheckout.billingData);
      setStripeInvoiceUrl(verifiedSession.invoice?.hosted_invoice_url || verifiedSession.invoice?.invoice_pdf || "");
      setStripeInvoiceNumber(verifiedSession.invoice?.number || "");
      clearPendingCheckout();
      trackEvent("stripe_checkout_paid");
      await submitForm(pendingCheckout.answers);
    } catch {
      setView("checkout");
      setCheckoutError("Die Stripe-Zahlung konnte nicht bestätigt werden. Bitte prüfe die Zahlung oder versuche es erneut.");
    }
  }

  function openCheckout() {
    setCheckoutError("");
    setIsRedirectingToStripe(false);
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiredFields: Array<keyof BillingData> = ["firstName", "lastName", "street", "zip", "city", "country"];
    const missingField = requiredFields.some((field) => !billingData[field].trim());

    if (missingField) {
      setCheckoutError("Bitte fülle alle Pflichtfelder für die Rechnung aus.");
      return;
    }

    if (!answers.customerEmail.trim()) {
      setCheckoutError("Bitte gib im Formular eine E-Mail-Adresse an.");
      return;
    }

    if (!checkoutConsent.agb || !checkoutConsent.privacy || !checkoutConsent.digitalWaiver) {
      setCheckoutError("Bitte bestätige AGB, Datenschutz und den Hinweis zum digitalen Produkt, bevor du fortfährst.");
      return;
    }

    const reference = createCheckoutReference();
    const pendingCheckout: PendingCheckout = {
      reference,
      answers,
      billingData,
      createdAt: Date.now()
    };

    setIsRedirectingToStripe(true);
    setCheckoutError("");
    savePendingCheckout(pendingCheckout);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: answers.customerEmail.trim(),
          billingData,
          answers,
          reference
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.url || !data?.id) {
        throw new Error(data?.error || "Stripe Checkout konnte nicht gestartet werden.");
      }

      savePendingCheckout({ ...pendingCheckout, sessionId: data.id });
      trackEvent("stripe_checkout_started");
      window.location.assign(data.url);
    } catch {
      setIsRedirectingToStripe(false);
      setCheckoutError(
        "Stripe Checkout konnte gerade nicht gestartet werden. Bitte prüfe STRIPE_SECRET_KEY, Live-Modus und Stripe-Konfiguration."
      );
    }
  }

  function goToNextStep() {
    if (activeStep === visibleFormSteps.length - 1) {
      openCheckout();
      return;
    }

    setActiveStep((step) => Math.min(step + 1, visibleFormSteps.length - 1));
  }

  function goToPreviousStep() {
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  function resetCheck() {
    setActiveStep(0);
    setView("form");
    if (route !== "home") {
      window.history.pushState({}, "", "/");
      setRoute("home");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToResultEditor() {
    setIsResultEditorOpen(true);
    window.setTimeout(() => {
      document.getElementById("result-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function sendConfirmationEmail() {
    const email = answers.customerEmail.trim();

    if (!email) {
      setConfirmationStatus("skipped");
      setConfirmationMessage("Keine E-Mail-Adresse angegeben.");
      return;
    }

    setConfirmationStatus("sending");
    setConfirmationMessage("");

    try {
      const response = await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answers, assessment, billingData })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Versand fehlgeschlagen");
      }

      setConfirmationStatus("sent");
      setConfirmationReference(data.reference || "");
      setConfirmationMessage("PDF-Bestätigung wurde automatisch per E-Mail verschickt.");
    } catch {
      setConfirmationStatus("error");
      setConfirmationMessage("Die automatische E-Mail konnte gerade nicht verschickt werden. Bitte Resend-Key und Absender prüfen.");
    }
  }

  if (view === "loading") {
    return (
      <div className="page-shell result-shell">
        <CookieBanner />
        <main className="loading-page" aria-live="polite">
          <div className="loader"></div>
          <p className="section-kicker">Auswertung läuft</p>
          <h1>Wir prüfen deinen Notfallplan.</h1>
          <div className="loading-list">
            {loadingChecks.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (view === "checkout") {
    return (
      <div className="page-shell result-shell">
        <CookieBanner />
        <LegalInfoModal type={legalModal} onClose={() => setLegalModal(null)} />
        <header className="site-header compact">
          <button className="brand reset-button" type="button" onClick={() => navigateTo("/")} aria-label="PassNotfall Startseite">
            <img className="brand-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
          </button>
          <button className="secondary-button small" type="button" onClick={() => setView("form")}>
            Angaben ändern
          </button>
        </header>

        <main className="checkout-page">
          <section className="checkout-panel">
            <div className="checkout-copy">
              <p className="section-kicker">Checkout</p>
              <h1>Rechnungsdaten bestätigen</h1>
              <p>
                Danach erstellen wir deine Auswertung und senden die PDF-Bestätigung automatisch an{" "}
                <strong>{answers.customerEmail || "deine E-Mail-Adresse"}</strong>.
              </p>
              <div className="checkout-price">
                <span>Standardpreis</span>
                <strong>49 EUR</strong>
                <small>inkl. MwSt.</small>
              </div>
              <div className="stripe-methods-note">
                <strong>Live-Zahlung über Stripe</strong>
                <span>
                  Im nächsten Schritt zeigt Stripe alle für dein Land, Gerät und die Währung verfügbaren sowie im
                  Stripe-Dashboard aktivierten Zahlungsarten an. Die Rechnung wird nach erfolgreicher Zahlung über
                  Stripe erstellt.
                </span>
              </div>
            </div>

            <form className="checkout-form" onSubmit={submitCheckout}>
              <div className="checkout-grid">
                <label>
                  <span>Vorname *</span>
                  <input value={billingData.firstName} onChange={(event) => updateBillingData("firstName", event.target.value)} autoComplete="given-name" />
                </label>
                <label>
                  <span>Nachname *</span>
                  <input value={billingData.lastName} onChange={(event) => updateBillingData("lastName", event.target.value)} autoComplete="family-name" />
                </label>
                <label className="full-field">
                  <span>Firma optional</span>
                  <input value={billingData.company} onChange={(event) => updateBillingData("company", event.target.value)} autoComplete="organization" />
                </label>
                <label className="full-field">
                  <span>Straße und Hausnummer *</span>
                  <input value={billingData.street} onChange={(event) => updateBillingData("street", event.target.value)} autoComplete="street-address" />
                </label>
                <label>
                  <span>PLZ *</span>
                  <input value={billingData.zip} onChange={(event) => updateBillingData("zip", event.target.value)} autoComplete="postal-code" />
                </label>
                <label>
                  <span>Ort *</span>
                  <input value={billingData.city} onChange={(event) => updateBillingData("city", event.target.value)} autoComplete="address-level2" />
                </label>
                <label className="full-field">
                  <span>Land *</span>
                  <input value={billingData.country} onChange={(event) => updateBillingData("country", event.target.value)} autoComplete="country-name" />
                </label>
              </div>

              <div className="checkout-consents">
                <label>
                  <input
                    type="checkbox"
                    checked={checkoutConsent.agb}
                    onChange={(event) => {
                      setCheckoutError("");
                      setCheckoutConsent((current) => ({ ...current, agb: event.target.checked }));
                    }}
                  />
                  <span>
                    Ich akzeptiere die{" "}
                    <button type="button" onClick={() => setLegalModal("agb")}>
                      AGB
                    </button>
                    .
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={checkoutConsent.privacy}
                    onChange={(event) => {
                      setCheckoutError("");
                      setCheckoutConsent((current) => ({ ...current, privacy: event.target.checked }));
                    }}
                  />
                  <span>
                    Ich habe die{" "}
                    <button type="button" onClick={() => setLegalModal("privacy")}>
                      Datenschutzhinweise
                    </button>{" "}
                    gelesen.
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={checkoutConsent.digitalWaiver}
                    onChange={(event) => {
                      setCheckoutError("");
                      setCheckoutConsent((current) => ({ ...current, digitalWaiver: event.target.checked }));
                    }}
                  />
                  <span>
                    Ich stimme ausdrücklich zu, dass PassNotfall vor Ablauf der Widerrufsfrist mit der
                    Bereitstellung der digitalen Auswertung und PDF-Bestätigung beginnt. Mir ist bekannt, dass
                    mein Widerrufsrecht bei einem digitalen Produkt nach § 356 Abs. 5 BGB mit Beginn der
                    Ausführung erlöschen kann.
                  </span>
                </label>
              </div>

              {checkoutError && <p className="checkout-error">{checkoutError}</p>}

              <button className="primary-button full" type="submit" disabled={isRedirectingToStripe}>
                {isRedirectingToStripe ? "Weiterleitung zu Stripe..." : "Jetzt zahlungspflichtig zu Stripe"}
              </button>
              <small className="checkout-note">
                Private Orientierungshilfe. Keine Behörde und kein amtliches Dokument. Zahlung, Zahlungsarten und
                Rechnung laufen über Stripe.
              </small>
            </form>
          </section>
        </main>
      </div>
    );
  }

  if (view === "result") {
    return (
      <div className="page-shell result-shell">
        <CookieBanner />
        <header className="site-header compact">
          <button className="brand reset-button" type="button" onClick={() => navigateTo("/")} aria-label="PassNotfall Startseite">
            <img className="brand-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
          </button>
          <button className="header-cta" type="button" onClick={scrollToResultEditor}>
            Angaben bearbeiten
          </button>
        </header>

        <main className="result-page">
          <section className="result-hero">
            <div>
              <p className="section-kicker">Dein Ergebnis</p>
              <h1>{assessment.headline}</h1>
              <p className="result-verdict">{assessment.verdict}</p>
            </div>
            <div className={`risk-card risk-${assessment.risk.toLowerCase().replace(/\s+/g, "-")}`}>
              <span>Risiko</span>
              <strong>{assessment.risk}</strong>
            </div>
          </section>

          <section className="now-panel">
            <p className="section-kicker">Jetzt sofort machen</p>
            <h2>{assessment.primaryAction}</h2>
            <ol className="action-list">
              {assessment.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="person-result-panel">
            <p className="section-kicker">Betroffene Personen</p>
            <h2>Dokumentproblem je Person</h2>
            <div className="person-result-list">
              {assessment.personNotices.map((notice) => (
                <article key={notice.title}>
                  <h3>{notice.title}</h3>
                  <p>{notice.text}</p>
                  <ul>
                    {notice.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {confirmationMessage && (
            <section className={`email-status-panel ${confirmationStatus}`}>
              <p className="section-kicker">E-Mail-Bestätigung</p>
              <h2>{confirmationStatus === "sent" ? "PDF wurde verschickt" : "E-Mail-Hinweis"}</h2>
              <p>
                {confirmationMessage}
                {confirmationReference ? ` Referenz: ${confirmationReference}` : ""}
              </p>
            </section>
          )}

          {stripeInvoiceUrl && (
            <section className="email-status-panel sent">
              <p className="section-kicker">Stripe Rechnung</p>
              <h2>{stripeInvoiceNumber ? `Rechnung ${stripeInvoiceNumber}` : "Rechnung wurde erstellt"}</h2>
              <p>
                Die Rechnung wurde nach der erfolgreichen Zahlung über Stripe erstellt.{" "}
                <a href={stripeInvoiceUrl} target="_blank" rel="noreferrer">
                  Rechnung öffnen
                </a>
              </p>
            </section>
          )}

          <ResultAnswerEditor
            answers={answers}
            isOpen={isResultEditorOpen}
            onToggle={setIsResultEditorOpen}
            updateAnswer={updateAnswer}
            addAffectedPerson={addAffectedPerson}
            removeAffectedPerson={removeAffectedPerson}
            updateAffectedPerson={updateAffectedPerson}
            toggleDocument={toggleDocument}
          />

          <section className="result-columns">
            <article>
              <h3>Zuständige Stelle</h3>
              <p>
                <strong>{assessment.airport.office}</strong>
                <br />
                {assessment.airport.address}
                <br />
                Telefon: <a href={`tel:${assessment.airport.phone.replace(/[^\d+]/g, "")}`}>{assessment.airport.phone}</a>
                <br />
                Hinweis: {assessment.airport.note}
              </p>
            </article>
            <article>
              <h3>Empfohlener Weg</h3>
              <p>{assessment.route}</p>
            </article>
            <article>
              <h3>Einpacken</h3>
              <ul>
                {assessment.documents.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Wichtig</h3>
              <ul>
                {assessment.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>PassNotfall ist ein privater Anbieter und keine staatliche Website.</li>
              </ul>
            </article>
          </section>
        </main>
      </div>
    );
  }

  if (route !== "home") {
    return (
      <div className="page-shell">
        <CookieBanner />
        <header className="site-header">
          <button className="brand reset-button" type="button" onClick={() => navigateTo("/")} aria-label="PassNotfall Startseite">
            <img className="brand-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
          </button>
          <nav className="desktop-nav" aria-label="Hauptnavigation">
            <a href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>
              Startseite
            </a>
            <a href="/reisepass-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/reisepass-abgelaufen"); }}>
              Reisepass abgelaufen
            </a>
            <a href="/personalausweis-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/personalausweis-abgelaufen"); }}>
              Personalausweis abgelaufen
            </a>
            <button type="button" onClick={startCheck}>Check starten</button>
          </nav>
          <button className="header-cta" type="button" onClick={startCheck}>
            Jetzt prüfen
          </button>
        </header>

        <main>
          {isLegalRoute(route) && <LegalPage route={route} />}
          {isSeoRoute(route) && <SeoPage route={route} startCheck={startCheck} navigateTo={navigateTo} />}
        </main>

        <footer className="site-footer">
          <div>
            <img className="footer-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
            <p>Private kostenpflichtige Orientierungshilfe bei Reisepass-, Ausweis- und Dokumentproblemen.</p>
          </div>
          <div className="footer-links">
            <button type="button" onClick={startCheck}>Notfallcheck starten</button>
            <a href="/reisepass-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/reisepass-abgelaufen"); }}>
              Reisepass abgelaufen
            </a>
            <a href="/personalausweis-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/personalausweis-abgelaufen"); }}>
              Personalausweis abgelaufen
            </a>
            <a href="/impressum" onClick={(event) => { event.preventDefault(); navigateTo("/impressum"); }}>
              Impressum
            </a>
            <a href="/datenschutz" onClick={(event) => { event.preventDefault(); navigateTo("/datenschutz"); }}>
              Datenschutz
            </a>
            <a href="/agb" onClick={(event) => { event.preventDefault(); navigateTo("/agb"); }}>
              AGB
            </a>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <CookieBanner />
      <header className="site-header">
        <button className="brand reset-button" type="button" onClick={() => navigateTo("/")} aria-label="PassNotfall Startseite">
          <img className="brand-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
        </button>
        <nav className="desktop-nav" aria-label="Hauptnavigation">
          <a href="#check">Check</a>
          <a href="#ablauf">Ablauf</a>
          <a href="/reisepass-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/reisepass-abgelaufen"); }}>
            Reisepass
          </a>
          <a href="/personalausweis-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/personalausweis-abgelaufen"); }}>
            Ausweis
          </a>
          <a href="#faq">Hinweise</a>
        </nav>
        <button className="header-cta" type="button" onClick={startCheck}>
          Jetzt prüfen
        </button>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="trust-row" aria-label="Vertrauenssignale">
              <span>+25 tägliche Hilfen</span>
              <span>+2.500 Kunden unterstützt</span>
              <span>PDF per E-Mail</span>
            </div>
            <h1>Reisepass oder Personalausweis abgelaufen?</h1>
            <p className="hero-subtitle">
              Beantworte kurz die Fragen. Danach lädt deine Auswertung und zeigt dir auf einer eigenen
              Ergebnis-Seite, wen du anrufen solltest, wohin du gehen musst und welche Unterlagen du brauchst.
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={startCheck}>
                Jetzt Soforthilfe starten
              </button>
            </div>
          </div>
        </section>

        <section className={view === "form" ? "checker-section visible" : "checker-section"} id="check">
          <div className="checker-card">
            <div className="progress-top">
              <span>
                Schritt {Math.min(activeStep, visibleFormSteps.length - 1) + 1} von {visibleFormSteps.length}
              </span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-bar" aria-hidden="true">
              <span style={{ width: `${progress}%` }}></span>
            </div>

            <div className="step-header">
              <p>{currentStep.eyebrow}</p>
              <h3>{currentStep.question}</h3>
            </div>

            <div className="step-body">
              {currentStep.type === "choice" &&
                currentStep.options.map((option) => (
                  <button
                    className={answers[currentStep.key] === option ? "choice active" : "choice"}
                    key={option}
                    type="button"
                    onClick={() => updateAnswer(currentStep.key, option)}
                  >
                    {option}
                  </button>
                ))}

              {currentStep.type === "airport" && (
                <select
                  value={answers.airport}
                  onChange={(event) => updateAnswer("airport", event.target.value)}
                  aria-label="Flughafen auswählen"
                >
                  {airports.map((airport) => (
                    <option key={airport.name} value={airport.name}>
                      {airport.name}
                    </option>
                  ))}
                </select>
              )}

              {currentStep.type === "country" && (
                <select
                  value={answers.destination}
                  onChange={(event) => updateAnswer("destination", event.target.value)}
                  aria-label="Zielland auswählen"
                >
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              )}

              {currentStep.type === "multi" &&
                currentStep.options.map((option) => (
                  <button
                    className={answers.documents.includes(option) ? "choice active" : "choice"}
                    key={option}
                    type="button"
                    onClick={() => toggleDocument(option)}
                  >
                    {option}
                  </button>
                ))}

              {currentStep.type === "people" && (
                <AffectedPeopleEditor
                  people={answers.affectedPersons}
                  addAffectedPerson={addAffectedPerson}
                  removeAffectedPerson={removeAffectedPerson}
                  updateAffectedPerson={updateAffectedPerson}
                />
              )}

              {currentStep.type === "email" && (
                <label className="email-step">
                  <span>E-Mail-Adresse</span>
                  <input
                    type="email"
                    value={answers.customerEmail}
                    onChange={(event) => updateAnswer("customerEmail", event.target.value)}
                    placeholder="name@example.de"
                    autoComplete="email"
                  />
                  <small>
                    Nach der Auswertung senden wir die PDF-Bestätigung automatisch an diese Adresse. Kein amtliches
                    Dokument.
                  </small>
                </label>
              )}
            </div>

            <div className="step-actions">
              <button type="button" className="secondary-button small" onClick={goToPreviousStep} disabled={activeStep === 0}>
                Zurück
              </button>
              <button type="button" className="primary-button small" onClick={goToNextStep}>
                {activeStep === visibleFormSteps.length - 1 ? "Formular abschicken" : "Weiter"}
              </button>
            </div>
          </div>
        </section>

        <section className="info-strip" aria-label="Wichtige Hinweise">
          {legalHighlights.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>

        <section className="flow-section" id="ablauf">
          <p className="section-kicker">Ablauf</p>
          <h2>Ablauf für die Hilfe</h2>
          <div className="timeline">
            <div>
              <span>1</span>
              <h3>Fragen beantworten</h3>
              <p>Du gibst Standort, Flughafen, Zielland, Zeitfenster und Dokumentproblem ein.</p>
            </div>
            <div>
              <span>2</span>
              <h3>Formular abschicken</h3>
              <p>Nach dem letzten Schritt lädt die Auswertung. Du siehst, dass der Notfallplan erstellt wird.</p>
            </div>
            <div>
              <span>3</span>
              <h3>Ergebnis-Seite nutzen</h3>
              <p>Oben steht direkt, was als Nächstes zu tun ist. Darunter folgen Stelle, Telefonnummer, Unterlagen und Warnhinweise.</p>
            </div>
          </div>
        </section>

        <section className="topic-section" aria-labelledby="situationen-heading">
          <p className="section-kicker">Typische Situationen</p>
          <h2 id="situationen-heading">Passproblem kurz vor Abflug richtig einordnen</h2>
          <div className="topic-grid">
            <article>
              <h3>Reisepass abgelaufen</h3>
              <p>
                Wenn dein Reisepass abgelaufen ist, zählt zuerst das Zielland. Für viele Drittstaaten brauchst du
                einen gültigen Reisepass oder ein akzeptiertes Ersatzdokument.
              </p>
              <a href="/reisepass-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/reisepass-abgelaufen"); }}>
                Ratgeber lesen
              </a>
            </article>
            <article>
              <h3>Personalausweis abgelaufen</h3>
              <p>
                Ein abgelaufener Ausweis kann für Reise, Hotel, Mietwagen oder Legitimation problematisch werden.
                Entscheidend ist, welche Stelle den Nachweis akzeptieren muss.
              </p>
              <a href="/personalausweis-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/personalausweis-abgelaufen"); }}>
                Ratgeber lesen
              </a>
            </article>
            <article>
              <h3>Dokument vergessen oder verloren</h3>
              <p>
                Ohne gültiges Dokument brauchst du eine klare Reihenfolge: vorhandene Nachweise sammeln, Airline
                informieren und zuständige Stelle vorab kontaktieren.
              </p>
              <button type="button" onClick={startCheck}>Fall prüfen</button>
            </article>
          </div>
        </section>

        <section className="seo-section" aria-labelledby="seo-heading">
          <p className="section-kicker">Soforthilfe</p>
          <h2 id="seo-heading">Reisepass abgelaufen oder Personalausweis abgelaufen?</h2>
          <div className="seo-copy">
            <p>
              Wenn der Reisepass abgelaufen ist und der Flug bald startet, zählt vor allem die richtige
              Reihenfolge: Zielland prüfen, Airline kontaktieren, zuständige Flughafen-Stelle klären und alle
              vorhandenen Nachweise bereithalten. PassNotfall sortiert diese Schritte anhand deiner Angaben.
            </p>
            <p>
              Auch wenn der Personalausweis abgelaufen ist, hängt die Lösung vom Reiseziel, deiner
              Staatsangehörigkeit, dem Zeitfenster und den vorhandenen Unterlagen ab. Der Check zeigt dir, ob der
              Weg eher über Airline, Flughafen-Stelle oder Passbehörde laufen sollte.
            </p>
            <p>
              Bei Kindern, Namensabweichungen, beschädigten Dokumenten oder verlorenem Pass kann dieselbe Reise
              ganz anders bewertet werden. Deshalb fragt PassNotfall betroffene Personen und konkrete
              Dokumentprobleme getrennt ab.
            </p>
            <p>
              Die Auswertung nennt keine amtliche Garantie. Sie hilft dir, die nächsten Telefonate und Wege zu
              priorisieren, damit du nicht wertvolle Zeit mit der falschen Stelle verlierst.
            </p>
          </div>
        </section>

        <section className="airport-section" aria-labelledby="airports-heading">
          <div>
            <p className="section-kicker">Flughäfen</p>
            <h2 id="airports-heading">Deutschlandweite Orientierung für wichtige Abflughäfen</h2>
            <p>
              Der Check enthält große deutsche Flughäfen und zeigt dir die passende Stelle aus deinen Angaben.
              Adressen und Telefonnummern werden direkt in der Ergebnis-Seite angezeigt.
            </p>
          </div>
          <div className="airport-list" aria-label="Unterstützte Flughäfen">
            {airports.slice(0, 12).map((airport) => (
              <span key={airport.name}>{airport.name}</span>
            ))}
          </div>
        </section>

        <section className="document-section" aria-labelledby="documents-heading">
          <p className="section-kicker">Unterlagen</p>
          <h2 id="documents-heading">Was du im Notfall bereithalten solltest</h2>
          <div className="document-grid">
            <article>
              <h3>Reisedaten</h3>
              <p>Ticket, Buchungsbestätigung, Flugnummer, Ziel, Umstieg und Abflugzeit helfen bei der schnellen Einordnung.</p>
            </article>
            <article>
              <h3>Identitätsnachweise</h3>
              <p>Alle vorhandenen Reisepässe, Personalausweise, Führerschein, Geburtsurkunde oder Meldebescheinigung mitnehmen.</p>
            </article>
            <article>
              <h3>Für Kinder</h3>
              <p>Zusätzlich Geburtsurkunde, Ausweise der Sorgeberechtigten und Zustimmungserklärung prüfen und einpacken.</p>
            </article>
            <article>
              <h3>Für Behördenwege</h3>
              <p>Biometrisches Passfoto, Zahlungsmittel und Nachweise zur Dringlichkeit vorbereiten.</p>
            </article>
          </div>
        </section>

        <section className="faq-section" id="faq">
          <p className="section-kicker">Hinweise</p>
          <h2>Wichtig bei Passproblemen vor dem Flug.</h2>
          <div className="faq-grid">
            <details open>
              <summary>Kann die Bundespolizei immer helfen?</summary>
              <p>Nein. Ersatzdokumente sind vom Einzelfall, Zielland und der Airline abhängig.</p>
            </details>
            <details>
              <summary>Reicht ein Personalausweis?</summary>
              <p>In vielen europäischen Ländern kann ein gültiger Personalausweis reichen. Für andere Ziele oft nicht.</p>
            </details>
            <details>
              <summary>Was ist bei Kindern anders?</summary>
              <p>Bei Kindern können Zustimmung der Sorgeberechtigten, Geburtsurkunde und weitere Nachweise nötig sein.</p>
            </details>
            <details>
              <summary>Ist die Auswertung verbindlich?</summary>
              <p>Nein. Kritische Fälle müssen immer bei Airline, Behörde, Bundespolizei oder Konsulat bestätigt werden.</p>
            </details>
            <details>
              <summary>Was passiert nach dem Formular?</summary>
              <p>Du erhältst eine strukturierte Ergebnis-Seite mit nächstem Schritt, zuständiger Stelle, Unterlagen und Warnhinweisen.</p>
            </details>
            <details>
              <summary>Warum wird das Zielland abgefragt?</summary>
              <p>Weil Reisedokumente je nach Ziel unterschiedlich bewertet werden können. Ein Ausweis kann für ein Ziel reichen und für ein anderes nicht.</p>
            </details>
          </div>
        </section>

        <section className="disclaimer-section">
          <h2>Wichtiger Hinweis zur Einordnung</h2>
          <p>
            PassNotfall ist eine private Orientierungshilfe. Die Seite ersetzt keine amtliche Auskunft und stellt
            keine Reisepässe, Personalausweise, Visa oder Ersatzdokumente aus. Verbindlich entscheiden Airline,
            Behörden, Bundespolizei, Grenzpolizei, Konsulate oder Grenzstellen.
          </p>
        </section>

      </main>

      <footer className="site-footer">
        <div>
          <img className="footer-logo" src="/Logo_Passnotfall.png" alt="PassNotfall" />
          <p>Digitale Soforthilfe bei Reisepass-, Ausweis- und Dokumentproblemen.</p>
        </div>
        <div className="footer-links">
          <button type="button" onClick={startCheck}>Notfallcheck starten</button>
          <a href="#faq">Hinweise</a>
          <a href="/reisepass-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/reisepass-abgelaufen"); }}>
            Reisepass abgelaufen
          </a>
          <a href="/personalausweis-abgelaufen" onClick={(event) => { event.preventDefault(); navigateTo("/personalausweis-abgelaufen"); }}>
            Personalausweis abgelaufen
          </a>
          <a href="/impressum" onClick={(event) => { event.preventDefault(); navigateTo("/impressum"); }}>
            Impressum
          </a>
          <a href="/datenschutz" onClick={(event) => { event.preventDefault(); navigateTo("/datenschutz"); }}>
            Datenschutz
          </a>
          <a href="/agb" onClick={(event) => { event.preventDefault(); navigateTo("/agb"); }}>
            AGB
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;

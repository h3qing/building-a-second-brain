/**
 * Single source of truth for everything the site says.
 *
 * Facts below (name, phone, address, email, education, bar membership,
 * practice areas) are transcribed from the firm's existing website and are
 * real. Prose marked `newCopy` was written for this redesign and should be
 * reviewed by the attorney before launch — both for accuracy and because
 * California's Rules of Professional Conduct 7.1-7.5 govern what a law firm
 * may say in its own advertising.
 */

export const firm = {
  name: "Law Offices of Jerry Wang",
  shortName: "Jerry Wang Law",
  tagline: "Effective Legal Solutions With Precision and Compassion",
  establishedNotice: "Copyright 2011", // original site's footer; year is rendered dynamically now
} as const;

export const contact = {
  phoneDisplay: "(626) 447-8868",
  phoneHref: "tel:+16264478868",
  email: "info@jerrywanglaw.com",
  emailHref: "mailto:info@jerrywanglaw.com",
  street: "630 W. Duarte Rd., Suite 300",
  city: "Arcadia",
  state: "California",
  stateAbbr: "CA",
  zip: "91007",
  building: "American Plus Bank Building, 3rd floor",
  mapsHref:
    "https://www.google.com/maps/search/?api=1&query=630+W+Duarte+Rd+Suite+300+Arcadia+CA+91007",
  // The existing site does not publish office hours. Left out rather than
  // invented — worth adding, since "are they open now?" is a common reason
  // someone leaves a law firm's site.
  hours: null as string | null,
  languages: ["English", "Mandarin Chinese"],
} as const;

export const consultation = {
  headline: "Free 30-minute consultation",
  // Transcribed from the existing homepage.
  promise:
    "We offer a free initial consultation with no obligations. You may be surprised to find out that having an attorney can be affordable.",
} as const;

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export const nav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Practice Areas", href: "/practice-areas" },
  { label: "Attorney", href: "/attorney" },
  { label: "Contact", href: "/contact" },
];

export type PracticeArea = {
  slug: string;
  title: string;
  /** Short label for tight spaces like the mega menu. */
  shortTitle: string;
  /** One line, used on cards and in the menu. */
  blurb: string;
  /** Opening paragraph on the detail page. `newCopy` */
  intro: string;
  /** What the firm handles in this area. `newCopy` */
  services: string[];
  /** Illustration key — see components/Illustrations.tsx */
  art: string;
  /**
   * The area's own colour, drawn from the furniture palette. Each practice
   * area is colour-blocked the way Alexander Girard blocked a textile range:
   * one hand, seven distinct chips.
   */
  accent: string;
};

export const practiceAreas: PracticeArea[] = [
  {
    slug: "business-law",
    title: "Business Law",
    shortTitle: "Business Law",
    blurb: "Formation, contracts, and the agreements a company runs on.",
    intro:
      "Most business disputes are written months or years before anyone argues about them — in a contract nobody read closely, or an agreement nobody wrote down at all. We help business owners get those documents right at the start, and work through them when something goes wrong.",
    services: [
      "Business formation — corporations, LLCs, and partnerships",
      "Operating agreements, bylaws, and partnership agreements",
      "Contract drafting, review, and negotiation",
      "Purchase and sale of a business",
      "Commercial lease review",
      "Shareholder, partner, and member disputes",
    ],
    art: "business",
    accent: "var(--teal)",
  },
  {
    slug: "civil-litigation",
    title: "Civil Litigation",
    shortTitle: "Civil Litigation",
    blurb: "Disputes that have reached the point of a lawsuit.",
    intro:
      "Litigation is the part of the law most people picture and least want to be in. When a dispute cannot be resolved any other way, it helps to have someone who can tell you plainly what the case is worth, what it will cost, and how long it is likely to take.",
    services: [
      "Breach of contract claims and defense",
      "Business and commercial disputes",
      "Collections and debt claims",
      "Fraud and misrepresentation claims",
      "Property and boundary disputes",
      "Settlement negotiation and alternative dispute resolution",
    ],
    art: "litigation",
    accent: "var(--cognac)",
  },
  {
    slug: "personal-injury",
    title: "Personal Injury",
    shortTitle: "Personal Injury",
    blurb: "Recovery after an accident caused by someone else.",
    intro:
      "After an injury, the other side's insurer starts building its file immediately — and it is not building it for you. We handle the claim, the adjusters, and the paperwork so you can concentrate on recovering.",
    services: [
      "Automobile, motorcycle, and pedestrian accidents",
      "Slip-and-fall and premises liability",
      "Dog bites and animal attacks",
      "Wrongful death claims",
      "Insurance claim negotiation",
      "Medical bill and lien resolution",
    ],
    art: "injury",
    accent: "var(--persimmon)",
  },
  {
    slug: "family-law",
    title: "Divorce & Family Law",
    shortTitle: "Divorce & Family Law",
    blurb: "Dissolution, custody, and support — handled with care.",
    intro:
      "Family matters are the cases where the law and a person's actual life are hardest to separate. The legal questions are usually answerable; the difficult part is getting to an arrangement you can still live with in five years. We aim for that.",
    services: [
      "Dissolution of marriage and legal separation",
      "Child custody and visitation",
      "Child and spousal support",
      "Division of community property",
      "Marital settlement agreements",
      "Modification of existing orders",
    ],
    art: "family",
    accent: "var(--teak)",
  },
  {
    slug: "prenuptial-agreements",
    title: "Prenuptial Agreements",
    shortTitle: "Prenuptial Agreements",
    blurb: "Drafting and review, before the wedding.",
    intro:
      "A prenuptial agreement is an ordinary piece of planning that is easiest to do well when nobody is under pressure. California has specific requirements for these agreements — including independent counsel and a waiting period — and an agreement that ignores them may not hold up when it matters.",
    services: [
      "Drafting premarital agreements",
      "Independent review of an agreement drafted by the other side",
      "Postnuptial agreements",
      "Disclosure of assets and debts",
      "Advice on enforceability under California law",
    ],
    art: "prenuptial",
    accent: "var(--olive)",
  },
  {
    slug: "real-estate-law",
    title: "Real Estate Law",
    shortTitle: "Real Estate Law",
    blurb: "Purchases, sales, leases, and disputes over property.",
    intro:
      "For most people a property is the largest transaction of their life, and it is governed by documents written to be skimmed. We read them properly — before signing, and after, when a dispute arises.",
    services: [
      "Purchase and sale agreements",
      "Residential and commercial leases",
      "Title and escrow issues",
      "Landlord-tenant disputes and unlawful detainer",
      "Easement and boundary disputes",
      "Non-disclosure and construction defect claims",
    ],
    art: "realestate",
    accent: "var(--ochre)",
  },
  {
    slug: "criminal-law",
    title: "Criminal Law",
    shortTitle: "Criminal Law",
    blurb: "Restraining orders and DUI matters.",
    intro:
      "A criminal charge or a restraining order affects far more than the case itself — it reaches your licence, your job, and your family. These matters move on the court's schedule, not yours, so the earlier you have representation the more can be done.",
    services: [
      "DUI and driving-related offenses",
      "DMV administrative hearings",
      "Restraining orders — petitioning and defending",
      "Domestic violence matters",
      "Misdemeanour defense",
      "Expungement and record relief",
    ],
    art: "criminal",
    accent: "var(--walnut)",
  },
];

export const attorney = {
  name: "Jerry Wang",
  postNominal: "Esq.",
  role: "Attorney at Law",
  education: [
    {
      school: "University of Southern California (USC)",
      detail: "International Relations & Political Science",
    },
    {
      school: "Western State University",
      detail: "Juris Doctor (J.D.)",
    },
  ],
  memberships: [
    "The State Bar of California",
    "American Bar Association, Business Law Section",
  ],
  languages: ["English", "Mandarin Chinese"],
} as const;

/**
 * Transcribed verbatim from the firm's existing homepage. These are the
 * client's own words and carry the practice's voice, so they are kept.
 */
export const legacyCopy = {
  mission:
    "At the Law Offices of Jerry Wang, whether we are helping to guide a business towards success or seeking justice for an injured victim, we always keep in mind that our clients are people. The legal services we provide benefit the lives of people, and that is the driving force of our excellence.",
  invitation:
    "Make an appointment to let us introduce ourselves and our services to you. Find out more about how we can serve your legal needs.",
  unsure:
    "If you are unsure whether you need an attorney, or whether we practice in the area you need representation in — call or email us. We are here to help.",
  bilingual:
    "Our staff is bilingual and flexible about how you prefer to be reached. Text, email, or fax — whichever is easiest for you.",
} as const;

export const reasons = [
  {
    title: "Free 30-minute consultation",
    body: "No obligation, and no charge. Bring your documents and your questions.",
  },
  {
    title: "Seven practice areas",
    body: "Business, litigation, injury, family, prenuptial, real estate, and criminal matters — in one office.",
  },
  {
    title: "Flexible billing",
    body: "Hourly, flat fee, or contingency where appropriate. We will tell you which applies before you commit.",
  },
  {
    title: "Bilingual office",
    body: "English and Mandarin Chinese, by phone, text, email, or fax.",
  },
] as const;

export const site = {
  url: "https://www.jerrywanglaw.com",
  title: `${firm.name} — Arcadia, California`,
  description: `${firm.tagline}. Business, litigation, personal injury, family, real estate and criminal matters in Arcadia, CA. Free 30-minute consultation — ${contact.phoneDisplay}.`,
} as const;

export const disclaimer = {
  short:
    "The information on this website is for general purposes only and is not legal advice.",
  long: [
    "The information on this website is provided for general informational purposes only and does not constitute legal advice. Every matter is different, and nothing here should be relied on as advice about your particular situation.",
    "Viewing this site, contacting the firm through it, or sending information by email does not create an attorney-client relationship. That relationship is formed only by a written agreement signed by both you and the firm. Please do not send confidential information until such an agreement is in place.",
    "Prior results do not guarantee a similar outcome. Any description of past matters or areas of practice is not a promise or prediction about your case.",
    "This website may be considered attorney advertising under the California Rules of Professional Conduct.",
  ],
} as const;

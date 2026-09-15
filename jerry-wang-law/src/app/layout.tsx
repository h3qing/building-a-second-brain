import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileCallBar } from "@/components/MobileCallBar";
import { attorney, contact, firm, site } from "@/content/site";
import "./globals.css";

/**
 * Bodoni for display, Jost for everything else.
 *
 * Didone and geometric sans is the canonical modernist pairing — Vignelli's
 * Bodoni-and-Futura. The Bodoni carries the engraved, institutional weight a
 * law firm needs; Jost is a Futura revival and supplies the mid-century
 * structure in the navigation, labels, and body.
 */
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s — ${firm.name}`,
  },
  description: site.description,
  openGraph: {
    title: site.title,
    description: site.description,
    url: site.url,
    siteName: firm.name,
    locale: "en_US",
    type: "website",
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

/**
 * Structured data, so search engines and maps can read the firm's details
 * directly rather than inferring them. This is the single highest-leverage
 * piece of SEO for a practice that depends on local search.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  name: firm.name,
  description: site.description,
  url: site.url,
  telephone: contact.phoneDisplay,
  email: contact.email,
  slogan: firm.tagline,
  address: {
    "@type": "PostalAddress",
    streetAddress: contact.street,
    addressLocality: contact.city,
    addressRegion: contact.stateAbbr,
    postalCode: contact.zip,
    addressCountry: "US",
  },
  availableLanguage: contact.languages,
  founder: {
    "@type": "Person",
    name: attorney.name,
    jobTitle: attorney.role,
    alumniOf: attorney.education.map((entry) => ({
      "@type": "EducationalOrganization",
      name: entry.school,
    })),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bodoni.variable} ${jost.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <MobileCallBar />
      </body>
    </html>
  );
}

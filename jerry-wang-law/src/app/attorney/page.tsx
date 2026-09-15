import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Monogram, PhoneMark } from "@/components/Illustrations";
import {
  attorney,
  contact,
  firm,
  legacyCopy,
  practiceAreas,
} from "@/content/site";

export const metadata: Metadata = {
  title: "Attorney",
  description:
    "Jerry Wang, Esq., Attorney at Law. University of Southern California; Western State University, Juris Doctor. State Bar of California; American Bar Association, Business Law Section. English and Mandarin Chinese.",
};

export default function AttorneyPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Attorney</span>
          </nav>
          <h1 className="display display-xl page-head__title">
            {attorney.name}, {attorney.postNominal}
          </h1>
          <p className="lede page-head__lede">{attorney.role}</p>
          <hr className="rule-pair page-head__rule" />
        </div>
      </section>

      <section className="section--tight">
        <div className="container bio">
          <div className="bio__main prose">
            <Reveal>
              <p className="detail__intro">{legacyCopy.mission}</p>
            </Reveal>
            <Reveal>
              <p>{legacyCopy.bilingual}</p>
              <p>{legacyCopy.unsure}</p>
            </Reveal>
          </div>

          <Reveal className="bio__portrait" delay={100}>
            {/* No photograph on file; the monogram holds the space with more
                dignity than a stock image would. */}
            <div className="bio__plate">
              <Monogram className="bio__plate-mark" />
              <p className="bio__plate-name">{firm.name}</p>
              <p className="bio__plate-suite">Suite 300</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section--tight on-dark creds">
        <span className="screen screen--top" aria-hidden="true" />
        <div className="container creds__inner">
          <Reveal>
            <p className="eyebrow">Credentials</p>
          </Reveal>

          <div className="creds__grid">
            <Reveal className="creds__block">
              <h2 className="creds__heading">Education</h2>
              <ul className="creds__list">
                {attorney.education.map((entry) => (
                  <li key={entry.school}>
                    <strong>{entry.school}</strong>
                    <span>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="creds__block" delay={80}>
              <h2 className="creds__heading">Membership</h2>
              <ul className="creds__list">
                {attorney.memberships.map((entry) => (
                  <li key={entry}>
                    <strong>{entry}</strong>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="creds__block" delay={160}>
              <h2 className="creds__heading">Languages</h2>
              <ul className="creds__list">
                {attorney.languages.map((entry) => (
                  <li key={entry}>
                    <strong>{entry}</strong>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <Reveal>
            <p className="eyebrow">Practice</p>
            <h2 className="display display-md bio__practice-title">
              Matters handled by this office
            </h2>
          </Reveal>
          <ul className="chip-list">
            {practiceAreas.map((area) => (
              <li key={area.slug}>
                <Link href={`/practice-areas/${area.slug}`} className="chip">
                  {area.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section--tight cta-band">
        <div className="container cta-band__inner">
          <div>
            <p className="eyebrow">Free 30-minute consultation</p>
            <h2 className="display display-md cta-band__title">
              Make an appointment.
            </h2>
          </div>
          <div className="cta-band__actions">
            <a href={contact.phoneHref} className="btn btn--walnut">
              <PhoneMark className="btn__icon" />
              {contact.phoneDisplay}
            </a>
            <Link href="/contact" className="btn btn--ghost">
              Send a message
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

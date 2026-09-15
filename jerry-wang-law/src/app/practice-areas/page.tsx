import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { ArrowMark, PhoneMark, PracticeArt } from "@/components/Illustrations";
import { contact, legacyCopy, practiceAreas } from "@/content/site";

export const metadata: Metadata = {
  title: "Practice Areas",
  description:
    "Business law, civil litigation, personal injury, divorce and family law, prenuptial agreements, real estate, and criminal matters — handled from one office in Arcadia, California.",
};

export default function PracticeAreasPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Practice Areas</span>
          </nav>
          <h1 className="display display-xl page-head__title">Practice Areas</h1>
          <p className="lede page-head__lede">{legacyCopy.unsure}</p>
          <hr className="rule-pair page-head__rule" />
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <ul className="pa-list">
            {practiceAreas.map((area, index) => (
              <Reveal
                as="li"
                key={area.slug}
                delay={Math.min(index, 4) * 60}
                className="pa-list__item"
              >
                <Link
                  href={`/practice-areas/${area.slug}`}
                  className="pa-row"
                  style={{ "--card-accent": area.accent } as React.CSSProperties}
                >
                  <span className="pa-row__numeral figure-numeral">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <PracticeArt art={area.art} accent={area.accent} className="pa-row__art" />
                  <span className="pa-row__text">
                    <span className="display display-md pa-row__title">
                      {area.title}
                    </span>
                    <span className="pa-row__blurb">{area.blurb}</span>
                  </span>
                  <ArrowMark className="pa-row__arrow" />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="section--tight cta-band">
        <div className="container cta-band__inner">
          <div>
            <p className="eyebrow">Free 30-minute consultation</p>
            <h2 className="display display-md cta-band__title">
              Not sure which of these fits your situation?
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

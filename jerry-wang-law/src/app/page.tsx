import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import {
  ArrowMark,
  HeroArt,
  OfficeScene,
  PhoneMark,
  PracticeArt,
} from "@/components/Illustrations";
import {
  attorney,
  consultation,
  contact,
  firm,
  legacyCopy,
  practiceAreas,
  reasons,
} from "@/content/site";

export default function HomePage() {
  return (
    <>
      {/* ================= Hero ========================================== */}
      <section className="hero on-dark">
        <span className="screen screen--edge" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--plain hero__eyebrow">
              Arcadia, California
            </p>
            <h1 className="display display-xl hero__title">{firm.tagline}</h1>
            <p className="lede hero__lede">{legacyCopy.mission}</p>
            <div className="hero__actions">
              <a href={contact.phoneHref} className="btn btn--ochre">
                <PhoneMark className="btn__icon" />
                {contact.phoneDisplay}
              </a>
              <Link href="/practice-areas" className="btn btn--on-dark">
                Practice Areas
              </Link>
            </div>
          </div>

          <div className="hero__art" aria-hidden="true">
            <HeroArt className="hero__art-svg" />
          </div>
        </div>

        {/* The three facts most people arrive wanting */}
        <div className="hero__facts">
          <div className="container hero__facts-inner">
            <div className="hero__fact">
              <span className="hero__fact-key">Consultation</span>
              <span className="hero__fact-value">
                Free, 30 minutes, no obligation
              </span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-key">Languages</span>
              <span className="hero__fact-value">
                {contact.languages.join(" · ")}
              </span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-key">Office</span>
              <a className="hero__fact-value" href={contact.mapsHref} target="_blank" rel="noreferrer">
                {contact.street}, {contact.city}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Practice areas ================================ */}
      <section className="section" id="practice-areas">
        <div className="container">
          <Reveal>
            <p className="eyebrow">What we handle</p>
            <div className="sec-head">
              <h2 className="display display-lg">
                Seven practice areas, one office.
              </h2>
              <p className="lede sec-head__aside">
                {legacyCopy.unsure}
              </p>
            </div>
          </Reveal>

          <ul className="pa-grid">
            {practiceAreas.map((area, index) => (
              <Reveal
                as="li"
                key={area.slug}
                delay={Math.min(index, 4) * 60}
                className="pa-grid__cell"
              >
                <Link
                  href={`/practice-areas/${area.slug}`}
                  className="pa-card"
                  style={{ "--card-accent": area.accent } as React.CSSProperties}
                >
                  <PracticeArt art={area.art} accent={area.accent} className="pa-card__art" />
                  <h3 className="pa-card__title display display-sm">
                    {area.title}
                  </h3>
                  <p className="pa-card__blurb">{area.blurb}</p>
                  <span className="pa-card__more">
                    Learn more
                    <ArrowMark className="pa-card__arrow" />
                  </span>
                </Link>
              </Reveal>
            ))}

            {/* Fills the grid's last cell, and catches the visitor who did
                not see their situation in the seven above. */}
            <li className="pa-grid__cell">
              <a href={contact.phoneHref} className="pa-card pa-card--cta">
                <span className="pa-card__cta-key">Not listed here?</span>
                <span className="display display-sm pa-card__cta-phone">
                  {contact.phoneDisplay}
                </span>
                <span className="pa-card__cta-body">
                  Call and describe the situation. If it is not something this
                  office handles, we will say so.
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* ================= Why this office =============================== */}
      <section className="section on-dark on-dark--teal reasons">
        <span className="screen screen--top" aria-hidden="true" />
        <div className="container">
          <Reveal>
            <p className="eyebrow">Let us be your attorney</p>
            <h2 className="display display-lg reasons__title">
              {legacyCopy.invitation}
            </h2>
          </Reveal>

          <ol className="reasons__grid">
            {reasons.map((reason, index) => (
              <Reveal
                as="li"
                key={reason.title}
                delay={index * 70}
                className="reasons__item"
              >
                <span className="figure-numeral reasons__numeral">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="reasons__item-title">{reason.title}</h3>
                <p className="reasons__item-body">{reason.body}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal className="reasons__note">
            <p>{consultation.promise}</p>
          </Reveal>
        </div>
      </section>


      {/* ================= The office ==================================== */}
      <section className="office">
        <div className="container office__head">
          <Reveal>
            <p className="eyebrow">The office</p>
            <h2 className="display display-lg office__title">
              {contact.building}.
            </h2>
            <p className="lede office__address">
              {contact.street} · {contact.city}, {contact.state} {contact.zip}
            </p>
            <a
              className="btn btn--ghost"
              href={contact.mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              Directions
            </a>
          </Reveal>
        </div>

        {/* Full bleed on purpose — the one place the page leaves its column. */}
        <figure className="office__figure">
          <OfficeScene className="office__scene" />
          <figcaption className="office__caption">
            Suite 300, drawn from the room itself.
          </figcaption>
        </figure>
      </section>

      {/* ================= Attorney ====================================== */}
      <section className="section attorney-teaser">
        <div className="container attorney-teaser__inner">
          <Reveal className="attorney-teaser__copy">
            <p className="eyebrow">The attorney</p>
            <h2 className="display display-lg">
              {attorney.name}, {attorney.postNominal}
            </h2>
            <p className="lede">{legacyCopy.bilingual}</p>

            <dl className="cred">
              <div className="cred__row">
                <dt className="cred__key">Education</dt>
                <dd className="cred__value">
                  {attorney.education.map((entry) => (
                    <span key={entry.school} className="cred__entry">
                      <strong>{entry.school}</strong>
                      <span>{entry.detail}</span>
                    </span>
                  ))}
                </dd>
              </div>
              <div className="cred__row">
                <dt className="cred__key">Membership</dt>
                <dd className="cred__value">
                  {attorney.memberships.map((entry) => (
                    <span key={entry} className="cred__entry">
                      <strong>{entry}</strong>
                    </span>
                  ))}
                </dd>
              </div>
              <div className="cred__row">
                <dt className="cred__key">Languages</dt>
                <dd className="cred__value">
                  <span className="cred__entry">
                    <strong>{attorney.languages.join(", ")}</strong>
                  </span>
                </dd>
              </div>
            </dl>

            <Link href="/attorney" className="btn btn--ghost">
              About the attorney
            </Link>
          </Reveal>

          <Reveal className="attorney-teaser__aside" delay={120}>
            <blockquote className="pull">
              <p className="display display-md">
                &ldquo;We always keep in mind that our clients are people.&rdquo;
              </p>
              <footer className="pull__cite">{firm.name}</footer>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ================= Contact ======================================= */}
      <section className="section--tight cta-band">
        <div className="container cta-band__inner">
          <div>
            <p className="eyebrow">{consultation.headline}</p>
            <h2 className="display display-md cta-band__title">
              Call today. We are here to help you.
            </h2>
          </div>
          <div className="cta-band__actions">
            <a href={contact.phoneHref} className="btn btn--walnut cta-band__phone">
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

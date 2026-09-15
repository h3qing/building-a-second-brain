import Link from "next/link";
import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/Reveal";
import { ArrowMark, PhoneMark, PracticeArt } from "@/components/Illustrations";
import { images, practiceImages } from "@/content/images";
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

          {/* Runs to the edge of the screen on wide viewports. */}
          <Photo image={images.hero} className="hero__photo" eager />
        </div>

        <div className="hero__facts">
          <div className="container hero__facts-inner">
            <div className="hero__fact">
              <span className="hero__fact-key">Consultation</span>
              <span className="hero__fact-value">Free, 30 minutes, no obligation</span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-key">Languages</span>
              <span className="hero__fact-value">{contact.languages.join(" · ")}</span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-key">Office</span>
              <a
                className="hero__fact-value"
                href={contact.mapsHref}
                target="_blank"
                rel="noreferrer"
              >
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
              <h2 className="display display-lg">Seven practice areas, one office.</h2>
              <p className="lede sec-head__aside">{legacyCopy.unsure}</p>
            </div>
          </Reveal>

          <ul className="feature-grid">
            {practiceAreas.map((area, index) => (
              <Reveal
                as="li"
                key={area.slug}
                delay={Math.min(index, 3) * 60}
                className="feature-grid__cell"
              >
                <Link
                  href={`/practice-areas/${area.slug}`}
                  className="feature"
                  style={{ "--card-accent": area.accent } as React.CSSProperties}
                >
                  <Photo
                    image={practiceImages[area.slug]}
                    className="feature__photo"
                    fallback={
                      <PracticeArt
                        art={area.art}
                        accent={area.accent}
                        className="feature__mark"
                      />
                    }
                  />
                  <span className="feature__body">
                    <span className="feature__index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="display display-sm feature__title">
                      {area.title}
                    </span>
                    <span className="feature__blurb">{area.blurb}</span>
                    <span className="feature__more">
                      Learn more
                      <ArrowMark className="feature__arrow" />
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}

            <li className="feature-grid__cell">
              <a href={contact.phoneHref} className="feature feature--cta">
                <span className="feature__body">
                  <span className="feature__index">Not listed?</span>
                  <span className="display display-md feature__cta-phone">
                    {contact.phoneDisplay}
                  </span>
                  <span className="feature__blurb">
                    Call and describe the situation. If it is not something this
                    office handles, we will say so.
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* ================= Band ========================================== */}
      <Photo image={images.band} className="band" />

      {/* ================= Approach ====================================== */}
      <section className="section approach">
        <div className="container approach__inner">
          <Reveal className="approach__photo-col">
            <Photo image={images.approach} className="approach__photo" />
          </Reveal>

          <Reveal className="approach__copy" delay={100}>
            <p className="eyebrow">Let us be your attorney</p>
            <h2 className="display display-lg approach__title">
              {legacyCopy.invitation}
            </h2>

            <dl className="approach__list">
              {reasons.map((reason) => (
                <div key={reason.title} className="approach__item">
                  <dt className="approach__item-title">{reason.title}</dt>
                  <dd className="approach__item-body">{reason.body}</dd>
                </div>
              ))}
            </dl>

            <p className="approach__note">{consultation.promise}</p>
          </Reveal>
        </div>
      </section>

      {/* ================= The office ==================================== */}
      <section className="office on-dark">
        <div className="container office__inner">
          <Reveal className="office__head">
            <p className="eyebrow">The office</p>
            <h2 className="display display-lg office__title">{contact.building}.</h2>
            <p className="lede office__address">
              {contact.street}
              <br />
              {contact.city}, {contact.state} {contact.zip}
            </p>
            <a
              className="btn btn--on-dark"
              href={contact.mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              Directions
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Photo image={images.office} className="office__photo" />
          </Reveal>
        </div>
      </section>

      {/* ================= Attorney ====================================== */}
      <section className="section attorney-teaser">
        <div className="container attorney-teaser__inner">
          <Reveal className="attorney-teaser__photo-col">
            <Photo image={images.attorney} className="attorney-teaser__photo" />
          </Reveal>

          <Reveal className="attorney-teaser__copy" delay={100}>
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

            <blockquote className="pull pull--inline">
              <p className="display display-sm">
                &ldquo;We always keep in mind that our clients are people.&rdquo;
              </p>
            </blockquote>

            <Link href="/attorney" className="btn btn--ghost">
              About the attorney
            </Link>
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

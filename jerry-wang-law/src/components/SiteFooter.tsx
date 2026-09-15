import Link from "next/link";
import {
  attorney,
  contact,
  disclaimer,
  firm,
  practiceAreas,
} from "@/content/site";
import { MailMark, Monogram, PhoneMark, PinMark } from "./Illustrations";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="ftr">
      <div className="container ftr__inner">
        <div className="ftr__brand">
          <Monogram className="ftr__mark" />
          <p className="ftr__firm display display-sm">{firm.name}</p>
          <p className="ftr__tagline">{firm.tagline}</p>
        </div>

        <div className="ftr__cols">
          <section className="ftr__col">
            <h2 className="ftr__heading">Practice Areas</h2>
            <ul className="ftr__list">
              {practiceAreas.map((area) => (
                <li key={area.slug}>
                  <Link href={`/practice-areas/${area.slug}`}>
                    {area.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="ftr__col">
            <h2 className="ftr__heading">The Firm</h2>
            <ul className="ftr__list">
              <li>
                <Link href="/attorney">{attorney.name}, {attorney.postNominal}</Link>
              </li>
              <li>
                <Link href="/practice-areas">All practice areas</Link>
              </li>
              <li>
                <Link href="/contact">Contact & directions</Link>
              </li>
              <li>
                <Link href="/disclaimer">Legal notice</Link>
              </li>
            </ul>
          </section>

          <section className="ftr__col ftr__col--contact">
            <h2 className="ftr__heading">Contact</h2>
            <a className="ftr__contact-line" href={contact.phoneHref}>
              <PhoneMark className="ftr__icon" />
              <span className="ftr__phone">{contact.phoneDisplay}</span>
            </a>
            <a className="ftr__contact-line" href={contact.emailHref}>
              <MailMark className="ftr__icon" />
              <span>{contact.email}</span>
            </a>
            <a
              className="ftr__contact-line"
              href={contact.mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              <PinMark className="ftr__icon" />
              <span>
                {contact.street}
                <br />
                {contact.city}, {contact.state} {contact.zip}
                <br />
                <span className="ftr__building">{contact.building}</span>
              </span>
            </a>
            <p className="ftr__langs">
              Spoken here: {contact.languages.join(", ")}
            </p>
          </section>
        </div>
      </div>

      <div className="container">
        <hr className="ftr__rule" />
        <div className="ftr__legal">
          <p>
            © {year} {firm.name}. All rights reserved.
          </p>
          <p className="ftr__disclaimer">
            {disclaimer.short}{" "}
            <Link href="/disclaimer">Read the full legal notice</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}

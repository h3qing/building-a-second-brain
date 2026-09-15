import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/Reveal";
import { MailMark, PhoneMark, PinMark } from "@/components/Illustrations";
import { consultation, contact, firm } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Call ${contact.phoneDisplay} or visit ${contact.street}, ${contact.city}, ${contact.stateAbbr} ${contact.zip}. Free 30-minute consultation at the ${firm.name}.`,
};

export default function ContactPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Contact</span>
          </nav>
          <h1 className="display display-xl page-head__title">
            Call today for a free consultation
          </h1>
          <p className="lede page-head__lede">{consultation.promise}</p>
          <hr className="rule-pair page-head__rule" />
        </div>
      </section>

      <section className="section--tight">
        <div className="container contact">
          <Reveal className="contact__details">
            <a className="contact__primary" href={contact.phoneHref}>
              <PhoneMark className="contact__primary-icon" />
              <span>
                <span className="contact__primary-key">Telephone</span>
                <span className="contact__primary-value display display-md">
                  {contact.phoneDisplay}
                </span>
              </span>
            </a>

            <hr className="rule" />

            <a className="contact__line" href={contact.emailHref}>
              <MailMark className="contact__line-icon" />
              <span>
                <span className="contact__line-key">Email</span>
                <span className="contact__line-value">{contact.email}</span>
              </span>
            </a>

            <a
              className="contact__line"
              href={contact.mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              <PinMark className="contact__line-icon" />
              <span>
                <span className="contact__line-key">Office</span>
                <span className="contact__line-value">
                  {contact.street}
                  <br />
                  {contact.city}, {contact.state} {contact.zip}
                </span>
                <span className="contact__line-note">{contact.building}</span>
              </span>
            </a>

            <hr className="rule" />

            <p className="contact__langs">
              <span className="contact__line-key">Languages</span>
              {contact.languages.join(" · ")}
            </p>

            <a
              className="btn btn--ghost contact__directions"
              href={contact.mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps
            </a>

            <iframe
              className="contact__map"
              title={`Map showing ${contact.street}, ${contact.city}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                `${contact.street}, ${contact.city}, ${contact.stateAbbr} ${contact.zip}`,
              )}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>

          <Reveal className="contact__form-wrap" delay={100}>
            <h2 className="eyebrow">Send a message</h2>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}

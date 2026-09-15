import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { PhoneMark, PracticeArt } from "@/components/Illustrations";
import { contact, disclaimer, practiceAreas } from "@/content/site";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return practiceAreas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = practiceAreas.find((entry) => entry.slug === slug);
  if (!area) return {};

  return {
    title: area.title,
    description: `${area.blurb} ${area.title} at the Law Offices of Jerry Wang in Arcadia, California. Free 30-minute consultation.`,
  };
}

export default async function PracticeAreaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const area = practiceAreas.find((entry) => entry.slug === slug);
  if (!area) notFound();

  const others = practiceAreas.filter((entry) => entry.slug !== slug);

  return (
    <>
      <section
        className="page-head page-head--split"
        style={{ "--card-accent": area.accent } as React.CSSProperties}
      >
        <div className="container page-head__split-inner">
          <div>
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/practice-areas">Practice Areas</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{area.shortTitle}</span>
            </nav>
            <hr className="page-head__accent" />
            <h1 className="display display-xl page-head__title">{area.title}</h1>
            <p className="lede page-head__lede">{area.blurb}</p>
          </div>
          <PracticeArt art={area.art} accent={area.accent} className="page-head__art" />
        </div>
      </section>

      <section className="section--tight">
        <div className="container detail">
          <div className="detail__main prose">
            <Reveal>
              <p className="detail__intro">{area.intro}</p>
            </Reveal>

            <Reveal>
              <h2 className="eyebrow detail__heading">What this office handles</h2>
              <ul className="detail__services">
                {area.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <p className="detail__note">{disclaimer.short}</p>
            </Reveal>
          </div>

          <aside className="detail__aside">
            <div className="callout">
              <p className="eyebrow eyebrow--plain">Talk it through</p>
              <p className="callout__body">
                The first consultation is free and lasts about 30 minutes.
                Bring whatever paperwork you have.
              </p>
              <a href={contact.phoneHref} className="btn btn--ochre callout__cta">
                <PhoneMark className="btn__icon" />
                {contact.phoneDisplay}
              </a>
              <a href={contact.emailHref} className="callout__email">
                {contact.email}
              </a>
            </div>

            <nav className="sidenav" aria-label="Other practice areas">
              <p className="sidenav__heading">Other practice areas</p>
              <ul className="sidenav__list">
                {others.map((entry) => (
                  <li key={entry.slug}>
                    <Link href={`/practice-areas/${entry.slug}`}>
                      <PracticeArt art={entry.art} accent={entry.accent} className="sidenav__art" />
                      {entry.shortTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </section>
    </>
  );
}

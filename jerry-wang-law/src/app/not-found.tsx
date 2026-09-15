import Link from "next/link";
import { contact, practiceAreas } from "@/content/site";

export default function NotFound() {
  return (
    <section className="section notfound">
      <div className="container">
        <p className="eyebrow">404</p>
        <h1 className="display display-lg notfound__title">
          That page is not here.
        </h1>
        <p className="lede notfound__lede">
          The page may have moved. Everything this office handles is listed
          below, or call {contact.phoneDisplay} and we will point you to it.
        </p>
        <ul className="chip-list notfound__chips">
          <li>
            <Link href="/" className="chip">
              Home
            </Link>
          </li>
          {practiceAreas.map((area) => (
            <li key={area.slug}>
              <Link href={`/practice-areas/${area.slug}`} className="chip">
                {area.shortTitle}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/contact" className="chip">
              Contact
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

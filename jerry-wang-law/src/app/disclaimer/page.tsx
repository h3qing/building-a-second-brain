import type { Metadata } from "next";
import Link from "next/link";
import { disclaimer, firm } from "@/content/site";

export const metadata: Metadata = {
  title: "Legal Notice",
  description:
    "Legal notice and disclaimer for the Law Offices of Jerry Wang.",
  robots: { index: false, follow: true },
};

export default function DisclaimerPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Legal Notice</span>
          </nav>
          <h1 className="display display-lg page-head__title">Legal Notice</h1>
          <hr className="rule-pair page-head__rule" />
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <div className="prose narrow">
            {disclaimer.long.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
            <p className="detail__note">
              {firm.name}, 630 W. Duarte Rd., Suite 300, Arcadia, California
              91007.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

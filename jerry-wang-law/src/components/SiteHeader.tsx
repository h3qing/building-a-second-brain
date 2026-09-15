"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { contact, firm, nav, practiceAreas } from "@/content/site";
import { Monogram, PhoneMark, PinMark, PracticeArt } from "./Illustrations";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Close everything on navigation. */
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  /* The bar gains a rule and a shadow once the page has moved. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Escape closes whatever is open. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Lock the page behind the mobile drawer. */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const openMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }, []);

  /* A short grace period, so crossing the gap to the panel does not close it. */
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenuOpen(false), 140);
  }, []);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      ref={headerRef}
      className={`hdr${scrolled ? " is-scrolled" : ""}`}
      onMouseLeave={scheduleClose}
    >
      {/* ---- Utility strip: the facts someone came here for -------------- */}
      <div className="hdr__utility">
        <div className="container hdr__utility-inner">
          <a
            className="hdr__util-link"
            href={contact.mapsHref}
            target="_blank"
            rel="noreferrer"
          >
            <PinMark className="hdr__util-icon" />
            <span>
              {contact.street}, {contact.city}, {contact.stateAbbr}{" "}
              {contact.zip}
            </span>
          </a>
          <span className="hdr__util-langs">
            {contact.languages.join(" · ")}
          </span>
          <a className="hdr__util-phone" href={contact.phoneHref}>
            <PhoneMark className="hdr__util-icon" />
            <span>{contact.phoneDisplay}</span>
          </a>
        </div>
      </div>

      {/* ---- Main bar ---------------------------------------------------- */}
      <div className="hdr__bar">
        <div className="container hdr__bar-inner">
          <Link href="/" className="hdr__brand" aria-label={firm.name}>
            <Monogram className="hdr__mark" />
            <span className="hdr__wordmark">
              <span className="hdr__wordmark-pre">Law Offices of</span>
              <span className="hdr__wordmark-name">Jerry Wang</span>
            </span>
          </Link>

          <nav className="hdr__nav" aria-label="Primary">
            {nav.map((item) => {
              const current = isCurrent(item.href);

              if (item.href === "/practice-areas") {
                return (
                  <div
                    key={item.href}
                    className="hdr__nav-group"
                    onMouseEnter={openMenu}
                  >
                    <Link
                      href={item.href}
                      className={`hdr__nav-link${current ? " is-current" : ""}`}
                      aria-expanded={menuOpen}
                      aria-haspopup="true"
                      onFocus={openMenu}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                      <svg
                        className={`hdr__chevron${menuOpen ? " is-open" : ""}`}
                        viewBox="0 0 12 8"
                        aria-hidden="true"
                      >
                        <path
                          d="M1 1.5 6 6.5 11 1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`hdr__nav-link${current ? " is-current" : ""}`}
                  onMouseEnter={scheduleClose}
                  onFocus={scheduleClose}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <a href={contact.phoneHref} className="btn btn--ochre hdr__cta">
            Free Consultation
          </a>

          <button
            type="button"
            className="hdr__burger"
            aria-expanded={drawerOpen}
            aria-controls="site-menu"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span className="sr-only">
              {drawerOpen ? "Close menu" : "Open menu"}
            </span>
            <span
              className={`hdr__burger-box${drawerOpen ? " is-open" : ""}`}
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      {/* ---- Practice-areas panel ---------------------------------------- */}
      <div
        className={`hdr__mega${menuOpen ? " is-open" : ""}`}
        onMouseEnter={openMenu}
        hidden={!menuOpen}
      >
        <div className="container hdr__mega-inner">
          <div className="hdr__mega-grid">
            {practiceAreas.map((area) => (
              <Link
                key={area.slug}
                href={`/practice-areas/${area.slug}`}
                className="hdr__mega-item"
                onBlur={scheduleClose}
              >
                <PracticeArt art={area.art} accent={area.accent} className="hdr__mega-art" />
                <span className="hdr__mega-text">
                  <span className="hdr__mega-title">{area.shortTitle}</span>
                  <span className="hdr__mega-blurb">{area.blurb}</span>
                </span>
              </Link>
            ))}
          </div>

          <aside className="hdr__mega-aside">
            <p className="eyebrow eyebrow--plain">Not sure which?</p>
            <p className="hdr__mega-aside-body">
              Call and describe the situation. If it is not something this
              office handles, we will say so.
            </p>
            <a href={contact.phoneHref} className="hdr__mega-aside-phone">
              {contact.phoneDisplay}
            </a>
            <Link href="/practice-areas" className="hdr__mega-aside-all">
              See all practice areas
            </Link>
          </aside>
        </div>
      </div>

      {/* ---- Mobile drawer ------------------------------------------------ */}
      <div
        id="site-menu"
        className={`hdr__drawer${drawerOpen ? " is-open" : ""}`}
        hidden={!drawerOpen}
      >
        <nav className="hdr__drawer-inner" aria-label="Mobile">
          <Link href="/" className="hdr__drawer-link">
            Home
          </Link>

          <p className="hdr__drawer-heading">Practice Areas</p>
          <ul className="hdr__drawer-list">
            {practiceAreas.map((area) => (
              <li key={area.slug}>
                <Link
                  href={`/practice-areas/${area.slug}`}
                  className="hdr__drawer-sublink"
                >
                  <PracticeArt art={area.art} accent={area.accent} className="hdr__drawer-art" />
                  {area.shortTitle}
                </Link>
              </li>
            ))}
          </ul>

          <Link href="/practice-areas" className="hdr__drawer-link">
            All Practice Areas
          </Link>
          <Link href="/attorney" className="hdr__drawer-link">
            Attorney
          </Link>
          <Link href="/contact" className="hdr__drawer-link">
            Contact
          </Link>

          <div className="hdr__drawer-foot">
            <a href={contact.phoneHref} className="btn btn--ochre">
              Call {contact.phoneDisplay}
            </a>
            <a href={contact.emailHref} className="btn btn--ghost">
              {contact.email}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}

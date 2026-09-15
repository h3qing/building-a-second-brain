"use client";

import { useState } from "react";
import { contact, practiceAreas } from "@/content/site";

/**
 * The site is statically exported, so there is no server to post to.
 *
 * Set NEXT_PUBLIC_FORM_ENDPOINT to a form service (Formspree, Basin, Netlify
 * Forms, or anything else that accepts a POST) and submissions go there. With
 * no endpoint configured the form degrades to composing an email in the
 * visitor's own mail client — which still works, and never silently drops a
 * message the way a form posting into nothing would.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT ?? "";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    if (!ENDPOINT) {
      const lines = [
        `Name: ${data.get("firstName")} ${data.get("lastName")}`,
        `Email: ${data.get("email")}`,
        `Phone: ${data.get("phone")}`,
        `Company: ${data.get("company") || "—"}`,
        `Matter: ${data.get("matter") || "—"}`,
        "",
        String(data.get("message") ?? ""),
      ].join("\n");

      window.location.href = `${contact.emailHref}?subject=${encodeURIComponent(
        "Website enquiry",
      )}&body=${encodeURIComponent(lines)}`;
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="form__done" role="status">
        <p className="display display-sm">Message sent.</p>
        <p>
          We will be in touch. If the matter is time-sensitive, please call{" "}
          <a href={contact.phoneHref}>{contact.phoneDisplay}</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate={false}>
      <div className="form__row">
        <p className="form__field">
          <label htmlFor="firstName">
            First name <span aria-hidden="true">*</span>
          </label>
          <input id="firstName" name="firstName" required autoComplete="given-name" />
        </p>
        <p className="form__field">
          <label htmlFor="lastName">
            Last name <span aria-hidden="true">*</span>
          </label>
          <input id="lastName" name="lastName" required autoComplete="family-name" />
        </p>
      </div>

      <div className="form__row">
        <p className="form__field">
          <label htmlFor="email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </p>
        <p className="form__field">
          <label htmlFor="phone">
            Mobile phone <span aria-hidden="true">*</span>
          </label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" />
        </p>
      </div>

      <p className="form__field">
        <label htmlFor="company">Company (optional)</label>
        <input id="company" name="company" autoComplete="organization" />
      </p>

      <p className="form__field">
        <label htmlFor="matter">What is this about?</label>
        <select id="matter" name="matter" defaultValue="">
          <option value="">Select a practice area</option>
          {practiceAreas.map((area) => (
            <option key={area.slug} value={area.title}>
              {area.title}
            </option>
          ))}
          <option value="Something else">Something else / not sure</option>
        </select>
      </p>

      <p className="form__field">
        <label htmlFor="message">How can we help?</label>
        <textarea id="message" name="message" rows={6} />
      </p>

      <p className="form__warning">
        Please do not include confidential or sensitive information. Sending
        this form does not create an attorney-client relationship.
      </p>

      <div className="form__actions">
        <button
          type="submit"
          className="btn btn--ochre"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
        <span className="form__or">
          or call <a href={contact.phoneHref}>{contact.phoneDisplay}</a>
        </span>
      </div>

      {status === "error" && (
        <p className="form__error" role="alert">
          That did not go through. Please call{" "}
          <a href={contact.phoneHref}>{contact.phoneDisplay}</a> or email{" "}
          <a href={contact.emailHref}>{contact.email}</a>.
        </p>
      )}
    </form>
  );
}

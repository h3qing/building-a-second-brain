import { contact } from "@/content/site";
import { MailMark, PhoneMark, PinMark } from "./Illustrations";

/**
 * Fixed to the bottom of the viewport on phones.
 *
 * A law firm's mobile traffic is overwhelmingly people who want to call
 * someone right now. This keeps that one tap away from every screen, at every
 * scroll position, instead of asking them to hunt for the contact page.
 */
export function MobileCallBar() {
  return (
    <div className="callbar">
      <a className="callbar__item callbar__item--primary" href={contact.phoneHref}>
        <PhoneMark className="callbar__icon" />
        <span>Call</span>
      </a>
      <a className="callbar__item" href={contact.emailHref}>
        <MailMark className="callbar__icon" />
        <span>Email</span>
      </a>
      <a
        className="callbar__item"
        href={contact.mapsHref}
        target="_blank"
        rel="noreferrer"
      >
        <PinMark className="callbar__icon" />
        <span>Directions</span>
      </a>
    </div>
  );
}

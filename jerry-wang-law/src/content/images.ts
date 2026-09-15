/**
 * Every photograph on the site, in one place.
 *
 * The files themselves live in /public/images. None are checked in yet: the
 * build looks for each one and renders either the photograph or a labelled
 * slot in its exact proportions, so the layout can be judged before the
 * pictures arrive and nothing silently breaks when they do.
 *
 * `brief` is what to go and find. SHOT-LIST.md expands on it, with licensing.
 */

export type SiteImage = {
  /** Path under /public, e.g. "/images/hero.jpg" */
  src: string;
  /** Read by screen readers and search engines. Describe the picture. */
  alt: string;
  /** CSS aspect-ratio the slot is laid out at, e.g. "4 / 5" */
  aspect: string;
  /** Where to keep the crop centred, as object-position, e.g. "50% 35%" */
  focal?: string;
  /** Photographer or source. Rendered small beneath the picture when set. */
  credit?: string;
  /** What to source. Shown in the empty slot and in the shot list. */
  brief: string;
  priority: "essential" | "optional";
};

export const images = {
  hero: {
    src: "/images/hero.jpg",
    alt: "A mid-century interior in warm afternoon light",
    aspect: "4 / 5",
    focal: "50% 40%",
    brief:
      "One strong mid-century interior, portrait. A walnut credenza against a plaster wall, an Eames lounge chair beside a window, a Case Study House living room. Long horizontals, warm light, nothing busy.",
    priority: "essential",
  },
  office: {
    src: "/images/office.jpg",
    alt: "The firm's reception, with two black swivel chairs against tall vertical blinds",
    aspect: "16 / 9",
    focal: "50% 55%",
    brief:
      "The firm's own reception, re-photographed in daylight. The black swivel chairs and the floor-to-ceiling blinds are already right — shoot them straight on, chairs centred, blinds open enough to rake light across the floor.",
    priority: "essential",
  },
  attorney: {
    src: "/images/jerry-wang.jpg",
    alt: "Jerry Wang, Esq.",
    aspect: "4 / 5",
    focal: "50% 30%",
    brief:
      "Portrait of Jerry Wang, seated, natural light, looking at the camera. The law library or a plain wall behind. No stock backdrop, no handshake.",
    priority: "essential",
  },
  band: {
    src: "/images/band.jpg",
    alt: "A breeze-block screen wall in sunlight",
    aspect: "21 / 9",
    focal: "50% 50%",
    brief:
      "Architecture, very wide: a breeze-block screen wall, a Palm Springs facade, a butterfly roofline against sky. This runs edge to edge as a divider.",
    priority: "optional",
  },
  approach: {
    src: "/images/approach.jpg",
    alt: "A single mid-century chair in an otherwise empty room",
    aspect: "3 / 4",
    focal: "50% 50%",
    brief:
      "One chair, one room, portrait: an Eames lounge, a Womb chair, a Saarinen Tulip. Quiet and exact. Sits beside the list of reasons to call.",
    priority: "optional",
  },
} satisfies Record<string, SiteImage>;

/**
 * One detail photograph per practice area, 4:3. Details, not scenes — the
 * arm of a chair, a lamp, a door — so the set reads as one series. Until a
 * file is present the area's drawn mark stands in.
 */
export const practiceImages: Record<string, SiteImage> = {
  "business-law": {
    src: "/images/practice/business-law.jpg",
    alt: "A walnut desk with a rotary telephone",
    aspect: "4 / 3",
    brief: "A walnut desk surface — a rotary phone, a fountain pen, a ledger.",
    priority: "optional",
  },
  "civil-litigation": {
    src: "/images/practice/civil-litigation.jpg",
    alt: "Two chairs facing each other across a Saarinen table",
    aspect: "4 / 3",
    brief: "Two chairs facing each other across a round table. Two sides, one table.",
    priority: "optional",
  },
  "personal-injury": {
    src: "/images/practice/personal-injury.jpg",
    alt: "A hand resting on a leather armrest",
    aspect: "4 / 3",
    brief: "A hand on the leather arm of a lounge chair. Rest, recovery, care.",
    priority: "optional",
  },
  "family-law": {
    src: "/images/practice/family-law.jpg",
    alt: "A sunlit living room with a Nelson bench",
    aspect: "4 / 3",
    brief: "A living room in the afternoon — a bench, a rug, light on the floor.",
    priority: "optional",
  },
  "prenuptial-agreements": {
    src: "/images/practice/prenuptial-agreements.jpg",
    alt: "Two matching Eames chairs side by side",
    aspect: "4 / 3",
    brief: "Two of the same chair, side by side.",
    priority: "optional",
  },
  "real-estate-law": {
    src: "/images/practice/real-estate-law.jpg",
    alt: "The facade of a mid-century house",
    aspect: "4 / 3",
    brief: "A house: a post-and-beam facade, an A-frame, a carport under a flat roof.",
    priority: "optional",
  },
  "criminal-law": {
    src: "/images/practice/criminal-law.jpg",
    alt: "A heavy walnut door with a brass handle",
    aspect: "4 / 3",
    brief: "A solid door with brass hardware, closed. Weight and protection.",
    priority: "optional",
  },
};

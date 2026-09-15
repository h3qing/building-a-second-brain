# Shot list

The site is built around photographs of mid-century design. None are checked
in yet. Each slot below is laid out at its exact proportions, so the build can
be judged before the pictures arrive; drop a file at the path shown, rebuild,
and it appears. Nothing else needs to change.

Paths and proportions are defined in `src/content/images.ts`; edit the `alt`
and `credit` fields there once you know what the picture is and who took it.

## The pictures

Priority **essential** means the site should not launch without it.

| File | Ratio | Long edge | Where it appears | What to find |
|---|---|---|---|---|
| `public/images/hero.jpg` | 4:5 | 2000 px | Home — hero, right column, runs to the screen edge | **Essential.** One strong mid-century interior, portrait. A walnut credenza against a plaster wall; an Eames lounge chair beside a window; a Case Study House living room. Long horizontals, warm light, nothing busy. This is the picture the site is judged on. |
| `public/images/office.jpg` | 16:9 | 2400 px | Home — "The office"; Contact page | **Essential.** The firm's own reception, re-photographed in daylight. The black swivel chairs and the floor-to-ceiling blinds are already right — shoot straight on, chairs centred, blinds open enough to rake light across the floor. A tripod and no flash. |
| `public/images/jerry-wang.jpg` | 4:5 | 1600 px | Home — attorney; Attorney page | **Essential.** Portrait of Jerry Wang, seated, natural light, looking at the camera, in front of the law library or a plain wall. No studio backdrop, no handshake, no gavel. |
| `public/images/band.jpg` | 21:9 | 2400 px | Home — full-width divider between sections | Optional. Architecture, very wide: a breeze-block screen wall in sun, a Palm Springs facade, a butterfly roofline against sky. Until it exists the slot collapses to a strip. |
| `public/images/approach.jpg` | 3:4 | 1600 px | Home — beside the reasons to call | Optional. One chair in one room, portrait: an Eames lounge, a Womb chair, a Saarinen Tulip. Quiet and exact. |

### One detail per practice area

Optional, 4:3, 1200 px on the long edge, at `public/images/practice/<slug>.jpg`.
Shoot **details, not scenes** — the arm of a chair, a lamp, a door — so the
seven read as one series. Until a file exists the area's drawn mark stands in.

| File | What to find |
|---|---|
| `practice/business-law.jpg` | A walnut desk surface: a rotary phone, a fountain pen, a ledger. |
| `practice/civil-litigation.jpg` | Two chairs facing each other across a round table. |
| `practice/personal-injury.jpg` | A hand resting on the leather arm of a lounge chair. |
| `practice/family-law.jpg` | A living room in the afternoon — a bench, a rug, light on the floor. |
| `practice/prenuptial-agreements.jpg` | Two of the same chair, side by side. |
| `practice/real-estate-law.jpg` | A house: post-and-beam facade, an A-frame, a carport under a flat roof. |
| `practice/criminal-law.jpg` | A solid door with brass hardware, closed. |

## What makes the set hold together

Pick pictures with the **same light**. Warm, low, directional — late afternoon
through a window — across all of them. A mix of cool daylight and warm tungsten
will look like a mood board; one light will look like a house.

Prefer **one object, plainly**, over rooms full of things. The site's own
typography is quiet; the pictures should be too.

The reference points, if useful when searching: the Stahl House (Case Study
House #22, Pierre Koenig); the Kaufmann House in Palm Springs (Richard Neutra);
the Eames Lounge Chair and Ottoman; Saarinen's Tulip table and Womb chair;
the Nelson Platform Bench; the Noguchi coffee table; Danish walnut credenzas;
Palm Springs breeze-block walls and butterfly roofs.

## Rights

This is a law firm's own website, so the rights need to be clean.

- **Photographs you commission or take yourself** are the cleanest, and the
  office and portrait pictures have to be this anyway. The office already has
  the chairs.
- **Licensed stock** (Adobe Stock, Getty/iStock, Shutterstock): the standard
  licence covers use on a business website. Keep the licence receipt.
- **Unsplash and Pexels** publish under their own licences, which permit
  commercial use without attribution. Quality and authenticity vary; check
  that a "mid-century" picture is actually one.
- **Wikimedia Commons** has good photographs of Case Study Houses and classic
  furniture, mostly CC BY or CC BY-SA. Those **require attribution** — put the
  photographer and licence in the `credit` field in `images.ts` and it is
  rendered on the picture. Prefer CC BY and CC0 over BY-SA.
- **Do not** take pictures from Google Images, Pinterest, Dwell, Architectural
  Digest, or estate-agent listings. Julius Shulman's photographs of the Case
  Study Houses — the famous ones — are copyrighted and administered by the
  Getty Research Institute; they cannot be used without a licence.
- Photographing a chair is fine. Presenting the site as connected to Herman
  Miller, Knoll, or Vitra is not — no logos, no brand names in the copy.

## File preparation

- JPEG, sRGB. Quality around 80.
- Long edge as listed above; nothing over 2400 px.
- Aim for under 350 KB per picture and under 3 MB for the whole set — the
  site currently weighs 3.6 MB with its textures, and it should stay fast on
  a phone.
- Crop to the ratio listed, or leave it and set `focal` in `images.ts` to say
  where the crop should be centred (`"50% 35%"` keeps the top third).
- Then `npm run build`. The build reports nothing about images; if a slot is
  still showing, the path or the filename is wrong.

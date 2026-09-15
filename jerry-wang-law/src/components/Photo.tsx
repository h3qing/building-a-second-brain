import fs from "node:fs";
import path from "node:path";
import type { SiteImage } from "@/content/images";

/**
 * A photograph, or the space for one.
 *
 * This is a server component in a statically exported site, so the check
 * runs once at build time: if the file is in /public the picture is rendered;
 * if not, a slot in the same proportions says what should go there. Dropping
 * a file in and rebuilding is the whole workflow.
 */
function isPresent(src: string) {
  return fs.existsSync(path.join(process.cwd(), "public", src));
}

export function Photo({
  image,
  className = "",
  eager = false,
  fallback,
}: {
  image: SiteImage;
  className?: string;
  /** Above the fold: load immediately instead of lazily. */
  eager?: boolean;
  /** Rendered in place of the empty slot, e.g. a drawn mark. */
  fallback?: React.ReactNode;
}) {
  const style = { "--aspect": image.aspect } as React.CSSProperties;

  if (isPresent(image.src)) {
    return (
      <figure className={`photo ${className}`} style={style}>
        <img
          className="photo__img"
          src={image.src}
          alt={image.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={image.focal ? { objectPosition: image.focal } : undefined}
        />
        {image.credit && (
          <figcaption className="photo__credit">{image.credit}</figcaption>
        )}
      </figure>
    );
  }

  if (fallback) {
    return (
      <div className={`photo photo--fallback ${className}`} style={style}>
        {fallback}
      </div>
    );
  }

  const ratio = image.aspect.replace(/\s*\/\s*/, ":");
  return (
    <div className={`photo photo--slot ${className}`} style={style} aria-hidden="true">
      <span className="photo__slot-key">
        Photograph · {ratio} · {image.priority}
      </span>
      <span className="photo__slot-brief">{image.brief}</span>
      <span className="photo__slot-file">{image.src}</span>
    </div>
  );
}

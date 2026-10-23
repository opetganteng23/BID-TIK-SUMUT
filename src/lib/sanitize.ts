import sanitizeHtml from "sanitize-html";

const IFRAME_HOSTS = ["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com"];

function allowedImageHost(host: string) {
  return host.endsWith(".public.blob.vercel-storage.com") || host.endsWith(".blob.vercel-storage.com");
}

function iframeOk(src: string) {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    if (u.host === "www.youtube.com") return u.pathname.startsWith("/embed/");
    return IFRAME_HOSTS.includes(u.host);
  } catch {
    return false;
  }
}

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "em", "u", "s",
    "code", "pre", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    iframe: ["src", "title", "allowfullscreen"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target === "_blank") next.rel = "noopener noreferrer";
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === "iframe") return !iframeOk(frame.attribs.src ?? "");
    if (frame.tag === "img") {
      if (/^\/media\/[a-f\d]{24}$/i.test(frame.attribs.src ?? "")) return false;
      try {
        const u = new URL(frame.attribs.src ?? "");
        return u.protocol !== "https:" || !(allowedImageHost(u.host) || extraImageHosts().includes(u.host));
      } catch {
        return true;
      }
    }
    return false;
  },
};

function extraImageHosts(): string[] {
  return (process.env.ALLOWED_IMAGE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

/** Sanitasi HTML dengan whitelist ketat (MTS Section 11). */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, options);
}

/** Teks polos aman dari HTML, untuk ringkasan dan SEO. */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

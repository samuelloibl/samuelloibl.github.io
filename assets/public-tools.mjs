// Read only content already published as ordinary HTML. No authoring-data API.
const locale = document.documentElement.lang === "de" ? "de" : "en";
const homePath = locale === "de" ? "/de/" : "/";
const publicationsPath = locale === "de" ? "/de/publikationen/" : "/publications/";
const pages = new Map();

async function readPage(path, marker) {
  if (document.querySelector(marker)) return document;
  if (!pages.has(path)) {
    pages.set(path, fetch(path, { credentials: "omit", referrerPolicy: "no-referrer" })
      .then(async response => {
        if (!response.ok) throw new Error("Public page unavailable.");
        const page = new DOMParser().parseFromString(await response.text(), "text/html");
        if (!page.querySelector(marker)) throw new Error("Public page content unavailable.");
        return page;
      }).catch(error => { pages.delete(path); throw error; }));
  }
  return pages.get(path);
}

const text = element => {
  if (!element) return "";
  const copy = element.cloneNode(true);
  copy.querySelectorAll?.("sup").forEach(note => note.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
};
const canonical = page => page.querySelector('link[rel="canonical"]').href;
const absolute = href => new URL(href, location.origin).href;

export async function loadPublicData(kind) {
  if (kind === "publications") {
    const page = await readPage(publicationsPath, ".bibliography");
    const publications = [...page.querySelectorAll(".publication-item")].map(item => {
      const title = item.querySelector(".entry-title").cloneNode(true);
      title.querySelector(".publication-files")?.remove();
      return {
        id: item.id,
        title: text(title),
        citation: text(item.querySelector(".entry-meta")),
        year: item.dataset.year ? Number(item.dataset.year) : null,
        type: item.dataset.type
      };
    });
    return { publications, publicationsUrl: canonical(page), bibliographyDate: locale === "de" ? "Jänner 2026" : "January 2026" };
  }
  const page = await readPage(homePath, ".intro-copy");
  const projects = [...page.querySelectorAll("#projekte .entry")].map(entry => {
    const link = entry.querySelector(".entry-title a");
    const status = text(entry.querySelector(".entry-status"));
    return {
      name: text(entry.querySelector(".entry-title")),
      description: text(entry.querySelector(".entry-description")),
      ...(link ? { url: absolute(link.getAttribute("href")) } : {}),
      ...(status ? { status } : {})
    };
  });
  const profile = {
    displayName: text(page.querySelector("#intro-title")),
    location: text(page.querySelector(".location-value")),
    url: canonical(page),
    language: locale,
    about: text(page.querySelector(".intro-copy .lead")),
    education: [...page.querySelectorAll('[aria-labelledby="education-title"] .timeline > div')].map(item => ({
      description: [...item.querySelector("dt").childNodes].map(text).join(" ").trim(), year: text(item.querySelector("dd"))
    })),
    background: text(page.querySelector('[aria-labelledby="background-title"] .row-body')),
    honours: [...page.querySelectorAll('[aria-labelledby="honours-title"] .timeline > div')].map(item => ({
      name: text(item.querySelector("dt")), year: text(item.querySelector("dd"))
    })),
    languages: text(page.querySelector(".language-note")),
    links: [...page.querySelectorAll(".intro-copy .text-links a")].map(link => ({
      label: text(link), url: new URL(link.getAttribute("href"), canonical(page)).href
    })),
    projects,
    contact: { display: text(page.querySelector(".email-text")) }
  };
  return { profile };
}

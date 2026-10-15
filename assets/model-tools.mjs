const kinds = new Set(["all", "publication", "talk"]);

function objectInput(input, allowed) {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Input must be an object.");
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new TypeError("Unknown input property.");
  return input;
}

function normalize(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("de");
}

export function filterPublications(records, input = {}) {
  const { query = "", kind = "all" } = objectInput(input, ["query", "kind"]);
  if (typeof query !== "string" || query.length > 160) throw new TypeError("Query must be a string of at most 160 characters.");
  if (!kinds.has(kind)) throw new TypeError("Kind must be all, publication or talk.");
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return records.filter(record => {
    if (kind !== "all" && record.type !== kind) return false;
    const searchable = normalize([
      record.title, record.displayTitle, record.displayTitleEn, record.displayTitleDe,
      record.citation, record.citationEn, record.originalCitation, record.year
    ].filter(value => value !== undefined && value !== null).join(" "));
    return terms.every(term => searchable.includes(term));
  });
}

export function createTools(data) {
  const load = typeof data === "function" ? data : async () => data;
  const noInput = { type: "object", properties: {}, additionalProperties: false };
  return [
    {
      name: "get_public_profile",
      title: "Öffentliches Profil abrufen",
      description: "Return Samuel Loibl's selected public profile, education, research interests, contact address and profile links. This is the person's own website description, not independent verification.",
      inputSchema: noInput,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        objectInput(input, []);
        const data = await load("profile");
        return { source: data.profile.url, sourceType: "self-description", profile: structuredClone(data.profile) };
      }
    },
    {
      name: "search_publications",
      title: "Publikationen und Fachvorträge durchsuchen",
      description: "Search the bibliography supplied by Samuel Loibl, source date January 2026. Searches titles, coauthors, citations and publication years. Returns bibliographic entries, not full texts. All entries are also readable directly on the publications page.",
      inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 160, description: "Title, coauthor, citation or year; all words must match." }, kind: { type: "string", enum: ["all", "publication", "talk"] } }, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        filterPublications([], input);
        const data = await load("publications");
        const records = filterPublications(data.publications, input);
        const source = data.publicationsUrl ?? `${data.profile.url}publications/`;
        return { source, bibliographyDate: data.bibliographyDate, count: records.length, entries: records.map(record => ({ ...structuredClone(record), url: `${source}#${record.id}` })) };
      }
    },
    {
      name: "get_public_projects",
      title: "Öffentliche Projekte abrufen",
      description: "Return the public projects presented on Samuel Loibl's website and links to their project pages and source repositories.",
      inputSchema: noInput,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        objectInput(input, []);
        const data = await load("profile");
        return { source: `${data.profile.url}#projekte`, projects: structuredClone(data.profile.projects) };
      }
    }
  ];
}

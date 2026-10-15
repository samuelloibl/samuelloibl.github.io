const toc = document.querySelector(".article-toc");
if (toc) {
  const details = toc.querySelector("details");
  if (window.matchMedia("(max-width: 480px)").matches) details.open = false;
  const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
  const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  let scheduled = false;
  function updateToc() {
    scheduled = false;
    const active = [...sections].reverse().find(section => section.getBoundingClientRect().top <= 140) || sections[0];
    links.forEach(link => {
      const selected = !!active && link.hash === `#${active.id}`;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", () => { if (!scheduled) { scheduled = true; window.requestAnimationFrame(updateToc); } }, { passive: true });
  updateToc();
}

// Load the optional agent interface only where supported, and read public HTML on demand.
let lifecycle;
async function registerBrowserTools() {
  const registry = document.modelContext ?? navigator.modelContext;
  if (typeof registry?.registerTool !== "function") return;
  lifecycle?.abort();
  lifecycle = new AbortController();
  try {
    const [{ createTools }, { loadPublicData }] = await Promise.all([
      import("./model-tools.mjs"), import("./public-tools.mjs")
    ]);
    for (const tool of createTools(loadPublicData)) {
      await registry.registerTool(tool, { signal: lifecycle.signal });
    }
  } catch (error) { console.warn(`WebMCP unavailable: ${error.name}`); }
}
window.addEventListener("pagehide", () => lifecycle?.abort());
window.addEventListener("pageshow", event => { if (event.persisted) void registerBrowserTools(); });
void registerBrowserTools();

// Light by default; dark only when chosen. The early inline script in <head> applies a stored choice before first paint.
const themeToggle = document.querySelector(".theme-toggle");
if (themeToggle) {
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    const dark = root.dataset.theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeColor?.setAttribute("content", dark ? "#1c1b19" : "#faf8f5");
  };
  const apply = dark => {
    if (dark) root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try { dark ? localStorage.setItem("theme", "dark") : localStorage.removeItem("theme"); } catch {}
    sync();
  };
  themeToggle.hidden = false;
  sync();
  themeToggle.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    if (reduceMotion.matches) return apply(dark);
    if (document.startViewTransition) return void document.startViewTransition(() => apply(dark));
    root.classList.add("theme-fading");
    apply(dark);
    window.setTimeout(() => root.classList.remove("theme-fading"), 280);
  });
}

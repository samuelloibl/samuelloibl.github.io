import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set([
  "index.html", "styles.css",
  "assets/instrument-serif-regular.ttf",
  "assets/instrument-serif-OFL.txt"
]);
const contentTypes = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", svg: "image/svg+xml", ttf: "font/ttf", txt: "text/plain; charset=utf-8" };

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1:4173").pathname;
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  if (!publicFiles.has(file)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const path = join(root, file);
    const info = await stat(path);
    response.writeHead(200, {
      "Content-Type": contentTypes[file.split(".").pop()] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store"
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(4173, "127.0.0.1", () => console.log("Local: http://127.0.0.1:4173"));

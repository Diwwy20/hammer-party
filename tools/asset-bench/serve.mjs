import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { extname, join, normalize, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = Number(process.env.PORT ?? 5199);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary", ".bin": "application/octet-stream",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p).slice(1));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("no"); return; }
    const s = await stat(file);
    const body = await readFile(s.isDirectory() ? join(file, "index.html") : file);
    res.writeHead(200, {
      "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-cache",
    }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, () => console.log(`asset compare bench on http://localhost:${PORT}`));

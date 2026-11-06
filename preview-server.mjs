import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const port = Number.parseInt(process.env.SENTINEL_PREVIEW_PORT || "4173", 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid preview port");

createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Sentinel App Composer: http://127.0.0.1:${port}/`);
});

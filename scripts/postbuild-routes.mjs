import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { careerOpenings } from "../src/data/siteData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const sourceHtml = path.join(distDir, "index.html");

const routePaths = [
  "",
  "kontakt",
  "karriere",
  "impressum",
  "datenschutz",
  "leistungen",
  "unser-4g-prinzip",
  ...careerOpenings.map((opening) => path.posix.join("karriere", opening.slug))
];

async function copyRouteEntry(routePath) {
  const normalized = routePath.replace(/^\/+|\/+$/g, "");

  if (!normalized) {
    return;
  }

  const directoryTarget = path.join(distDir, ...normalized.split("/"), "index.html");
  await mkdir(path.dirname(directoryTarget), { recursive: true });
  await cp(sourceHtml, directoryTarget, { force: true });

  const htmlTarget = path.join(distDir, `${normalized}.html`);
  await mkdir(path.dirname(htmlTarget), { recursive: true });
  await cp(sourceHtml, htmlTarget, { force: true });
}

await Promise.all(routePaths.map(copyRouteEntry));

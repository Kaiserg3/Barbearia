import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";
import { createApp } from "../server/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const require = createRequire(import.meta.url);
const mime = {
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};
const embed = (file) =>
  `data:${mime[path.extname(file)] || "application/octet-stream"};base64,${readFileSync(file).toString("base64")}`;

// Use the real catalog without reading or writing the development database.
async function readCatalog() {
  const app = createApp({ dbPath: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/catalog`,
    );
    if (!response.ok) throw new Error("Não foi possível ler o catálogo.");
    return await response.json();
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    app.locals.close();
  }
}

// Keep the page visible even in viewers that prevent JavaScript execution.
async function renderStaticPage() {
  const temporary = await mkdtemp(path.join(tmpdir(), "bravo-preview-render-"));
  try {
    const output = path.join(temporary, "page.cjs");
    await build({
      stdin: {
        contents:
          'import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import App from "./src/App.jsx"; export default renderToStaticMarkup(React.createElement(App));',
        resolveDir: root,
        loader: "jsx",
      },
      bundle: true,
      jsx: "automatic",
      platform: "node",
      format: "cjs",
      outfile: output,
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    return require(output).default;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const source = await readFile(path.join(dist, "index.html"), "utf8");
const jsPath = source.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const cssPath = source.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
if (!jsPath || !cssPath)
  throw new Error("Execute npm run build antes de gerar a prévia.");

const [catalog, markup, javascript, stylesheet] = await Promise.all([
  readCatalog(),
  renderStaticPage(),
  readFile(path.join(dist, jsPath.slice(1)), "utf8"),
  readFile(path.join(dist, cssPath.slice(1)), "utf8"),
]);
const assets = Object.fromEntries(
  [
    "hero.jpg",
    "about.jpg",
    "service-haircut.jpg",
    "service-beard.jpg",
    "service-combo.jpg",
  ].map((name) => [`/images/${name}`, embed(path.join(dist, "images", name))]),
);
const css = stylesheet.replace(
  /url\((['"]?)(\/[^)'"\s]+)\1\)/g,
  (_match, _quote, url) => `url("${embed(path.join(dist, url.slice(1)))}")`,
);
const staticMarkup = markup
  .replace(/<link\b[^>]*rel="preload"[^>]*>/g, "")
  .replace(
    /src="(\/images\/[^\"]+)"/g,
    (_match, url) => `src="${assets[url]}"`,
  );
const script = await transform(javascript, {
  format: "iife",
  target: "es2020",
  minify: true,
});
const safeScript = script.code.replace(/<\/script/gi, "<\\/script");
const data = JSON.stringify({ catalog, assets }).replace(/</g, "\\u003c");
const title = "BRAVO. Barbearia — Prévia completa";
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#222820">
<meta name="description" content="Demonstração da BRAVO. Barbearia. Serviços, preços e agendamento local de exemplo.">
<title>${title}</title>
<link rel="icon" href="${embed(path.join(dist, "favicon.svg"))}">
<style>${css}</style>
</head>
<body>
<div id="root">${staticMarkup}</div>
<noscript><p style="padding:16px;text-align:center">O visual está disponível. Ative o JavaScript para testar o agendamento demonstrativo.</p></noscript>
<script>var bravoPreviewData=${data};window.__BRAVO_STANDALONE__=true;window.__BRAVO_PREVIEW_CATALOG__=bravoPreviewData.catalog;window.__BRAVO_PREVIEW_ASSETS__=bravoPreviewData.assets;</script>
<script>${safeScript}</script>
<!-- Fotografias: github.com/codewithsadee/barber. Créditos completos em public/images/credits.json. Fontes DM Sans e Instrument Serif: SIL Open Font License. -->
</body></html>`;
const output = path.join(dist, "BRAVO-Barbearia.html");
await writeFile(output, html);
console.log(
  `Prévia independente criada: ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB).`,
);

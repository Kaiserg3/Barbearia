import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "dist", "BRAVO-Barbearia.html");
const output = path.join(root, "dist", "ABRIR-BARBEARIA.html");
const publicBase =
  "https://raw.githubusercontent.com/Kaiserg3/Barbearia/main/public/";
const resources = [
  ["images/hero.jpg", "image/jpeg"],
  ["images/about.jpg", "image/jpeg"],
  ["images/service-haircut.jpg", "image/jpeg"],
  ["images/service-beard.jpg", "image/jpeg"],
  ["images/service-combo.jpg", "image/jpeg"],
  ["fonts/dm-sans.ttf", "font/ttf"],
  ["fonts/instrument-serif.ttf", "font/ttf"],
];

let html;
try {
  html = await readFile(source, "utf8");
} catch (error) {
  if (error.code === "ENOENT") {
    throw new Error(
      "Gere dist/BRAVO-Barbearia.html com o build de prévia antes de criar a versão leve.",
    );
  }
  throw error;
}

if (!/^\s*<!doctype html>/i.test(html) || !/<\/html>\s*$/i.test(html)) {
  throw new Error("A prévia de origem não contém um documento HTML completo.");
}

const replacements = [];
for (const [resource, mime] of resources) {
  const contents = await readFile(path.join(root, "public", resource));
  const embedded = `data:${mime};base64,${contents.toString("base64")}`;
  const count = html.split(embedded).length - 1;
  if (count === 0) {
    throw new Error(
      `O recurso ${resource} não corresponde à prévia. Gere novamente a prévia completa antes da versão leve.`,
    );
  }
  // Replace both static markup and the JSON used when React starts.
  html = html.replaceAll(embedded, publicBase + resource);
  replacements.push({ resource, count });
}

const bytes = Buffer.byteLength(html);
if (bytes >= 500_000) {
  throw new Error(
    `A versão leve ficou com ${bytes} bytes; revise os recursos antes de publicar.`,
  );
}
if (
  /<script\b[^>]*\bsrc\s*=|<script\b[^>]*\btype\s*=\s*["']module["']/i.test(
    html,
  )
) {
  throw new Error(
    "A versão leve precisa manter o JavaScript embutido e clássico.",
  );
}

await writeFile(output, html);
console.log(`Prévia leve criada: ${output} (${(bytes / 1024).toFixed(1)} KB).`);
console.log(
  "As cinco fotografias e as duas fontes precisam de internet. O JavaScript, os estilos e a agenda demonstrativa local continuam no HTML.",
);
console.log(
  `Recursos substituídos: ${replacements.map(({ resource, count }) => `${resource} (${count})`).join(", ")}.`,
);

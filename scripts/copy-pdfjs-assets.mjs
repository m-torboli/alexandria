// Copia in public/pdfjs le risorse di PDF.js che servono in esecuzione:
// mappe dei caratteri (testi asiatici), font standard, decodificatori WebAssembly
// per alcune immagini (JPEG 2000, JBIG2) e profili di colore.
// Viene eseguito automaticamente prima di `npm run dev` e `npm run build`.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist");
const target = join(root, "public", "pdfjs");
const version = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).version;
const stamp = join(target, ".version");

if (existsSync(stamp) && readFileSync(stamp, "utf8") === version) process.exit(0);

mkdirSync(target, { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "iccs"]) {
  cpSync(join(source, dir), join(target, dir), { recursive: true });
}
// Dei moduli WebAssembly servono solo i decodificatori di immagini e colori.
cpSync(join(source, "wasm"), join(target, "wasm"), {
  recursive: true,
  filter: (path) => !/quickjs/i.test(path),
});
writeFileSync(stamp, version);
console.log(`Risorse di PDF.js ${version} copiate in public/pdfjs`);

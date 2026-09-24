// Build del paquete. Genera:
//   dist/consent-banner.esm.js   (ESM, sin efectos secundarios, para bundlers)
//   dist/consent-banner.umd.js   (IIFE global window.ConsentBanner, auto-init)
//   dist/consent-banner.min.js   (IIFE minificado, para CDN unpkg/jsDelivr)
//   dist/react.esm.js            (wrapper de React, react como peer externo)
//
// Y aplica el escape de </script> en TODAS las salidas: un clasico de los
// widgets embebibles. Si el bundle se incrusta inline dentro de un <script>,
// cualquier "</script>" literal (aunque sea en un comentario o string) cerraria
// la etiqueta antes de tiempo. Lo neutralizamos a "<\/script>".
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const common = { bundle: true, target: ["es2018"], logLevel: "info" };

function escapeClosingScript(file) {
  let s = readFileSync(file, "utf8");
  const before = (s.match(/<\/script/gi) || []).length;
  s = s.replace(/<\/script/gi, "<\\/script");
  writeFileSync(file, s);
  if (before) console.log("  escape </script> x" + before + " -> " + file);
}

const outputs = [
  { entryPoints: ["src/index.js"], outfile: "dist/consent-banner.esm.js", format: "esm" },
  { entryPoints: ["src/auto.js"],  outfile: "dist/consent-banner.umd.js", format: "iife", globalName: "ConsentBanner" },
  { entryPoints: ["src/auto.js"],  outfile: "dist/consent-banner.min.js", format: "iife", globalName: "ConsentBanner", minify: true },
  { entryPoints: ["src/react.jsx"], outfile: "dist/react.esm.js", format: "esm", external: ["react"], jsx: "automatic" },
];

for (const o of outputs) {
  await build({ ...common, ...o });
  escapeClosingScript(o.outfile);
}
// El backend de la Fase 3 sirve el mismo bundle construido, para que no haya
// dos copias del banner viviendo por su cuenta. Uso:
//   BACKEND_DIR=../consent-backend npm run build
const backendDir = process.env.BACKEND_DIR;
if (backendDir) {
  const destino = backendDir.replace(/\/$/, "") + "/consent-banner.js";
  writeFileSync(destino, readFileSync("dist/consent-banner.min.js"));
  console.log("  copiado a " + destino);
}

console.log("build ok");

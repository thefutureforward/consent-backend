/*
  Banco de pruebas de la red de seguridad y del interruptor en caliente.

      npm install jsdom
      node prueba-red-seguridad.js ruta/al/consent-banner.js

  Monta el bundle real en un DOM de verdad, hace que el visitante rechace, y
  despues intenta escribir tres cookies. Lo que debe salir:

      A y B   PHPSESSID SE ESCRIBE · sessionid SE ESCRIBE · _ga BLOQUEADA
      C       las tres SE ESCRIBEN   (hardBlocking:false llega por remoto)

  Si en A o B sale "PHPSESSID BLOQUEADA", la red de seguridad no esta actuando.
  Si en C sale "_ga BLOQUEADA", el interruptor remoto no se esta aplicando.
  Un bundle anterior a P3 falla las dos: no conoce la clave hardBlocking y su
  borrado activo no filtra los nombres de sesion.
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RUTA = process.argv[2];
if (!RUTA) {
  console.error("Uso: node prueba-red-seguridad.js ruta/al/consent-banner.js");
  process.exit(1);
}
const BUNDLE = fs.readFileSync(RUTA, "utf8");

const CONFIG = {
  namespace: "fwc_consent",
  consentVersion: "2025-01",
  defaultLanguage: "es",
  autoDetectLanguage: false,
  activeDeletion: true,
  cookieDiscovery: false,
  categories: [
    { id: "esenciales", locked: true, label: { es: "Esenciales" }, desc: { es: "d" }, signals: ["functionality_storage"] },
    { id: "analitica", locked: false, label: { es: "Analitica" }, desc: { es: "d" }, signals: ["analytics_storage"] }
  ],
  // PHPSESSID y sessionid estan a proposito en una categoria denegable: es el
  // error que la red de seguridad tiene que absorber.
  cookiePatterns: [
    { match: "PHPSESSID", category: "analitica" },
    { match: "sessionid", category: "analitica" },
    { match: "_ga", category: "analitica" }
  ]
};

async function corre({ nombre, remoto, hardBlocking }) {
  const logs = [];
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: "https://ejemplo-cliente.test/",
    runScripts: "outside-only",
    virtualConsole: new VirtualConsole(),
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.__consentLog = (t, m) => logs.push(t + ": " + m);

  const cfg = Object.assign({}, CONFIG);
  if (hardBlocking !== undefined) cfg.hardBlocking = hardBlocking;

  if (remoto) {
    w.__consentConfig = { siteId: "site_prueba", apiBase: "https://backend.test" };
    w.fetch = (url) =>
      Promise.resolve({
        json: () => Promise.resolve(String(url).indexOf("/api/config") !== -1 ? cfg : {})
      });
  } else {
    w.__consentConfig = cfg;
    w.fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
  }

  w.eval(BUNDLE);
  await new Promise((r) => setTimeout(r, 150));          // deja llegar la config remota

  const host = w.document.getElementById("consent-banner-host");
  const btn = host && host.shadowRoot && host.shadowRoot.querySelector("[data-a='reject']");
  if (btn) btn.click();
  else logs.push("harness: no aparecio el boton de rechazar");
  await new Promise((r) => setTimeout(r, 80));

  ["PHPSESSID=abc123; path=/", "sessionid=xyz789; path=/", "_ga=GA1.1.555; path=/"]
    .forEach((c) => { w.document.cookie = c; });
  await new Promise((r) => setTimeout(r, 80));

  const presentes = w.document.cookie.split(";").map((s) => s.split("=")[0].trim());
  console.log("\n===== " + nombre + " =====");
  ["PHPSESSID", "sessionid", "_ga"].forEach((n) => {
    console.log("  " + n.padEnd(11) + (presentes.indexOf(n) !== -1 ? "SE ESCRIBE" : "BLOQUEADA"));
  });
  const rel = logs.filter((l) => /^(duro|borrado)/.test(l));
  if (rel.length) console.log("  " + rel.slice(0, 4).join("\n  "));
  w.close();
}

(async () => {
  console.log("bundle: " + path.resolve(RUTA) + "  (" + BUNDLE.length + " bytes)");
  await corre({ nombre: "A. config inline, hardBlocking por defecto", remoto: false });
  await corre({ nombre: "B. config remota, hardBlocking por defecto", remoto: true });
  await corre({ nombre: "C. config remota con hardBlocking:false", remoto: true, hardBlocking: false });
})();

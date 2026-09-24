// Entrada ESM para bundlers y frameworks. No arranca nada al importar:
// el sitio decide cuando llamar start(config). Sin efectos secundarios.
export { start, open, reset, setLanguage } from "./core.js";
export { default } from "./core.js";

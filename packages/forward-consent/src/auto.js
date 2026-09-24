// Entrada para el bundle UMD/script (uso con <script src> o CDN).
// Ademas de exponer la API, auto-arranca leyendo window.__consentConfig,
// igual que el snippet universal. Este SI tiene efecto secundario a proposito.
import api from "./core.js";

if (typeof document !== "undefined") {
  // El bloqueo automatico se instala YA, sin esperar a DOMContentLoaded ni a la
  // config remota: si esperamos, el parser ya habria ejecutado las etiquetas.
  try { api.blockNow(); } catch (e) {}
  var run = function () { api.start(); };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

export default api;
export { start, open, reset, setLanguage } from "./core.js";

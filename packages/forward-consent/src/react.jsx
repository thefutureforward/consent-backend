// Wrapper fino para React. El core es agnostico de framework; esto solo
// lo arranca al montar el componente. Vue/Angular hacen lo mismo llamando
// start(config) en su hook de montaje (ver README).
import { useEffect } from "react";
import { start, open, reset, setLanguage } from "./core.js";

export function ConsentBanner({ config }) {
  useEffect(function () {
    start(config || {});
  }, []); // se arranca una sola vez
  return null; // el banner se monta en su propio Shadow DOM, fuera del arbol de React
}

export { open, reset, setLanguage };
export default ConsentBanner;

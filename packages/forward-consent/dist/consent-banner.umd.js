var ConsentBanner = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/auto.js
  var auto_exports = {};
  __export(auto_exports, {
    default: () => auto_default,
    open: () => open,
    reset: () => reset,
    setLanguage: () => setLanguage,
    start: () => start
  });

  // src/core.js
  var _userConfig = null;
  var DEFAULTS = {
    // Bloqueo endurecido: cierra iframes, pixeles, fetch, XHR, sendBeacon y la
    // escritura de cookies de categorias denegadas. Lo bloqueado no deja un
    // hueco: se sustituye por un marcador del mismo tamano que explica que
    // falta y concede esa categoria con un boton. Se apaga con
    // hardBlocking:false.
    hardBlocking: true,
    namespace: "fwc_consent",
    // prefijo de cookie y de eventos dataLayer
    gtmId: "",
    // vacio = modo sin GTM (gtag directo)
    endpoint: "",
    // vacio = sin auditoria backend
    consentVersion: "2025-01",
    // al cambiar, se vuelve a preguntar
    // URL de la politica de privacidad o de cookies. Admite una cadena, o un
    // objeto por idioma cuando cada version tiene su pagina:
    //   policyUrl: "https://ejemplo.com/cookies"
    //   policyUrl: { es: "/es/cookies", en: "/en/cookies" }
    // Disparador para reabrir el panel desde el propio sitio (footer, politica).
    // El cliente pega un enlace o un boton con data-consent-open y listo.
    trigger: {
      // Que abre el enlace o boton del sitio: "panel" (los ajustes) o
      // "banner" (el aviso completo, con aceptar y rechazar).
      opens: "panel",
      hash: "cookies",
      // #cookies abre el panel; "" lo desactiva
      selector: "",
      // selector extra del tema, si ya tiene su enlace
      safety: true,
      // si el pill esta oculto y no hay disparador, mostrarlo
      text: { es: "Preferencias de cookies", en: "Cookie preferences" },
      mode: "link",
      // link | button, solo afecta al codigo que genera el panel
      style: {
        color: "",
        background: "",
        border: "",
        radius: "6px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: "500",
        fontFamily: "",
        underline: true
      }
    },
    // Interruptores del panel. Vacio = los de siempre.
    switchStyle: {
      // shape: "switch" (interruptor deslizante) o "checkbox" (casilla con tic).
      shape: "switch",
      width: "",
      height: "",
      radius: "",
      knobRadius: "",
      inset: "",
      on: "",
      off: "",
      border: "",
      onBorder: "",
      knob: "",
      knobOn: ""
    },
    // Plantilla base. "" mantiene los valores de siempre; "base-2026" aplica
    // el rediseño. Ver TEMPLATES mas abajo.
    template: "",
    /* Temas: variantes de la misma configuracion. Cada uno es un parche que se
       aplica ENCIMA de todo lo demas, asi que solo lleva lo que cambia. El
       cliente los crea en el dashboard y marca uno activo. */
    themes: {},
    theme: "",
    // Etiqueta breve sobre el titulo del banner y del panel. false la oculta.
    showEyebrow: true,
    // Pildora "siempre activas" junto a la categoria bloqueada.
    showAlwaysPill: true,
    // CSS a medida, para lo que no llega a haber ajuste. Se inyecta dentro del
    // shadow DOM, asi que no puede afectar al resto del sitio del cliente.
    customCss: "",
    policyUrl: "",
    policyNewTab: true,
    defaultLanguage: "es",
    // Recargar tras una decision. Rechazar es el caso que de verdad lo pide:
    // un script ya ejecutado no se puede "desejecutar", solo dejar de cargar
    // en la siguiente carga. Aceptar suele no necesitarlo porque el bundle
    // libera los scripts bloqueados en caliente.
    //   never  -> nunca
    //   accept -> al conceder alguna categoria nueva
    //   reduce -> al retirar alguna categoria concedida  (recomendado)
    //   always -> ante cualquier decision
    reloadAfter: "never",
    autoDetectLanguage: true,
    // mirar el idioma del navegador
    languages: ["es", "en"],
    // idiomas que el sitio admite
    cookie: { lifetimeMonths: 6, domain: "" },
    // Prefijos de cookie que borra activeDeletion al denegar analitica.
    // Ampliable por sitio desde la config remota.
    cookiePatterns: ["_ga", "_gid", "_gat", "__utm", "_gcl"],
    // Segundos que se sigue vigilando tras cargar la pagina. Los scripts de
    // terceros que no se pueden bloquear (HubSpot, GA) reescriben sus cookies
    // DESPUES del borrado inicial: si solo se limpia al arrancar, reaparecen.
    // 0 desactiva la vigilancia y deja el comportamiento de una sola pasada.
    deletionWatchSeconds: 20,
    // Bloqueo AUTOMATICO por URL. Cada regla: {match:"js.hs-scripts.com", category:"marketing"}
    // El observer neutraliza el <script> antes de que se ejecute, sin tocar el HTML del sitio.
    // OJO: para que actue sobre etiquetas ya presentes en el HTML, autoBlock debe ir en el
    // snippet inline (window.__consentConfig), porque la config remota llega por fetch y
    // para entonces el parser ya paso. En la remota sirve para scripts inyectados despues.
    autoBlock: [],
    // Paleta "Expediente": ink navy + paper calido + verdigris teal.
    // Misma fuente de verdad que styles/tokens.css del frontend.
    colors: {
      ink: "#16233B",
      // --ink-900, fondo del banner
      inkSoft: "#21344F",
      // --ink-800
      accent: "#2F7E6C",
      // --brass-500
      accentHover: "#2A7062",
      // --brass-600
      accentSoft: "#DCEEE9",
      // --brass-100
      accentPale: "#8FD3C2",
      // --brass-300, eyebrow y enlaces sobre ink
      text: "#F5F0E6",
      // --paper-100, texto sobre ink
      textBright: "#FBF8F1",
      // --paper-50
      heading: "#16233B",
      // --text-strong
      body: "#5A6673",
      // --slate-500
      border: "#D3D8DE",
      // --slate-200
      borderStrong: "#8A94A0",
      // --slate-400
      switchOff: "#E7EAEE",
      // --slate-100
      pillFg: "#3E6B54",
      // --pine-600
      pillBg: "#E1EBE3",
      // --pine-100
      cream: "#F5F0E6",
      // pie del panel (--surface-sunken)
      panelBg: "#FFFFFF"
    },
    fonts: {
      heading: "'IBM Plex Serif', Georgia, 'Times New Roman', serif",
      body: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    },
    // ---- APARIENCIA -----------------------------------------------------
    // Todo lo de aqui abajo es opcional: cada clave que no venga en la config
    // del sitio cae a este valor. Se vuelca a variables CSS dentro del shadow
    // root, de modo que anadir una opcion nueva no obliga a tocar la logica.
    // Medidas y espaciados del banner inferior.
    banner: {
      layout: "bar",
      // bar | card | centered
      position: "bottom",
      // bottom | top
      align: "center",
      // left | center | right
      inset: "",
      // separacion al borde en card/centered
      cardWidth: "420px",
      // ancho de la tarjeta en layout card
      centeredWidth: "520px",
      // ancho de la tarjeta en layout centered
      maxWidth: "1172px",
      padding: "22px 26px",
      margin: "0 20px 20px",
      // separacion respecto al borde de la ventana
      radius: "12px",
      gap: "28px",
      // entre el bloque de texto y los botones
      copyGap: "8px",
      // entre eyebrow, titulo y cuerpo
      border: "1px solid rgba(255,255,255,.14)",
      shadow: "0 10px 40px rgba(15,24,38,.28)",
      // Velo detras del banner, como en algunas tiendas: oscurece la pagina
      // hasta que el visitante decide. "" lo apaga. OJO: si ademas se bloquea
      // el desplazamiento, el sitio deja de poder usarse sin decidir, y eso en
      // la UE se considera un muro de cookies. En EE.UU. (CCPA/CPRA) no esta
      // prohibido, pero conviene saber lo que se activa.
      // El velo se enciende con backdropOn; backdrop solo dice de que color.
      // Asi apagarlo no obliga a borrar el color que el cliente eligio.
      backdropOn: false,
      backdrop: "rgba(0,0,0,.5)",
      // Un color propio gana sobre el elegido en la lista.
      backdropCustom: "",
      backdropLock: false,
      animate: true,
      // false quita la subida del banner
      background: "",
      // vacio = usa colors.ink
      color: ""
      // vacio = usa colors.text
    },
    // Medidas del panel de preferencias.
    panel: {
      placement: "center",
      // center | side | bottom
      side: "right",
      // right | left, solo con placement side
      sideWidth: "480px",
      // ancho de la hoja lateral
      sheetWidth: "100%",
      // ancho de la hoja inferior
      sheetHeight: "88vh",
      // alto maximo de la hoja inferior
      footLayout: "row",
      // row | stacked
      maxWidth: "560px",
      maxHeight: "92vh",
      radius: "12px",
      headPadding: "28px 28px 20px",
      rowPadding: "20px 28px",
      footPadding: "20px 28px 24px",
      rowGap: "20px",
      shadow: "0 20px 60px rgba(22,35,59,.28)",
      animate: true,
      // false quita la entrada del panel y del velo
      overlay: "rgba(22,35,59,.28)",
      background: ""
      // vacio = usa colors.panelBg
    },
    // Tipografia por elemento. size/weight/lineHeight/letterSpacing/transform,
    // y family para elegir entre heading, body o mono (o una pila propia).
    typography: {
      eyebrow: { family: "mono", size: "10px", weight: 400, letterSpacing: ".14em", transform: "uppercase" },
      bannerText: { family: "body", size: "15px", weight: 400, lineHeight: 1.55 },
      panelTitle: { family: "heading", size: "26px", weight: 500, lineHeight: 1.2, letterSpacing: "-.01em" },
      panelIntro: { family: "body", size: "14px", weight: 400, lineHeight: 1.6 },
      catName: { family: "body", size: "15px", weight: 700 },
      catDesc: { family: "body", size: "13.5px", weight: 400, lineHeight: 1.55 },
      button: { family: "body", size: "14px", weight: 500 },
      chip: { family: "mono", size: "11px", weight: 400, letterSpacing: ".1em", transform: "uppercase" }
    },
    // Botones. Cada uno se puede pintar por separado; lo que se deje vacio
    // hereda del tema de colores.
    buttons: {
      radius: "8px",
      padding: "",
      // Aceptar y rechazar con la misma caja: mismo padding y mismo borde de
      // 1px, y solo cambia el relleno. La CPRA pide que rechazar no cueste mas
      // que aceptar, y un boton fantasma al lado de uno solido inclina la
      // eleccion aunque el texto sea correcto.
      equalWeight: false,
      accept: { background: "", color: "", border: "0", weight: 600, padding: "" },
      reject: { background: "transparent", color: "", border: "1px solid rgba(255,255,255,.32)", weight: 500, padding: "" },
      customize: { background: "transparent", color: "", border: "0", weight: 500, padding: "" },
      save: { background: "", color: "", border: "0", weight: 600, padding: "" }
    },
    // El pill que reabre el panel una vez cerrado.
    // mode: "text" | "image" | "both". Con imagen, image es una URL.
    chip: {
      enabled: true,
      mode: "text",
      image: "",
      imageSize: "18px",
      imageAlt: "",
      position: "bottom-left",
      // bottom-left | bottom-right | top-left | top-right
      offsetX: "16px",
      offsetY: "16px",
      padding: "8px 13px",
      radius: "999px",
      gap: "7px",
      background: "",
      // vacio = colors.panelBg
      color: "",
      // vacio = colors.body
      border: "",
      // vacio = 1px solid colors.border
      shadow: "0 2px 6px rgba(22,35,59,.07)"
    },
    // Carga IBM Plex desde Google Fonts. Ponlo en false si la CSP del sitio
    // bloquea fonts.googleapis.com: se cae a las fuentes del sistema.
    webfont: true,
    // Inventario de cookies: el bundle reporta al backend que NOMBRES de cookie
    // aparecen en el sitio, para poder clasificarlos desde el dashboard.
    // Nunca se envia el valor de la cookie, solo el nombre.
    cookieDiscovery: false,
    discoverySeconds: 15,
    // cuantos segundos se sigue mirando tras cargar
    activeDeletion: true,
    manageScripts: false,
    // bloqueo manual de scripts para sitios sin GTM
    // Categorias por defecto. Mapean a las 6 senales de Consent Mode v2.
    categories: [
      {
        id: "necessary",
        locked: true,
        granted: true,
        label: { es: "Necesarias", en: "Necessary" },
        desc: {
          es: "Imprescindibles para que el sitio cargue y funcione.",
          en: "Required for the site to load and work."
        },
        signals: ["functionality_storage"]
      },
      {
        id: "statistics",
        locked: false,
        granted: false,
        label: { es: "Estadisticas", en: "Statistics" },
        desc: {
          es: "Google Analytics y medicion de uso.",
          en: "Google Analytics and usage measurement."
        },
        signals: ["analytics_storage"]
      },
      {
        id: "marketing",
        locked: false,
        granted: false,
        label: { es: "Marketing", en: "Marketing" },
        desc: {
          es: "Google Ads, remarketing y pixeles de campana.",
          en: "Google Ads, remarketing and campaign pixels."
        },
        signals: ["ad_storage", "ad_user_data", "ad_personalization"]
      }
    ],
    onConsentChange: null
  };
  var ALL_SIGNALS = [
    "analytics_storage",
    "ad_storage",
    "ad_user_data",
    "ad_personalization",
    "functionality_storage",
    "personalization_storage"
  ];
  var SIEMPRE = { security_storage: "granted" };
  var COPY = {
    es: {
      gpcConflict: "Tu navegador pide que no vendamos ni compartamos tus datos, pero aqui ya habias aceptado. Dinos que prefieres.",
      gpcFila: "Apagada porque tu navegador envia una senal de exclusion.",
      eyebrow: "Cookies",
      body: "Usamos cookies para que el sitio funcione y, con tu permiso, para medir su uso y mostrarte contenido relevante.",
      policy: "Politica de cookies",
      blockedBody: "Este contenido de {host} esta bloqueado hasta que aceptes las cookies de {cat}.",
      blockedBtn: "Aceptar {cat}",
      manage: "Personalizar",
      reject: "Solo necesarias",
      accept: "Aceptar todas",
      rejectOptional: "Rechazar las opcionales",
      panelEyebrow: "Tu control",
      panelTitle: "Gestiona tus cookies",
      panelIntro: "Las esenciales no se pueden desactivar. Lo demas lo decides tu.",
      always: "Siempre activas",
      save: "Guardar preferencias",
      chip: "Cookies",
      close: "Cerrar",
      // El rotulo del enlace de exclusion. En ingles NO se traduce ni se
      // adorna: el articulo 7015 obliga a titularlo exactamente "Your Privacy
      // Choices" o "Your California Privacy Choices". El castellano es para
      // sitios en castellano, donde ese texto literal no aplica.
      // El cuerpo del banner cuando toca opt-out. Es otro texto porque es otro
      // acto: alli se pide permiso, aqui se informa de algo que ya esta
      // pasando y se dice como pararlo. Reutilizar el de opt-in ("con tu
      // permiso") seria decir algo que no es verdad.
      bodyOptOut: "Usamos cookies para que el sitio funcione, medir su uso y mostrarte contenido relevante. Puedes apagar lo que no quieras cuando quieras.",
      optOutTitle: "Tus opciones de privacidad",
      optOutAria: "Tus opciones de privacidad: elegir si se venden o ceden tus datos",
      ventaFila: "Encenderla permite vender o ceder tus datos.",
      ventaIntro: "Las marcadas abajo permiten vender o ceder tus datos. Puedes apagarlas.",
      // Los dos enlaces del estilo "dual" (arts. 7013 y 7014). Van en ingles
      // tambien en la version espanola: son titulos que la norma de California
      // fija literalmente, y traducirlos dejaria de cumplirla.
      optOutSell: "Do Not Sell or Share My Personal Information",
      optOutLimit: "Limit the Use of My Sensitive Personal Information"
    },
    en: {
      gpcConflict: "Your browser asks us not to sell or share your data, but you had accepted here before. Tell us what you prefer.",
      gpcFila: "Turned off because your browser sent an opt-out preference signal.",
      eyebrow: "Cookies",
      body: "We use cookies so the site works and, with your permission, to measure usage and show you relevant content.",
      policy: "Cookie policy",
      blockedBody: "This content from {host} is blocked until you accept {cat} cookies.",
      blockedBtn: "Accept {cat}",
      manage: "Customize",
      reject: "Necessary only",
      accept: "Accept all",
      rejectOptional: "Reject optional",
      panelEyebrow: "Your control",
      panelTitle: "Manage your cookies",
      panelIntro: "Essential cookies can't be turned off. Everything else is up to you.",
      always: "Always on",
      save: "Save preferences",
      chip: "Cookies",
      close: "Close",
      bodyOptOut: "We use cookies to run the site, measure usage and show you relevant content. You can turn off what you don't want at any time.",
      optOutTitle: "Your Privacy Choices",
      optOutAria: "Your Privacy Choices: choose whether your data is sold or shared",
      ventaFila: "Turning this on allows your data to be sold or shared.",
      ventaIntro: "The ones marked below allow your data to be sold or shared. You can turn them off.",
      optOutSell: "Do Not Sell or Share My Personal Information",
      optOutLimit: "Limit the Use of My Sensitive Personal Information"
    }
  };
  function cfg() {
    return window.__consentConfig || DEFAULTS;
  }
  var _remote = null;
  var _remoteLoaded = false;
  function isPlain(v) {
    return v && typeof v === "object" && !(v instanceof Array) && typeof v !== "function";
  }
  function esVetada(k) {
    return k === "__proto__" || k === "constructor" || k === "prototype";
  }
  function assign(target, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      if (esVetada(k)) continue;
      if (isPlain(src[k]) && isPlain(target[k])) assign(target[k], src[k]);
      else target[k] = src[k];
    }
    return target;
  }
  var TEMPLATES = {
    "base-2026": {
      // 1. Simetria: rechazar cuesta lo mismo que aceptar.
      buttons: { equalWeight: true, padding: "12px 22px" },
      // 2. Una familia y dos tamanos; el peso hace la jerarquia. Sin mono,
      //    sin mayusculas y sin espaciado en los rotulos del sistema.
      typography: {
        eyebrow: { family: "body", size: "12px", weight: 600, letterSpacing: "", transform: "none" },
        catName: { family: "body", size: "14.5px", weight: 500, letterSpacing: "", transform: "none" },
        button: { family: "body", size: "14px", weight: 500, letterSpacing: "", transform: "none" },
        chip: { family: "body", size: "13px", weight: 500, letterSpacing: "", transform: "none" }
      },
      // 3. El rotulo de encima del titulo y la pildora de "siempre activas"
      //    no aportan informacion: el texto ya lo dice.
      showEyebrow: false,
      showAlwaysPill: false,
      // 4. Sin sombras y sin animacion de entrada: separa el borde de 1px.
      //    La animacion retrasa el primer clic y en moviles lentos lo falla.
      banner: { shadow: "none", animate: false },
      panel: { shadow: "none", animate: false },
      // 5. El acento sale del verde y pasa a la tinta de marca. Un verde en un
      //    interruptor copia el de iOS y sugiere "correcto" donde solo hay una
      //    eleccion neutral.
      colors: { accent: "#1A1A1A", accentHover: "#333333", pillBg: "#EDEDED", pillFg: "#1A1A1A" }
    }
  };
  var PRUEBA_KEY = "cb_theme_preview";
  var PRUEBA_TK = "cb_theme_preview_tk";
  function leeParam(n) {
    try {
      return new URLSearchParams(location.search).get(n);
    } catch (e) {
      return null;
    }
  }
  var BASE_MARCA = "__base";
  function pruebaAutorizada() {
    var c = _userConfig || cfg() || {};
    if (!c.siteId) return true;
    return !!(_remote && _remote._preview === true);
  }
  var _paramsPrueba = null;
  function paramsPrueba() {
    if (!_paramsPrueba) {
      _paramsPrueba = {
        tema: leeParam("consentTheme"),
        token: leeParam("consentPreview") || ""
      };
    }
    return _paramsPrueba;
  }
  function limpiaUrlPrueba() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has("consentTheme") && !u.searchParams.has("consentPreview")) return;
      u.searchParams.delete("consentTheme");
      u.searchParams.delete("consentPreview");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    } catch (e) {
    }
  }
  function modoPrueba() {
    var pr = paramsPrueba(), p = pr.tema;
    if (p !== null) {
      var v = p === "" || p === "base" ? BASE_MARCA : p;
      var tk = pr.token;
      limpiaUrlPrueba();
      if (!pruebaAutorizada()) return null;
      try {
        localStorage.setItem(PRUEBA_KEY, v);
        localStorage.setItem(PRUEBA_TK, tk);
      } catch (e) {
      }
      return v;
    }
    if (!pruebaAutorizada()) return null;
    try {
      return localStorage.getItem(PRUEBA_KEY);
    } catch (e) {
      return null;
    }
  }
  function tokenPrueba() {
    try {
      return localStorage.getItem(PRUEBA_TK) || "";
    } catch (e) {
      return "";
    }
  }
  function salirDePrueba() {
    try {
      localStorage.removeItem(PRUEBA_KEY);
      localStorage.removeItem(PRUEBA_TK);
    } catch (e) {
    }
    location.reload();
  }
  function hayTema(t2, n) {
    return !!n && Object.prototype.hasOwnProperty.call(t2, n) && !!t2[n];
  }
  function temaActivo(m) {
    var t2 = m.themes || {};
    var prueba = modoPrueba();
    if (prueba === BASE_MARCA) return "";
    if (hayTema(t2, prueba)) return prueba;
    if (hayTema(t2, m.theme)) return m.theme;
    return "";
  }
  function pintaSelectorPrueba(C) {
    if (!modoPrueba()) return;
    var nombres = Object.keys(C.themes || {});
    if (!nombres.length) return;
    if (document.getElementById("consent-theme-preview")) return;
    var caja = document.createElement("div");
    caja.id = "consent-theme-preview";
    var sh = caja.attachShadow ? caja.attachShadow({ mode: "open" }) : caja;
    var activo = C._temaActivo || "";
    var botones = [[BASE_MARCA, "Base"]].concat(nombres.map(function(n) {
      return [n, n];
    })).map(function(x) {
      var on = x[0] === BASE_MARCA ? !activo : x[0] === activo;
      return "<button data-t='" + escAttr(x[0]) + "'" + (on ? " class='on'" : "") + ">" + escHtml(x[1]) + "</button>";
    }).join("");
    var st = document.createElement("style");
    st.textContent = ".w{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:2147483646;display:flex;align-items:center;gap:6px;padding:6px;border-radius:10px;background:#14243D;color:#F7F6F2;box-shadow:0 6px 24px rgba(0,0,0,.28);font:500 12px/1 system-ui,-apple-system,sans-serif}.t{padding:0 8px;opacity:.6;white-space:nowrap}button{border:0;border-radius:6px;padding:7px 12px;cursor:pointer;background:transparent;color:inherit;font:inherit;text-transform:capitalize}button:hover{background:rgba(255,255,255,.12)}button.on{background:#F7F6F2;color:#14243D}.x{opacity:.6;padding:7px 9px}";
    var w = document.createElement("div");
    w.className = "w";
    w.innerHTML = "<span class='t'>Vista de prueba</span>" + botones + "<button class='x' data-x='1'>&times;</button>";
    sh.appendChild(st);
    sh.appendChild(w);
    document.body.appendChild(caja);
    w.addEventListener("click", function(e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      if (b.getAttribute("data-x")) {
        salirDePrueba();
        return;
      }
      var t2 = b.getAttribute("data-t");
      try {
        localStorage.setItem(PRUEBA_KEY, t2);
      } catch (err) {
      }
      location.reload();
    });
  }
  function merged() {
    var m = JSON.parse(JSON.stringify(DEFAULTS));
    var local = _userConfig || typeof window !== "undefined" && window.__consentConfig || {};
    var plantilla = _remote && _remote.template || local.template || "";
    if (plantilla && TEMPLATES[plantilla]) {
      assign(m, JSON.parse(JSON.stringify(TEMPLATES[plantilla])));
    }
    assign(m, local);
    if (_remote) {
      var localBlock = m.autoBlock;
      assign(m, _remote);
      if ((!m.autoBlock || !m.autoBlock.length) && localBlock && localBlock.length) {
        m.autoBlock = localBlock;
      }
    }
    var th = temaActivo(m);
    if (th) {
      var parche = JSON.parse(JSON.stringify(m.themes[th]));
      var extra = parche.customCss;
      delete parche.customCss;
      assign(m, parche);
      if (extra) m.customCss = (m.customCss || "") + "\n" + extra;
      m._temaActivo = th;
    }
    return m;
  }
  function log(kind, detail) {
    if (typeof window.__consentLog === "function") window.__consentLog(kind, detail);
  }
  function modoConsent(C) {
    return (C.gcm && C.gcm.mode) === "advanced" ? "advanced" : "basic";
  }
  function gcmDefault(C) {
    if (modoConsent(C) !== "advanced" || state.gcmDefault) return;
    try {
      if (typeof window !== "undefined" && window.__consentDefaultSet) {
        state.gcmDefault = true;
        gcmAjustes(C);
        log("gcm", "El bloque en linea ya emitio el default; solo se reaplican los ajustes.");
        return;
      }
    } catch (e) {
    }
    state.gcmDefault = true;
    var d = {};
    ALL_SIGNALS.forEach(function(s) {
      d[s] = "denied";
    });
    for (var k in SIEMPRE) d[k] = SIEMPRE[k];
    (C.categories || []).forEach(function(cat) {
      if (cat && cat.locked) {
        (cat.signals || []).forEach(function(s) {
          d[s] = "granted";
        });
      }
    });
    var espera = C.gcm && C.gcm.waitForUpdate;
    d.wait_for_update = espera === void 0 || espera === null ? 1500 : espera;
    gtag("consent", "default", d);
    gcmAjustes(C);
    log("gcm", "Consent Mode avanzado: default denegado, wait_for_update=" + d.wait_for_update);
  }
  function gcmAjustes(C) {
    var g = C.gcm || {};
    gtag("set", "ads_data_redaction", g.adsDataRedaction !== false);
    gtag("set", "url_passthrough", g.urlPassthrough === true);
  }
  function gtag() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag === "function") window.gtag.apply(null, arguments);
    else window.dataLayer.push(arguments);
  }
  function cookieName(C) {
    return C.namespace + "_cookie_consent";
  }
  function readConsent(C) {
    var name = cookieName(C) + "=";
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(name) === 0) {
        try {
          return JSON.parse(decodeURIComponent(p.substring(name.length)));
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }
  function writeConsent(C, obj) {
    var d = /* @__PURE__ */ new Date();
    d.setMonth(d.getMonth() + (C.cookie.lifetimeMonths || 6));
    var v = encodeURIComponent(JSON.stringify(obj));
    var str = cookieName(C) + "=" + v + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    if (C.cookie.domain) str += ";domain=" + C.cookie.domain;
    document.cookie = str;
  }
  var SENALES_VENTA = ["ad_storage", "ad_user_data", "ad_personalization"];
  function regimen(C) {
    var r = C && C._region || null;
    return r && r.mode === "optout" ? "optout" : "optin";
  }
  function esOptOut(C) {
    return regimen(C) === "optout";
  }
  function eleccionPorDefecto(C) {
    var apaga = gpcActivo() ? gpcCategorias(C) : null;
    var chosen = {};
    (C.categories || []).forEach(function(c) {
      if (c.locked) {
        chosen[c.id] = true;
        return;
      }
      chosen[c.id] = apaga ? apaga[c.id] === true : true;
    });
    return chosen;
  }
  function esVenta(cat) {
    return !!(cat && cat.sellOrShare === true);
  }
  function hayMarcasDeVenta(C) {
    var cats = C && C.categories || [];
    for (var i = 0; i < cats.length; i++) if (esVenta(cats[i])) return true;
    return false;
  }
  function signalsFrom(C, chosen) {
    var out = {};
    ALL_SIGNALS.forEach(function(s) {
      out[s] = "denied";
    });
    for (var k in SIEMPRE) out[k] = SIEMPRE[k];
    C.categories.forEach(function(cat) {
      var granted = cat.locked ? true : !!chosen[cat.id];
      if (granted && cat.signals) cat.signals.forEach(function(s) {
        out[s] = "granted";
      });
    });
    if (gpcActivo()) {
      SENALES_VENTA.forEach(function(s) {
        out[s] = "denied";
      });
    }
    return out;
  }
  function normalizePatterns(C) {
    var raw = C.cookiePatterns && C.cookiePatterns.length ? C.cookiePatterns : ["_ga", "_gid", "_gat", "__utm", "_gcl"];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (typeof p === "string") out.push({ match: p, category: null });
      else if (p && p.match) out.push({ match: p.match, category: p.category || null });
    }
    return out;
  }
  var _watchTimer = null;
  function stopDeletionWatch() {
    if (_watchTimer) {
      clearInterval(_watchTimer);
      _watchTimer = null;
    }
  }
  function startDeletionWatch(C, chosen) {
    stopDeletionWatch();
    var secs = C.deletionWatchSeconds;
    if (secs === void 0 || secs === null) secs = 20;
    if (!C.activeDeletion || secs <= 0) return;
    var every = 1e3;
    var left = Math.ceil(secs * 1e3 / every);
    var total = 0;
    var sweep = function() {
      var gone = deleteAnalyticsCookies(chosen, true);
      if (gone && gone.length) total += gone.length;
      if (--left <= 0) {
        stopDeletionWatch();
        if (total) log("delete", "Vigilancia: " + total + " reescritura(s) borrada(s) en " + secs + "s.");
      }
    };
    if (document.readyState === "complete") sweep();
    else window.addEventListener("load", sweep);
    _watchTimer = setInterval(sweep, every);
  }
  var SOSPECHOSAS = [
    "session",
    "sess",
    "auth",
    "token",
    "csrf",
    "xsrf",
    "login",
    "logged",
    "sid",
    "jwt",
    "oauth",
    "saml",
    "identity",
    "secure"
  ];
  var PESE_A_TODO = [
    "__secure-1psid",
    "__secure-3psid",
    "__secure-1psidcc",
    "__secure-3psidcc",
    "__secure-1psidts",
    "__secure-3psidts",
    "__secure-1papisid",
    "__secure-3papisid",
    "__secure-osid",
    "__host-1plsid",
    "__host-3plsid",
    "apisid",
    "sapisid",
    "hsid",
    "ssid",
    "dsid",
    "sidcc",
    "fpgsid"
  ];
  function esSospechosa(nombre) {
    var bajo = String(nombre || "").toLowerCase();
    if (PESE_A_TODO.indexOf(bajo) !== -1) return false;
    for (var i = 0; i < SOSPECHOSAS.length; i++) {
      if (bajo.indexOf(SOSPECHOSAS[i]) !== -1) return true;
    }
    return false;
  }
  function deleteAnalyticsCookies(chosen, quiet) {
    var C = merged();
    var all = normalizePatterns(C);
    var denied = {};
    C.categories.forEach(function(cat) {
      var granted = cat.locked ? true : !!(chosen && chosen[cat.id]);
      if (!granted) denied[cat.id] = true;
    });
    var sig = signalsFrom(C, chosen || {});
    var analyticsDenied = sig.analytics_storage === "denied";
    var patterns = all.filter(function(p) {
      return p.category ? !!denied[p.category] : analyticsDenied;
    }).map(function(p) {
      return p.match;
    }).filter(function(m) {
      if (esSospechosa(m)) {
        log("borrado", 'No se borra el patron "' + m + '": apunta a sesion o autenticacion y dejaria al visitante sin poder entrar.');
        return false;
      }
      return true;
    });
    if (!patterns.length) return [];
    var host = location.hostname;
    var root2 = host.split(".").slice(-2).join(".");
    var domains = ["", host, "." + host, root2, "." + root2];
    var deleted = [], fallidas = [];
    var propia = cookieName(C);
    document.cookie.split(";").forEach(function(raw) {
      var nm = raw.split("=")[0].trim();
      if (nm === propia) return;
      var hit = patterns.some(function(p) {
        return nm.indexOf(p) === 0;
      });
      if (!hit || !nm) return;
      domains.forEach(function(dm) {
        var s = nm + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        if (dm) s += ";domain=" + dm;
        document.cookie = s;
      });
      var sigue = document.cookie.split(";").some(function(raw2) {
        return raw2.split("=")[0].trim() === nm;
      });
      if (!sigue) deleted.push(nm);
      else fallidas.push(nm);
    });
    if (deleted.length && !quiet) log("delete", "Borrado activo: " + deleted.join(", "));
    if (fallidas.length && !quiet) log("delete", "No se pudieron borrar: " + fallidas.join(", "));
    return deleted;
  }
  var _observer = null;
  var _blocked = [];
  function hostOf(src) {
    try {
      return new URL(src, location.href).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
  }
  function pathOf(src) {
    try {
      return new URL(src, location.href).pathname.toLowerCase();
    } catch (e) {
      return "";
    }
  }
  function ruleFor(rules, src) {
    if (!src) return null;
    var h = hostOf(src);
    if (!h || h === location.hostname.toLowerCase()) return null;
    var ruta = null;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r || !r.match) continue;
      var m = String(r.match).toLowerCase().replace(/^\*?\.?/, "");
      if (!(h === m || h.slice(-(m.length + 1)) === "." + m)) continue;
      if (r.path && typeof r.path === "string") {
        if (ruta === null) ruta = pathOf(src);
        var pre = r.path.toLowerCase();
        if (pre.charAt(0) !== "/") pre = "/" + pre;
        if (ruta.indexOf(pre) !== 0) continue;
      }
      return r;
    }
    return null;
  }
  function neutralize(node, rule) {
    var src = node.getAttribute("src");
    if (node.tagName === "SCRIPT") {
      node.type = "text/plain";
      node.setAttribute("type", "text/plain");
    }
    node.setAttribute("data-consent-src", src);
    node.setAttribute("data-consent-category", rule.category);
    node.removeAttribute("src");
    if (node.tagName === "IFRAME") {
      try {
        node.src = "about:blank";
      } catch (e) {
      }
      ponerMarcador(node, rule);
    }
    _blocked.push(src);
  }
  function scanExisting(rules) {
    var sel = _duroActivo ? "script[src],iframe[src],img[src]" : "script[src]";
    var nodes = document.querySelectorAll(sel);
    Array.prototype.forEach.call(nodes, function(n) {
      var r = ruleFor(rules, n.getAttribute("src"));
      if (r) neutralize(n, r);
    });
  }
  var _reglasVivas = [];
  var _duroActivo = true;
  var _preRules = null;
  var _parcheado = false;
  function parcheaInsercion() {
    if (_parcheado || typeof Node === "undefined" || !Node.prototype) return;
    _parcheado = true;
    var P = Node.prototype;
    var nAppend = P.appendChild, nInsert = P.insertBefore, nReplace = P.replaceChild;
    function revisa(n) {
      if (!n || !_reglasVivas.length) return n;
      if (n.nodeType === 1) {
        if (n.tagName === "SCRIPT") {
          var r = ruleFor(_reglasVivas, n.getAttribute && n.getAttribute("src"));
          if (r) neutralize(n, r);
        }
        return n;
      }
      if (n.nodeType === 11 && n.querySelectorAll) {
        Array.prototype.forEach.call(n.querySelectorAll("script[src]"), function(s) {
          var r2 = ruleFor(_reglasVivas, s.getAttribute("src"));
          if (r2) neutralize(s, r2);
        });
      }
      return n;
    }
    P.appendChild = function(n) {
      return nAppend.call(this, revisa(n));
    };
    P.insertBefore = function(n, ref) {
      return nInsert.call(this, revisa(n), ref);
    };
    P.replaceChild = function(n, viejo) {
      return nReplace.call(this, revisa(n), viejo);
    };
  }
  var _duroPuesto = false;
  function dominioBloqueado(C, url) {
    if (!_duroActivo) return null;
    if (!url) return null;
    var reglas = _reglasVivas || [];
    if (!reglas.length) return null;
    var h;
    try {
      h = new URL(url, location.href).hostname.toLowerCase();
    } catch (e) {
      return null;
    }
    if (!h || h === location.hostname.toLowerCase()) return null;
    for (var i = 0; i < reglas.length; i++) {
      var r = reglas[i];
      if (!r || !r.match) continue;
      var m = String(r.match).toLowerCase().replace(/^\*?\.?/, "");
      if (h === m || h.slice(-(m.length + 1)) === "." + m) return r;
    }
    return null;
  }
  function esBorradoDeCookie(str) {
    var s = String(str || "");
    var valor = s.split(";")[0].split("=").slice(1).join("=").trim();
    if (valor === "") return true;
    var ma = s.match(/max-age\s*=\s*(-?\d+)/i);
    if (ma && Number(ma[1]) <= 0) return true;
    var ex = s.match(/expires\s*=\s*([^;]+)/i);
    if (ex) {
      var t2 = Date.parse(ex[1]);
      if (!isNaN(t2) && t2 <= Date.now()) return true;
    }
    return false;
  }
  function cookieDenegada(C, str) {
    if (!_duroActivo) return false;
    if (esBorradoDeCookie(str)) return false;
    var pats = C.cookiePatterns || [];
    var nombre = String(str || "").split("=")[0].trim().toLowerCase();
    if (!nombre) return false;
    if (esSospechosa(nombre)) {
      log("duro", 'No se bloquea "' + nombre + '": el nombre apunta a sesion o autenticacion y dejaria al visitante sin poder entrar.');
      return false;
    }
    var sig = signalsFrom(C, state.chosen || {});
    var analiticaDenegada = sig.analytics_storage === "denied";
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i], match = typeof p === "string" ? p : p.match;
      if (!match || nombre.indexOf(String(match).toLowerCase()) !== 0) continue;
      var cat = typeof p === "string" ? null : p.category || null;
      var denegado = cat ? !isGranted(C, state.chosen, cat) : analiticaDenegada;
      if (denegado) return true;
    }
    return false;
  }
  function instalarBloqueoDuro(C) {
    if (_duroPuesto) return;
    _duroPuesto = true;
    var W = window;
    try {
      var dc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (dc && dc.set) {
        Object.defineProperty(document, "cookie", {
          configurable: true,
          get: function() {
            return dc.get.call(document);
          },
          set: function(v) {
            if (cookieDenegada(merged(), v)) {
              log("duro", "Cookie bloqueada al escribirse: " + String(v).split("=")[0]);
              return;
            }
            dc.set.call(document, v);
          }
        });
      }
    } catch (e) {
      log("duro", "No se pudo parchear document.cookie: " + e.message);
    }
    if (W.fetch) {
      var _fetch = W.fetch;
      W.fetch = function(entrada, init2) {
        var url = entrada && entrada.url || entrada;
        if (dominioBloqueado(merged(), url)) {
          log("duro", "fetch bloqueado: " + url);
          return Promise.reject(new Error("bloqueado por consentimiento"));
        }
        return _fetch.apply(this, arguments);
      };
    }
    if (W.XMLHttpRequest && W.XMLHttpRequest.prototype.open) {
      var _open = W.XMLHttpRequest.prototype.open;
      W.XMLHttpRequest.prototype.open = function(metodo, url) {
        if (dominioBloqueado(merged(), url)) {
          log("duro", "XHR bloqueado: " + url);
          this.__cbBloqueado = true;
          return;
        }
        return _open.apply(this, arguments);
      };
      var _send = W.XMLHttpRequest.prototype.send;
      W.XMLHttpRequest.prototype.send = function() {
        if (this.__cbBloqueado) return;
        return _send.apply(this, arguments);
      };
    }
    if (W.navigator && W.navigator.sendBeacon) {
      var _beacon = W.navigator.sendBeacon.bind(W.navigator);
      W.navigator.sendBeacon = function(url) {
        if (dominioBloqueado(merged(), url)) {
          log("duro", "sendBeacon bloqueado: " + url);
          return false;
        }
        return _beacon.apply(null, arguments);
      };
    }
    [[W.HTMLImageElement, "IMG"], [W.HTMLIFrameElement, "IFRAME"]].forEach(function(par) {
      var Clase = par[0];
      if (!Clase || !Clase.prototype) return;
      try {
        var d = Object.getOwnPropertyDescriptor(Clase.prototype, "src");
        if (!d || !d.set) return;
        Object.defineProperty(Clase.prototype, "src", {
          configurable: true,
          get: function() {
            return d.get.call(this);
          },
          set: function(v) {
            if (v && dominioBloqueado(merged(), v)) {
              log("duro", par[1] + " bloqueado: " + v);
              this.setAttribute("data-consent-src", v);
              return;
            }
            d.set.call(this, v);
          }
        });
      } catch (e) {
      }
    });
    log("duro", "Bloqueo endurecido activo: iframes, pixeles, fetch, XHR, beacon y cookies.");
  }
  function textoMarcador(C, cat, host) {
    var L = t();
    var etiqueta = cat;
    (C.categories || []).forEach(function(c) {
      if (c.id !== cat) return;
      var lab = c.label;
      etiqueta = lab && typeof lab === "object" ? lab[state.lang] || lab.es || lab.en || cat : lab || cat;
    });
    return {
      aviso: (L.blockedBody || "Este contenido de {host} esta bloqueado hasta que aceptes las cookies de {cat}.").replace("{host}", host).replace("{cat}", etiqueta),
      boton: (L.blockedBtn || "Aceptar {cat}").replace("{cat}", etiqueta)
    };
  }
  function ponerMarcador(node, rule) {
    try {
      var C = merged();
      if (!C.hardBlocking || node.tagName !== "IFRAME") return;
      if (node.previousElementSibling && node.previousElementSibling.getAttribute("data-consent-ph")) return;
      var src = node.getAttribute("data-consent-src") || "";
      var host = "";
      try {
        host = new URL(src, location.href).hostname.replace(/^www\./, "");
      } catch (e) {
        host = "un tercero";
      }
      var T = textoMarcador(C, rule.category, host);
      var K = C.colors || {};
      var caja = node.getBoundingClientRect();
      var an = node.getAttribute("width") || (caja.width ? Math.round(caja.width) + "px" : "100%");
      var al = node.getAttribute("height") || (caja.height ? Math.round(caja.height) + "px" : "200px");
      if (/^\d+$/.test(an)) an += "px";
      if (/^\d+$/.test(al)) al += "px";
      var P = C.placeholder || {};
      var bot = P.button || {};
      var ph = document.createElement("div");
      ph.setAttribute("data-consent-ph", rule.category);
      if (P.className) ph.className = P.className;
      ph.style.cssText = "box-sizing:border-box;width:" + an + ";height:" + al + ";max-width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:" + (P.gap || "12px") + ";padding:" + (P.padding || "16px") + ";text-align:center;background:" + (P.background || K.panelBg || "#F2F3F5") + ";color:" + (P.color || K.body || "#44505F") + ";border:" + (P.border || "1px dashed " + (K.border || "#C9CFD6")) + ";border-radius:" + (P.radius || "0") + ";font:" + (P.fontSize || "14px") + "/1.5 " + (fam(C, P.family || "body") || "system-ui, sans-serif") + ";";
      var p = document.createElement("p");
      p.style.cssText = "margin:0;max-width:" + (P.textMaxWidth || "40ch");
      p.textContent = T.aviso;
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = T.boton;
      if (P.buttonClassName) b.className = P.buttonClassName;
      b.style.cssText = "cursor:pointer;font:inherit;border:" + (bot.border || "0") + ";padding:" + (bot.padding || "10px 18px") + ";font-weight:" + (bot.weight || "600") + ";background:" + (bot.background || K.accent || "#2E7D74") + ";color:" + (bot.color || K.textBright || "#FFFFFF") + ";border-radius:" + (bot.radius || C.buttons && C.buttons.radius || "6px") + ";";
      b.onclick = function() {
        concederCategoria(rule.category);
      };
      ph.appendChild(p);
      ph.appendChild(b);
      node.parentNode.insertBefore(ph, node);
      node.style.display = "none";
    } catch (e) {
    }
  }
  function concederCategoria(cat) {
    var C = merged();
    var chosen = {};
    (C.categories || []).forEach(function(c) {
      chosen[c.id] = c.locked ? true : !!(state.chosen || {})[c.id];
    });
    chosen[cat] = true;
    log("duro", 'El visitante concede "' + cat + '" desde el marcador.');
    persist(C, "custom", chosen);
  }
  function quitarMarcador(node) {
    var ph = node.previousElementSibling;
    if (ph && ph.getAttribute("data-consent-ph")) ph.parentNode.removeChild(ph);
    node.style.display = "";
  }
  function installAutoBlock() {
    var C = merged();
    var rules = reglasQueBloquean(C.autoBlock);
    _reglasVivas = rules;
    _duroActivo = C.hardBlocking !== false;
    var pre = typeof window !== "undefined" && window.__consentBlocker;
    if (pre && pre.observer) {
      _observer = pre.observer;
      _blocked = pre.blocked || [];
      if (!pre.patched) parcheaInsercion();
      if (pre.rules) _preRules = pre.rules;
      if (rules.length) scanExisting(rules);
      log("autoblock", "Pre-bloqueador inline adoptado (" + _blocked.length + " scripts).");
      return;
    }
    if (!rules.length || _observer) return;
    parcheaInsercion();
    scanExisting(rules);
    _observer = new MutationObserver(function(muts) {
      var live = reglasQueBloquean(merged().autoBlock) || rules;
      muts.forEach(function(m) {
        Array.prototype.forEach.call(m.addedNodes, function(n) {
          if (!n.tagName) return;
          var dura = _duroActivo;
          var vigilo = dura ? ["SCRIPT", "IFRAME", "IMG"] : ["SCRIPT"];
          if (vigilo.indexOf(n.tagName) === -1) return;
          var r = ruleFor(live, n.getAttribute("src"));
          if (r) neutralize(n, r);
        });
      });
    });
    _observer.observe(document.documentElement, { childList: true, subtree: true });
    log("autoblock", "Bloqueo automatico activo (" + rules.length + " reglas).");
  }
  function refreshAutoBlock(C, chosen) {
    _duroActivo = C.hardBlocking !== false;
    var lista = reglasQueBloquean(C.autoBlock);
    var rules = lista.filter(function(r) {
      return r && !isGranted(C, chosen, r.category);
    });
    try {
      avisaProveedores(C, chosen);
    } catch (e) {
    }
    _reglasVivas = rules;
    if (_preRules) {
      _preRules.length = 0;
      rules.forEach(function(r) {
        _preRules.push(r);
      });
    }
    if (!_observer) return;
    if (!rules.length) {
      _observer.disconnect();
      _observer = null;
    }
    if (_blocked.length) log("autoblock", "Bloqueados: " + _blocked.join(", "));
  }
  function isGranted(C, chosen, catId) {
    var cat = C.categories.filter(function(c) {
      return c.id === catId;
    })[0];
    if (cat && cat.locked) return true;
    return !!chosen[catId];
  }
  function hookDelSitio(nombre) {
    if (!nombre) return null;
    var reg = null;
    try {
      reg = window.__consentHooks;
    } catch (e) {
      return null;
    }
    if (!reg || typeof reg !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(reg, nombre)) return null;
    var fn = reg[nombre];
    return typeof fn === "function" ? fn : null;
  }
  function avisaProveedores(C, chosen) {
    var reglas = C.autoBlock instanceof Array ? C.autoBlock : [];
    reglas.forEach(function(r) {
      if (!r || !r.hook) return;
      var fn = hookDelSitio(r.hook);
      if (!fn) {
        log("hook", "La regla de " + (r.match || "?") + ' pide el hook "' + r.hook + '", que el sitio no ha declarado en window.__consentHooks. No se llama.');
        return;
      }
      var concedida = isGranted(C, chosen, r.category);
      try {
        fn({
          vendor: String(r.match || ""),
          category: r.category || null,
          granted: !!concedida,
          mode: r.mode === "notify" ? "notify" : "block"
        });
        log("hook", 'Avisado "' + r.hook + '": ' + (r.match || "?") + " -> " + (concedida ? "concedido" : "denegado"));
      } catch (e) {
        log("hook", 'El hook "' + r.hook + '" lanzo: ' + e.message);
      }
    });
  }
  function reglasQueBloquean(lista) {
    return (lista instanceof Array ? lista : []).filter(function(r) {
      return r && r.mode !== "notify";
    });
  }
  function activateScripts(C, chosen) {
    if (!C.manageScripts && !(C.autoBlock && C.autoBlock.length)) return;
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent-category]');
    var activated = [];
    Array.prototype.forEach.call(nodes, function(old) {
      var cat = old.getAttribute("data-consent-category");
      if (!isGranted(C, chosen, cat)) return;
      var s = document.createElement("script");
      for (var i = 0; i < old.attributes.length; i++) {
        var a = old.attributes[i];
        if (a.name === "type" || a.name === "data-consent-category" || a.name === "data-consent-src" || a.name === "data-src") continue;
        s.setAttribute(a.name, a.value);
      }
      var src = old.getAttribute("data-consent-src") || old.getAttribute("data-src");
      if (src) s.src = src;
      else s.text = old.textContent;
      old.parentNode.replaceChild(s, old);
      activated.push(cat);
    });
    if (activated.length) log("scripts", "Scripts activados: " + activated.join(", "));
    restaurarMedios(C, chosen);
    setTimeout(function() {
      restaurarMedios(merged(), chosen);
    }, 0);
    setTimeout(function() {
      restaurarMedios(merged(), chosen);
    }, 400);
  }
  function restaurarMedios(C, chosen) {
    var medios = document.querySelectorAll("iframe[data-consent-src],img[data-consent-src]");
    var vueltos = [];
    Array.prototype.forEach.call(medios, function(n) {
      var cat = n.getAttribute("data-consent-category");
      if (!cat) {
        var r = dominioBloqueado(C, n.getAttribute("data-consent-src"));
        if (r) return;
      } else if (!isGranted(C, chosen, cat)) {
        return;
      }
      var src = n.getAttribute("data-consent-src");
      n.removeAttribute("data-consent-src");
      n.removeAttribute("data-consent-category");
      quitarMarcador(n);
      try {
        n.src = src;
      } catch (e) {
      }
      vueltos.push(src);
    });
    if (vueltos.length) log("duro", "Medios restaurados: " + vueltos.length);
  }
  function textoMostrado(C) {
    var L = t();
    var partes = [
      "v=" + (C.consentVersion || ""),
      "lang=" + state.lang,
      "modo=" + (state.modo || "optin"),
      "body=" + (state.modo === "optout" && L.bodyOptOut ? L.bodyOptOut : L.body),
      "accept=" + L.accept,
      "reject=" + L.reject,
      "manage=" + L.manage,
      "panelTitle=" + L.panelTitle,
      "panelIntro=" + L.panelIntro,
      "save=" + L.save,
      "rejectOptional=" + L.rejectOptional,
      "policy=" + (L.policy || "") + "|" + (C.policy && C.policy.url || C.policyUrl || "")
    ];
    (C.categories || []).forEach(function(cat) {
      partes.push("cat:" + cat.id + "|locked=" + (cat.locked ? 1 : 0) + "|venta=" + (esVenta(cat) ? 1 : 0) + "|label=" + lang(cat.label, C) + "|desc=" + lang(cat.desc, C) + "|signals=" + (cat.signals || []).join(","));
    });
    return partes.join("\n");
  }
  function hashTexto(str) {
    function fnv(sem) {
      var h = sem;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i) & 255;
        h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
        var alto = str.charCodeAt(i) >>> 8;
        if (alto) {
          h ^= alto;
          h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
        }
      }
      return h >>> 0;
    }
    function hex(n) {
      return ("0000000" + n.toString(16)).slice(-8);
    }
    return hex(fnv(2166136261)) + hex(fnv(16777619));
  }
  function rutaDePagina() {
    try {
      return String(location.pathname || "/").slice(0, 300);
    } catch (e) {
      return "";
    }
  }
  function postAudit(C, consent) {
    if (!C.endpoint) return;
    var texto = textoMostrado(C);
    var payload = {
      site_id: C.siteId || null,
      choice: consent.choice,
      categories: consent.categories,
      language: state.lang,
      consent_id: consent.consent_id || null,
      session_id: C.sessionId || null,
      version: C.consentVersion,
      gpc: !!state.gpc,
      // prueba de que se respeto la senal
      page: rutaDePagina(),
      text_hash: hashTexto(texto),
      text: texto
    };
    var headers = { "Content-Type": "application/json" };
    if (C.publicKey) headers["X-Api-Key"] = C.publicKey;
    try {
      fetch(C.endpoint, {
        method: "POST",
        keepalive: true,
        headers,
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.json();
      }).then(function(d) {
        if (d && d.consent_id) {
          consent.consent_id = d.consent_id;
          writeConsent(C, consent);
          log("audit", "Auditoria OK. consent_id=" + d.consent_id);
        }
      }).catch(function() {
        log("audit", "Auditoria fallo (la eleccion local ya quedo guardada).");
      });
    } catch (e) {
    }
    log("audit", "POST " + C.endpoint + " (no bloquea la UI)");
  }
  var _sent = {};
  function cookieNames() {
    var out = [], vistos = {};
    String(document.cookie || "").split(";").forEach(function(raw) {
      var nm = raw.split("=")[0].trim();
      if (!nm || vistos[nm]) return;
      vistos[nm] = 1;
      out.push(nm);
    });
    return out;
  }
  function _clavesAlmacen(tipo) {
    var out = [];
    try {
      var st = tipo === "local" ? window.localStorage : window.sessionStorage;
      if (!st) return out;
      for (var i = 0; i < st.length; i++) {
        var k = st.key(i);
        if (k) out.push(k);
      }
    } catch (e) {
    }
    return out;
  }
  var _hostsVistos = {};
  function _tercerosObservados() {
    var out = [];
    try {
      var propio = location.hostname.toLowerCase();
      var raiz = propio.split(".").slice(-2).join(".");
      (performance.getEntriesByType("resource") || []).forEach(function(e) {
        var h;
        try {
          h = new URL(e.name).hostname.toLowerCase();
        } catch (err) {
          return;
        }
        if (!h || h === propio || h === raiz || h.slice(-(raiz.length + 1)) === "." + raiz) return;
        if (_hostsVistos[h]) return;
        _hostsVistos[h] = 1;
        out.push(h);
      });
    } catch (e) {
    }
    return out;
  }
  var EXTENSIONES = [
    "__darkreader__",
    "walletlink",
    "EIP6963",
    "__coupert",
    "__EXT_APP_",
    "MicrosoftApplicationsTelemetry",
    "RC_MFE_",
    "__cb_resourcesearch",
    "_bettercampus",
    "__metamask",
    "__phantom",
    "grammarly",
    "__honey",
    "__REACT_DEVTOOLS",
    "__VUE_DEVTOOLS",
    "loom-",
    "__pocket",
    "adblock"
  ];
  var PROPIAS = ["cb_theme_preview", "cb_inv_sesion"];
  function esNuestra(nombre) {
    var n = String(nombre || "");
    for (var i = 0; i < PROPIAS.length; i++) {
      if (n.indexOf(PROPIAS[i]) === 0) return true;
    }
    return false;
  }
  function esDeExtension(nombre) {
    var n = String(nombre || "").toLowerCase();
    for (var i = 0; i < EXTENSIONES.length; i++) {
      if (n.indexOf(EXTENSIONES[i].toLowerCase()) === 0) return true;
    }
    return false;
  }
  function inventario() {
    var items = [];
    function anotar(n, kind, party) {
      if (esDeExtension(n)) return;
      if (esNuestra(n)) return;
      items.push({ name: n, kind, party });
    }
    cookieNames().forEach(function(n) {
      anotar(n, "cookie", "first");
    });
    _clavesAlmacen("local").forEach(function(n) {
      anotar(n, "localStorage", "first");
    });
    _clavesAlmacen("session").forEach(function(n) {
      anotar(n, "sessionStorage", "first");
    });
    _tercerosObservados().forEach(function(h) {
      anotar(h, "host", "third");
    });
    return items;
  }
  var MARCAS_ADMIN = [
    "#wpadminbar",
    // WordPress: la barra, no la sesion
    "body.admin-bar",
    "body.shopify-preview",
    // vista previa de tema de Shopify
    "#admin-bar-iframe",
    "body.neos-backend",
    "body.cke_editable",
    "body.wp-admin",
    "body.logged-in #wpadminbar"
  ];
  function esSesionDeGestor(C) {
    var extra = C && C.discoverySkipIf instanceof Array ? C.discoverySkipIf : [];
    var sel = MARCAS_ADMIN.concat(extra);
    for (var i = 0; i < sel.length; i++) {
      try {
        if (document.querySelector(sel[i])) return sel[i];
      } catch (e) {
      }
    }
    return null;
  }
  var SESION_KEY = "cb_inv_sesion";
  var VISITA_MS = 30 * 60 * 1e3;
  var _esVisitaNueva = null;
  function primeraDeLaVisita() {
    if (_esVisitaNueva !== null) return _esVisitaNueva;
    var ahora = Date.now();
    try {
      var ult = parseInt(localStorage.getItem(SESION_KEY) || "0", 10) || 0;
      _esVisitaNueva = ahora - ult > VISITA_MS;
      localStorage.setItem(SESION_KEY, String(ahora));
    } catch (e) {
      _esVisitaNueva = false;
    }
    return _esVisitaNueva;
  }
  function reportCookies(C, phase) {
    if (!C.cookieDiscovery || !C.apiBase || !C.siteId) return;
    var gestor = esSesionDeGestor(C);
    if (gestor) {
      log("discovery", "Inventario omitido: esta pagina es una sesion de gestor (" + gestor + ")");
      return;
    }
    var nuevas = inventario().filter(function(it) {
      return !_sent[it.kind + ":" + it.name];
    });
    if (!nuevas.length) return;
    nuevas.forEach(function(it) {
      _sent[it.kind + ":" + it.name] = 1;
    });
    var headers = { "Content-Type": "application/json" };
    if (C.publicKey) headers["X-Api-Key"] = C.publicKey;
    var url = String(C.apiBase).replace(/\/$/, "") + "/api/cookies";
    try {
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers,
        body: JSON.stringify({
          site_id: C.siteId,
          phase: phase || "",
          primera: primeraDeLaVisita(),
          cookies: nuevas.map(function(it) {
            return {
              name: it.name,
              domain: location.hostname,
              kind: it.kind,
              party: it.party,
              page: location.pathname
            };
          })
        })
      }).then(function() {
        log("discovery", "Inventario enviado (" + phase + "): " + nuevas.map(function(it) {
          return it.kind + " " + it.name;
        }).join(", "));
      }).catch(function() {
      });
    } catch (e) {
    }
  }
  function startDiscovery(C) {
    if (!C.cookieDiscovery) return;
    reportCookies(C, "inicial");
    var segundos = C.discoverySeconds == null ? 15 : C.discoverySeconds;
    if (segundos <= 0) return;
    var pasos = 0;
    var timer = setInterval(function() {
      pasos++;
      reportCookies(C, "tardia");
      if (pasos >= segundos) clearInterval(timer);
    }, 1e3);
  }
  var state = { lang: "es", chosen: {}, modo: "optin" };
  function persist(C, choice, chosen) {
    var signals = signalsFrom(C, chosen);
    var consent = {
      consent_id: (readConsent(C) || {}).consent_id || null,
      choice,
      categories: chosen,
      signals,
      ts: Date.now(),
      version: C.consentVersion,
      // Si la senal estaba puesta cuando se decidio, la decision ya la tiene en
      // cuenta y no hay que volver a revocarla en cada carga.
      gpc: gpcActivo()
    };
    var antes = state.chosen || {};
    var concede = false, retira = false;
    C.categories.forEach(function(c) {
      if (c.locked) return;
      if (chosen[c.id] && !antes[c.id]) concede = true;
      if (!chosen[c.id] && antes[c.id]) retira = true;
    });
    writeConsent(C, consent);
    log("save", "Guardado en cookie " + cookieName(C) + " (choice=" + choice + ")");
    hideBanner();
    hidePanel();
    showChip(C);
    state.chosen = chosen;
    checkSafety(C);
    gtag("consent", "update", signals);
    gcmAjustes(C);
    log("update", JSON.stringify(signals));
    refreshAutoBlock(C, chosen);
    activateScripts(C, chosen);
    if (C.activeDeletion) {
      deleteAnalyticsCookies(chosen);
      startDeletionWatch(C, chosen);
    } else stopDeletionWatch();
    postAudit(C, consent);
    if (C.cookieDiscovery) setTimeout(function() {
      reportCookies(C, "tras-decision");
    }, 3e3);
    if (typeof C.onConsentChange === "function") C.onConsentChange(consent);
    var modo = C.reloadAfter || "never";
    var toca = modo === "always" || modo === "accept" && concede || modo === "reduce" && retira;
    if (toca) {
      log("reload", "Recargando la pagina tras la decision (reloadAfter=" + modo + ").");
      setTimeout(function() {
        location.reload();
      }, 400);
    }
  }
  var root;
  var bannerEl;
  var panelEl;
  var chipEl;
  function fam(C, v) {
    if (!v) return C.fonts.body;
    return C.fonts[v] || v;
  }
  function typo(C, key) {
    var t2 = C.typography && C.typography[key] || {};
    var out = "font-family:" + fam(C, t2.family) + ";";
    if (t2.size) out += "font-size:" + t2.size + ";";
    if (t2.weight) out += "font-weight:" + t2.weight + ";";
    if (t2.lineHeight) out += "line-height:" + t2.lineHeight + ";";
    if (t2.letterSpacing) out += "letter-spacing:" + t2.letterSpacing + ";";
    if (t2.transform) out += "text-transform:" + t2.transform + ";";
    return out;
  }
  function btn(C, key, fallbackBg, fallbackFg) {
    var B = C.buttons || {}, b = B[key] || {};
    var out = "";
    out += "background:" + (b.background || fallbackBg) + ";";
    out += "color:" + (b.color || fallbackFg) + ";";
    if (b.border !== void 0 && b.border !== "") out += "border:" + b.border + ";";
    if (b.weight) out += "font-weight:" + b.weight + ";";
    if (b.size) out += "font-size:" + b.size + ";";
    if (b.radius) out += "border-radius:" + b.radius + ";";
    if (b.underline) out += "text-decoration:underline;text-underline-offset:3px;";
    var deSerie = { accept: "12px 22px", save: "12px 22px", customize: "11px 14px" };
    out += "padding:" + (b.padding || B.padding || deSerie[key] || "11px 18px") + ";";
    return out;
  }
  function swCss(C, K, pnBg) {
    var S = C.switchStyle || {};
    var w = S.width || "46px", h = S.height || "26px";
    var r = S.radius !== void 0 && S.radius !== "" ? S.radius : "100px";
    var kr = S.knobRadius !== void 0 && S.knobRadius !== "" ? S.knobRadius : "50%";
    var hueco = S.inset || "3px";
    var kw = "calc(" + h + " - " + hueco + " * 2 - 2px)";
    var izq = "calc(" + w + " - " + kw + " - " + hueco + " - 2px)";
    if (S.shape === "checkbox") {
      var lado = S.size || S.width || "20px";
      var rc = S.radius !== void 0 && S.radius !== "" ? S.radius : "3px";
      return ".cb-sw{position:relative;width:" + lado + ";height:" + lado + ";border-radius:" + rc + ";background:" + (S.off || K.switchOff) + ";border:" + (S.border || "1px solid " + K.borderStrong) + ";cursor:pointer;flex:none;padding:0;transition:background .16s,border-color .16s}.cb-sw[aria-checked='true']{background:" + (S.on || K.accent) + ";border-color:" + (S.onBorder || S.on || K.accent) + "}.cb-sw[disabled]{background:" + (S.locked || K.accentSoft) + ";border-color:" + (S.lockedBorder || K.accentPale) + ";opacity:.9;cursor:default}.cb-sw:focus-visible{outline:2px solid " + K.accent + ";outline-offset:2px}.cb-knob{position:absolute;left:0;right:0;top:0;bottom:0;margin:auto;width:28%;height:55%;border:solid " + (S.knobOn || K.textBright) + ";border-width:0 2px 2px 0;transform:translateY(-8%) rotate(45deg);opacity:0;transition:opacity .12s}.cb-sw[aria-checked='true'] .cb-knob,.cb-sw[disabled] .cb-knob{opacity:1}";
    }
    return ".cb-sw{position:relative;width:" + w + ";height:" + h + ";border-radius:" + r + ";background:" + (S.off || K.switchOff) + ";border:" + (S.border || "1px solid " + K.borderStrong) + ";cursor:pointer;flex:none;padding:0;transition:background .16s cubic-bezier(.2,.6,.2,1),border-color .16s}.cb-sw[aria-checked='true']{background:" + (S.on || K.accent) + ";border-color:" + (S.onBorder || S.on || K.accent) + "}.cb-sw[disabled]{background:" + (S.locked || K.accentSoft) + ";border-color:" + (S.lockedBorder || K.accentPale) + ";opacity:.9;cursor:default}.cb-sw:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}.cb-knob{position:absolute;top:" + hueco + ";left:" + hueco + ";width:" + kw + ";height:" + kw + ";border-radius:" + kr + ";background:" + (S.knob || pnBg) + ";box-shadow:0 1px 3px rgba(22,35,59,.25);transition:left .18s cubic-bezier(.2,.6,.2,1)}.cb-sw[aria-checked='true'] .cb-knob{left:" + izq + ";background:" + (S.knobOn || K.textBright) + "}.cb-sw[disabled] .cb-knob{left:" + izq + ";background:" + (S.knobOn || K.accent) + ";box-shadow:none}";
  }
  function chipAnchor(C) {
    var P = C.chip || {}, pos = P.position || "bottom-left";
    var x = P.offsetX || "16px", y = P.offsetY || "16px", out = "";
    out += (pos.indexOf("top") === 0 ? "top:" : "bottom:") + y + ";";
    out += (pos.indexOf("right") > -1 ? "right:" : "left:") + x + ";";
    return out;
  }
  function cssAMedida(C) {
    var t2 = C.customCss;
    if (!t2 || typeof t2 !== "string") return "";
    var limpio = t2.replace(/@import[^;]*;?/gi, "").replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, "none");
    limpio = limpio.replace(/<\/style/gi, "");
    if (limpio !== t2) log("css", "Se ignoraron partes del CSS a medida (@import o javascript:).");
    return "\n/* CSS a medida */\n" + limpio;
  }
  function bannerLayoutCss(C, BN) {
    var modo = BN.layout || "bar";
    if (modo !== "card" && modo !== "centered") return "";
    var r = BN.radius || "12px";
    var columna = ".cb-inner{flex-direction:column;align-items:stretch;gap:" + (BN.gap || "20px") + "}.cb-copy{flex:0 0 auto}.cb-actions{justify-content:flex-start}";
    var hueco = BN.inset || "clamp(16px,3vw,32px)";
    if (modo === "centered") {
      var alto = BN.position === "top" ? "flex-start" : BN.position === "bottom" ? "flex-end" : "center";
      return ".cb-banner{top:0;right:0;bottom:0;left:0;align-items:" + alto + ";justify-content:center;margin:0;padding:" + hueco + "}.cb-inner{max-width:" + (BN.centeredWidth || "520px") + ";border-radius:" + r + "}" + columna;
    }
    var vert = BN.position === "top" ? "top:" : "bottom:";
    var centrada = BN.align === "center";
    var hor = centrada ? "left:50%;transform:translateX(-50%);" : (BN.align === "right" ? "right:" : "left:") + hueco + ";";
    return ".cb-banner{top:auto;bottom:auto;left:auto;right:auto;" + vert + hueco + ";" + hor + "margin:0;padding:0;display:block;width:min(" + (BN.cardWidth || "420px") + ",calc(100vw - 2 * " + hueco + "))}.cb-inner{max-width:none;border-radius:" + r + "}" + columna;
  }
  function panelPlacementCss(C, PN) {
    var modo = PN.placement || "center";
    if (modo !== "side" && modo !== "bottom") return "";
    var r = PN.radius || "12px";
    var anim = PN.animate === false ? "" : ";animation:" + (modo === "side" ? "cb-slide-x" : "cb-slide-y") + " .24s cubic-bezier(.2,.6,.2,1)";
    if (modo === "side") {
      var lado = PN.side === "left" ? "flex-start" : "flex-end";
      return ".cb-overlay{align-items:stretch;justify-content:" + lado + ";padding:0}.cb-panel{height:100%;max-height:100%;width:100%;max-width:" + (PN.sideWidth || "480px") + ";border-radius:0;animation:none" + anim + "}.cb-foot{border-radius:0}";
    }
    return ".cb-overlay{align-items:flex-end;justify-content:center;padding:0}.cb-panel{width:100%;max-width:" + (PN.sheetWidth || "100%") + ";max-height:" + (PN.sheetHeight || "88vh") + ";border-radius:" + r + " " + r + " 0 0;animation:none" + anim + "}.cb-foot{border-radius:0}";
  }
  function css(C) {
    var K = C.colors, F = C.fonts;
    var BN = C.banner || {}, PN = C.panel || {}, BT = C.buttons || {}, CH = C.chip || {};
    var bnBg = BN.background || K.ink, bnFg = BN.color || K.text;
    var pnBg = PN.background || K.panelBg;
    var justify = BN.align === "left" ? "flex-start" : BN.align === "right" ? "flex-end" : "center";
    var vert = BN.position === "top" ? "top:0;bottom:auto;" : "bottom:0;top:auto;";
    return ":host{all:initial}*{box-sizing:border-box;font-family:" + F.body + "}" + // ---- Banner: tarjeta flotante sobre ink, no barra a sangre ----
    (BN.backdropOn && (BN.backdropCustom || BN.backdrop) ? ".cb-bdrop{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147482999;background:" + (BN.backdropCustom || BN.backdrop) + (BN.animate === false ? "" : ";animation:cb-fade .2s ease") + "}" : "") + ".cb-banner{position:fixed;left:0;right:0;" + vert + "z-index:2147483000;display:flex;justify-content:" + justify + ";padding:0;margin:" + (BN.margin || "0 20px 20px") + "}.cb-inner{width:100%;max-width:" + (BN.maxWidth || "1172px") + ";background:" + bnBg + ";color:" + bnFg + ";border:" + (BN.border || "1px solid rgba(255,255,255,.14)") + ";border-radius:" + (BN.radius || "12px") + ";box-shadow:" + (BN.shadow || "0 10px 40px rgba(15,24,38,.28)") + ";padding:" + (BN.padding || "22px 26px") + ";display:flex;flex-wrap:wrap;gap:" + (BN.gap || "28px") + ";align-items:center;justify-content:space-between" + (BN.animate === false ? "" : ";animation:cb-rise .26s cubic-bezier(.2,.6,.2,1)") + "}.cb-copy{flex:1 1 380px;display:flex;flex-direction:column;gap:" + (BN.copyGap || "8px") + ";min-width:0}.cb-eyebrow{margin:0;" + typo(C, "eyebrow") + "color:" + K.accentPale + "}.cb-gpc{margin:0;" + typo(C, "bannerText") + "color:" + K.accentPale + ";font-weight:600}.cb-gpcfila{display:block;margin-top:4px;font-size:.86em;font-weight:600;color:" + K.accentPale + "}.cb-ventafila{display:block;margin-top:4px;font-size:.86em;font-weight:600;color:" + (K.heading || K.ink) + "}.cb-ventaintro{margin:8px 0 0;" + typo(C, "panelIntro") + "font-weight:600;color:" + (K.heading || K.ink) + "}.cb-optout{position:fixed;left:16px;bottom:16px;z-index:2147483646;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:" + (BT.radius || "8px") + ";background:" + (K.panelBg || "#fff") + ";color:" + (K.heading || K.ink) + ";border:1px solid " + (K.border || "#ccc") + ";text-decoration:none;" + typo(C, "button") + "}.cb-optout:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}.cb-body{margin:0;" + typo(C, "bannerText") + "color:" + bnFg + ";max-width:68ch}.cb-body a{color:" + K.accentPale + ";text-decoration:underline;text-underline-offset:2px;white-space:nowrap}.cb-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end}.cb-btn{border:0;border-radius:" + (BT.radius || "8px") + ";" + typo(C, "button") + "cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,opacity .14s}.cb-btn:focus-visible{outline:2px solid " + K.accentPale + ";outline-offset:2px}.cb-ghost{" + btn(C, "reject", "transparent", bnFg) + "}.cb-ghost:hover{border-color:rgba(255,255,255,.6)}.cb-actions .cb-ghost:first-child{" + btn(C, "customize", "transparent", bnFg) + "}.cb-actions .cb-ghost:first-child:hover{text-decoration:underline;text-underline-offset:3px}.cb-accept{" + btn(C, "accept", K.accent, K.textBright) + "border-radius:" + (BT.radius || "8px") + "}" + // Simetria: misma caja para aceptar y rechazar. Va despues de las reglas
    // base a proposito, para ganarles sin depender del orden de las claves.
    (BT.equalWeight ? ".cb-actions .cb-btn:not(:first-child){padding:" + (BT.padding || "12px 22px") + ";border-width:1px;border-style:solid;font-weight:" + (BT.accept && BT.accept.weight || 600) + "}.cb-ghost:not(:first-child){border-color:" + bnFg + ";color:" + bnFg + "}.cb-accept{border-color:" + (BT.accept && BT.accept.background || K.accent) + "}" : "") + ".cb-accept:hover{background:" + K.accentHover + "}.cb-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483001;background:" + (PN.overlay || "rgba(22,35,59,.28)") + ";display:flex;align-items:center;justify-content:center;padding:24px" + (PN.animate === false ? "" : ";animation:cb-fade .2s ease") + "}.cb-panel{background:" + pnBg + ";color:" + K.heading + ";width:100%;max-width:" + (PN.maxWidth || "560px") + ";max-height:" + (PN.maxHeight || "92vh") + ";overflow:auto;border:1px solid " + K.border + ";border-radius:" + (PN.radius || "12px") + ";box-shadow:" + (PN.shadow || "0 20px 60px rgba(22,35,59,.28)") + (PN.animate === false ? "" : ";animation:cb-rise .24s cubic-bezier(.2,.6,.2,1)") + "}.cb-head{padding:" + (PN.headPadding || "28px 28px 20px") + ";display:flex;flex-direction:column;gap:10px;border-bottom:1px solid " + K.border + "}.cb-eyebrow2{margin:0;" + typo(C, "eyebrow") + "color:" + K.accentHover + "}.cb-panel h2{margin:0;" + typo(C, "panelTitle") + "color:" + K.heading + "}.cb-intro{margin:0;" + typo(C, "panelIntro") + "color:" + K.body + "}.cb-rows{display:flex;flex-direction:column}.cb-row{display:flex;gap:" + (PN.rowGap || "20px") + ";align-items:flex-start;padding:" + (PN.rowPadding || "20px 28px") + ";border-bottom:1px solid " + K.border + "}" + (PN.controlSide === "left" ? ".cb-row{flex-direction:row-reverse;justify-content:flex-end}" : "") + ".cb-close{position:absolute;top:" + (PN.closeTop || "24px") + ";right:" + (PN.closeRight || "24px") + ";background:none;border:0;padding:8px;cursor:pointer;color:" + K.heading + ";display:flex;line-height:0}.cb-panel{position:relative}.cb-row .t{flex:1 1 auto;display:flex;flex-direction:column;gap:5px;min-width:0}.cb-row .t strong{" + typo(C, "catName") + "color:" + K.heading + "}.cb-row .t span{" + typo(C, "catDesc") + "color:" + K.body + "}.cb-row .t .cb-pill{display:inline-block;margin-left:10px;font-family:" + F.mono + ";font-size:9px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:" + K.pillFg + ";background:" + K.pillBg + ";padding:4px 9px;border-radius:100px;vertical-align:middle}" + swCss(C, K, pnBg) + ".cb-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:" + K.cream + ";padding:" + (PN.footPadding || "20px 28px 24px") + ";border-radius:0 0 " + (PN.radius || "12px") + " " + (PN.radius || "12px") + "}.cb-btn2{border-radius:" + (BT.radius || "8px") + ";" + typo(C, "button") + "cursor:pointer;transition:background .14s,border-color .14s}.cb-btn2:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}.cb-panel:focus{outline:none}.cb-outline{background:transparent;border:1px solid " + K.borderStrong + ";color:" + K.heading + "}.cb-foot-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" + // Pie apilado: "rechazar" a todo el ancho arriba y los otros dos debajo.
    // Va despues de la regla base a proposito: si fuera antes, no ganaria.
    (PN.footLayout === "stacked" ? ".cb-foot{flex-direction:column;align-items:stretch}.cb-foot .cb-outline{width:100%;order:-1}.cb-foot-right{width:100%;justify-content:space-between}" : "") + ".cb-outline:hover{border-color:" + K.heading + "}.cb-text{background:transparent;border:0;color:" + K.heading + ";padding:" + (BT.text && BT.text.padding || BT.padding || "11px 14px") + "}.cb-text:hover{text-decoration:underline;text-underline-offset:3px}.cb-save{" + btn(C, "save", K.accent, K.textBright) + "border-radius:" + (BT.radius || "8px") + "}.cb-save:hover{background:" + K.accentHover + "}.cb-chip{position:fixed;" + chipAnchor(C) + "z-index:2147482999;display:none;align-items:center;gap:" + (CH.gap || "7px") + ";background:" + (CH.background || pnBg) + ";color:" + (CH.color || K.body) + ";border:" + (CH.border || "1px solid " + K.border) + ";border-radius:" + (CH.radius || "999px") + ";padding:" + (CH.padding || "8px 13px") + ";" + typo(C, "chip") + "cursor:pointer;box-shadow:" + (CH.shadow || "0 2px 6px rgba(22,35,59,.07)") + "}.cb-chip[data-on='1']{display:flex}.cb-chip img,.cb-chip svg{display:block;flex:0 0 auto;width:" + (CH.imageSize || "18px") + ";height:" + (CH.imageSize || "18px") + ";object-fit:contain}.cb-chip:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}" + /* Disposicion del banner y del panel. Van DESPUES de las reglas base a
       proposito: son variantes que las pisan. Sin estas claves, el CSS que se
       genera es exactamente el de siempre. */
    bannerLayoutCss(C, BN) + panelPlacementCss(C, PN) + "@keyframes cb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes cb-slide-x{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}@keyframes cb-slide-y{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes cb-fade{from{opacity:0}to{opacity:1}}@media (max-width:720px){.cb-inner{flex-direction:column;align-items:stretch;gap:18px}.cb-copy{flex:0 0 auto}.cb-actions{justify-content:flex-start}.cb-row{padding:18px 20px}.cb-head{padding:24px 20px 18px}.cb-foot{padding:18px 20px 20px;align-items:stretch;flex-direction:column}.cb-foot-right{justify-content:space-between}}@media (prefers-reduced-motion:reduce){.cb-inner,.cb-panel,.cb-overlay{animation:none}}";
  }
  function loadWebfont(C) {
    if (!C.webfont || document.getElementById("cb-webfont")) return;
    var l = document.createElement("link");
    l.id = "cb-webfont";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";
    (document.head || document.documentElement).appendChild(l);
  }
  function ensureRoot(C) {
    if (root) return;
    loadWebfont(C);
    var host = document.createElement("div");
    host.id = "consent-banner-host";
    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = css(C) + cssAMedida(C);
    shadow.appendChild(style);
    document.body.appendChild(host);
    pintaSelectorPrueba(C);
    root = shadow;
  }
  function idiomasDisponibles(C) {
    var set = {}, k;
    var tiene = function(o, k2) {
      return Object.prototype.hasOwnProperty.call(o, k2);
    };
    for (k in COPY) if (tiene(COPY, k)) set[k] = true;
    if (C && C.texts) {
      for (k in C.texts) if (tiene(C.texts, k)) set[k] = true;
    }
    var todos = [];
    for (k in set) if (tiene(set, k)) todos.push(k);
    if (C && C.languages && C.languages.length) {
      var permitidos = C.languages.map(function(x) {
        return String(x).toLowerCase();
      });
      var filtrados = todos.filter(function(x) {
        return permitidos.indexOf(x) !== -1;
      });
      if (filtrados.length) return filtrados;
    }
    return todos;
  }
  function normalizaIdioma(valor, disponibles) {
    if (!valor) return null;
    var v = String(valor).toLowerCase().replace("_", "-");
    if (disponibles.indexOf(v) !== -1) return v;
    var base = v.split("-")[0];
    return disponibles.indexOf(base) !== -1 ? base : null;
  }
  function detectaIdioma(C) {
    var disp = idiomasDisponibles(C), elegido = null, i;
    try {
      var q = location.search.match(/[?&]consentLang=([^&]+)/);
      if (q) elegido = normalizaIdioma(decodeURIComponent(q[1]), disp);
    } catch (e) {
    }
    if (!elegido && window.__consentLang) {
      elegido = normalizaIdioma(window.__consentLang, disp);
    }
    if (!elegido && C.autoDetectLanguage !== false) {
      var pref = [];
      try {
        if (navigator.languages && navigator.languages.length) {
          pref = Array.prototype.slice.call(navigator.languages);
        } else if (navigator.language) {
          pref = [navigator.language];
        }
      } catch (e) {
      }
      for (i = 0; i < pref.length && !elegido; i++) {
        elegido = normalizaIdioma(pref[i], disp);
      }
      if (!elegido) {
        try {
          var h = document.documentElement.getAttribute("lang");
          elegido = normalizaIdioma(h, disp);
        } catch (e) {
        }
      }
    }
    if (!elegido) elegido = normalizaIdioma(C.defaultLanguage, disp) || C.defaultLanguage || "es";
    return elegido;
  }
  function lang(obj, C) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    var candidatos = [state.lang, C && C.defaultLanguage, "es", "en"], i;
    for (i = 0; i < candidatos.length; i++) {
      var k = candidatos[i];
      if (k && obj[k] != null && obj[k] !== "") return obj[k];
    }
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && obj[key] !== "") return obj[key];
    }
    return "";
  }
  function urlSegura(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (u.charAt(0) === "/" || u.charAt(0) === "#") return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }
  function escAttr(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escHtml(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function policyLink(C, L) {
    var u = urlSegura(lang(C.policyUrl, C));
    if (!u) return "";
    var extra = C.policyNewTab === false ? "" : " target='_blank' rel='noopener noreferrer'";
    return "<a href='" + escAttr(u) + "'" + extra + ">" + escHtml(L.policy) + "</a>";
  }
  function t() {
    var C = merged();
    var base = COPY[state.lang] || COPY.es;
    var over = C.texts && C.texts[state.lang] || {};
    var out = {};
    var k;
    for (k in base) out[k] = base[k];
    for (k in over) out[k] = over[k];
    return out;
  }
  function buildBanner(C) {
    var L = t();
    var el = document.createElement("div");
    el.className = "cb-banner";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", L.eyebrow);
    el.innerHTML = "<div class='cb-inner'><div class='cb-copy'>" + (C.showEyebrow === false ? "" : "<p class='cb-eyebrow'>" + escHtml(L.eyebrow) + "</p>") + (state.gpcChoque ? "<p class='cb-gpc'>" + escHtml(L.gpcConflict || "Tu navegador pide que no vendamos ni compartamos tus datos, pero aqui ya habias aceptado. Dinos que prefieres.") + "</p>" : "") + // El enlace de politica NO se escapa: lo genera el bundle, no la config.
    // En opt-out el texto es otro: alli se pide permiso, aqui se informa
    // de algo que ya esta pasando y se dice como pararlo.
    "<p class='cb-body'>" + escHtml(state.modo === "optout" && L.bodyOptOut ? L.bodyOptOut : L.body) + " " + policyLink(C, L) + "</p></div><div class='cb-actions'><button class='cb-btn cb-ghost' data-a='manage'>" + escHtml(L.manage) + "</button><button class='cb-btn cb-ghost' data-a='reject'>" + escHtml(L.reject) + "</button><button class='cb-btn cb-accept' data-a='accept'>" + escHtml(L.accept) + "</button></div></div>";
    el.querySelector("[data-a='accept']").onclick = function() {
      acceptAll(C);
    };
    el.querySelector("[data-a='reject']").onclick = function() {
      rejectAll(C);
    };
    el.querySelector("[data-a='manage']").onclick = function() {
      openPanel(C);
    };
    return el;
  }
  function each(list, fn) {
    Array.prototype.slice.call(list).forEach(fn);
  }
  function buildPanel(C) {
    var L = t();
    var overlay = document.createElement("div");
    overlay.className = "cb-overlay";
    overlay.onclick = function(e) {
      if (e.target === overlay) hidePanel();
    };
    var rows = C.categories.map(function(cat, i) {
      var checked = cat.locked ? true : !!state.chosen[cat.id];
      var idEt = "cb-et-" + i, idDe = "cb-de-" + i;
      var pill = cat.locked && C.showAlwaysPill !== false ? " <span class='cb-pill'>" + escHtml(L.always) + "</span>" : "";
      var porGpc = !cat.locked && gpcActivo() && !checked ? "<span class='cb-gpcfila'>" + escHtml(L.gpcFila || "") + "</span>" : "";
      var porVenta = esVenta(cat) ? "<span class='cb-ventafila'>" + escHtml(L.ventaFila || "") + "</span>" : "";
      var rol = (C.switchStyle || {}).shape === "checkbox" ? "checkbox" : "switch";
      var etiquetas = " aria-labelledby='" + idEt + "' aria-describedby='" + idDe + "'";
      var control = cat.locked ? "<button class='cb-sw' role='" + rol + "' aria-checked='true' aria-disabled='true' disabled" + etiquetas + "><span class='cb-knob'></span></button>" : "<button class='cb-sw' role='" + rol + "' aria-checked='" + checked + "' data-cat='" + escAttr(cat.id) + "'" + etiquetas + "><span class='cb-knob'></span></button>";
      return "<div class='cb-row'><div class='t'><strong id='" + idEt + "'>" + escHtml(lang(cat.label, C)) + pill + "</strong><span id='" + idDe + "'>" + escHtml(lang(cat.desc, C)) + "</span>" + porVenta + porGpc + "</div>" + control + "</div>";
    }).join("");
    overlay.innerHTML = "<div class='cb-panel' role='dialog' aria-modal='true' tabindex='-1' aria-labelledby='cb-titulo'>" + ((C.panel || {}).showClose ? "<button class='cb-close' data-a='close' aria-label='" + escAttr(L.close || "Close") + "'><svg width='16' height='16' viewBox='0 0 16 16' stroke='currentColor' stroke-width='1.3'><line x1='1' y1='1' x2='15' y2='15'/><line x1='15' y1='1' x2='1' y2='15'/></svg></button>" : "") + "<div class='cb-head'>" + (C.showEyebrow === false ? "" : "<p class='cb-eyebrow2'>" + escHtml(L.panelEyebrow) + "</p>") + "<h2 id='cb-titulo'>" + escHtml(L.panelTitle) + "</h2><p class='cb-intro'>" + escHtml(L.panelIntro) + "</p>" + // Solo cuando se llega desde el enlace de exclusion, y solo si hay
    // algo marcado: si no, seria una frase que no corresponde a ninguna
    // fila y el visitante la buscaria sin encontrarla.
    (state.verVenta && hayMarcasDeVenta(C) ? "<p class='cb-ventaintro'>" + escHtml(L.ventaIntro || "") + "</p>" : "") + "</div><div class='cb-rows'>" + rows + "</div><div class='cb-foot'><button class='cb-btn2 cb-outline' data-a='reject'>" + escHtml(L.rejectOptional) + "</button><div class='cb-foot-right'><button class='cb-btn2 cb-text' data-a='accept'>" + escHtml(L.accept) + "</button><button class='cb-btn2 cb-save' data-a='save'>" + escHtml(L.save) + "</button></div></div></div>";
    each(overlay.querySelectorAll(".cb-sw[data-cat]"), function(sw) {
      sw.onclick = function() {
        sw.setAttribute("aria-checked", (sw.getAttribute("aria-checked") !== "true").toString());
      };
      sw.onkeydown = function(e) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          sw.click();
        }
      };
    });
    overlay.querySelector("[data-a='save']").onclick = function() {
      var chosen = {};
      C.categories.forEach(function(cat) {
        chosen[cat.id] = !!cat.locked;
      });
      each(overlay.querySelectorAll(".cb-sw[data-cat]"), function(sw) {
        chosen[sw.getAttribute("data-cat")] = sw.getAttribute("aria-checked") === "true";
      });
      persist(C, "custom", chosen);
    };
    overlay.onkeydown = function(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        hidePanel();
        return;
      }
      if (e.key !== "Tab") return;
      var f = enfocables(overlay);
      if (!f.length) return;
      var act = root && root.activeElement || document.activeElement;
      var i = indiceDe(f, act);
      if (e.shiftKey ? i <= 0 : i === f.length - 1 || i === -1) {
        e.preventDefault();
        f[e.shiftKey ? f.length - 1 : 0].focus();
      }
    };
    var btnClose = overlay.querySelector("[data-a='close']");
    if (btnClose) btnClose.onclick = function() {
      hidePanel();
    };
    overlay.querySelector("[data-a='reject']").onclick = function() {
      rejectAll(C);
    };
    overlay.querySelector("[data-a='accept']").onclick = function() {
      acceptAll(C);
    };
    return overlay;
  }
  var ICONO_PILL = "<svg viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'><path d='M12 3a9 9 0 1 0 9 9 4.5 4.5 0 0 1-4.5-4.5A4.5 4.5 0 0 1 12 3Z' stroke='currentColor' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9.2' cy='9.4' r='1.05' fill='currentColor'/><circle cx='8.4' cy='14.8' r='1.05' fill='currentColor'/><circle cx='13.9' cy='14.4' r='1.05' fill='currentColor'/></svg>";
  function buildChip(C) {
    var P = C.chip || {}, mode = P.mode || "text", label = t().chip, html = "";
    var img = P.image ? "<img src='" + escAttr(P.image) + "' alt='" + escAttr(P.imageAlt || "") + "'>" : ICONO_PILL;
    if (mode === "image") html = img;
    else if (mode === "both") html = img + "<span>" + escHtml(label) + "</span>";
    else html = "<span>" + escHtml(label) + "</span>";
    var el = document.createElement("button");
    el.className = "cb-chip";
    el.type = "button";
    el.innerHTML = html;
    if (mode === "image") el.setAttribute("aria-label", P.imageAlt || label);
    el.onclick = function() {
      openPanel(C);
    };
    return el;
  }
  var bdropEl = null;
  function showBackdrop(C) {
    var BN = C.banner || {};
    if (!BN.backdropOn || !(BN.backdropCustom || BN.backdrop)) return;
    if (!bdropEl) {
      bdropEl = document.createElement("div");
      bdropEl.className = "cb-bdrop";
      root.insertBefore(bdropEl, root.firstChild);
    }
    bdropEl.style.display = "";
    if (BN.backdropLock) {
      try {
        document.documentElement.style.overflow = "hidden";
      } catch (e) {
      }
    }
  }
  function hideBackdrop() {
    if (bdropEl) bdropEl.style.display = "none";
    try {
      document.documentElement.style.overflow = "";
    } catch (e) {
    }
  }
  function showBanner(C) {
    ensureRoot(C);
    if (!bannerEl) {
      bannerEl = buildBanner(C);
      root.appendChild(bannerEl);
    }
    bannerEl.style.display = "";
    showBackdrop(C);
  }
  function hideBanner() {
    if (bannerEl) bannerEl.style.display = "none";
    hideBackdrop();
  }
  function enfocables(caja) {
    var sel = "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
    var out = [];
    each(caja.querySelectorAll(sel), function(n) {
      if (n.offsetWidth || n.offsetHeight || n.getClientRects().length) out.push(n);
    });
    return out;
  }
  function visible(n) {
    if (!n || n.isConnected === false) return false;
    try {
      return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);
    } catch (e) {
      return false;
    }
  }
  function indiceDe(lista, n) {
    for (var i = 0; i < lista.length; i++) if (lista[i] === n) return i;
    return -1;
  }
  var focoPrevio = null;
  function openPanel(C) {
    if (panelEl) return;
    ensureRoot(C);
    focoPrevio = root && root.activeElement || document.activeElement || null;
    panelEl = buildPanel(C);
    root.appendChild(panelEl);
    var caja = panelEl.querySelector(".cb-panel");
    try {
      (caja || panelEl).focus();
    } catch (e) {
    }
  }
  function abrirDesdeTrigger(C) {
    if ((C.trigger || {}).opens === "banner") {
      hidePanel();
      if (chipEl) chipEl.removeAttribute("data-on");
      showBanner(C);
    } else {
      openPanel(C);
    }
  }
  function hidePanel() {
    if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
    panelEl = null;
    state.verVenta = false;
    var destino = visible(focoPrevio) ? focoPrevio : visible(chipEl) ? chipEl : null;
    focoPrevio = null;
    if (destino) {
      try {
        destino.focus();
      } catch (e) {
      }
    }
  }
  function optOutCfg(C) {
    var o = C.optOut || {};
    return {
      on: o.enabled === true,
      estilo: o.style === "dual" ? "dual" : "single",
      // Por urlSegura, igual que el enlace de politica. Sin esto, un
      // optOut.href con "javascript:..." escrito desde el panel ejecutaba
      // codigo en el sitio de todos los clientes al pulsar el enlace: el mismo
      // agujero que costo cerrar en el escapado, por otra puerta.
      icono: urlSegura(typeof o.icon === "string" ? o.icon : ""),
      href: urlSegura(typeof o.href === "string" ? o.href : ""),
      pintar: o.render === true
    };
  }
  function abrirExclusion(C) {
    hidePanel();
    state.verVenta = true;
    openPanel(C);
  }
  var _optOutVigila = false;
  function montaEnlaceExclusion(C) {
    var o = optOutCfg(C);
    if (!o.on) return;
    var L = t();
    var titulo = L.optOutTitle || "Your Privacy Choices";
    var nodos = [];
    try {
      nodos = Array.prototype.slice.call(
        document.querySelectorAll("[data-consent-optout]")
      );
    } catch (e) {
      nodos = [];
    }
    function tituloDe(n) {
      if (o.estilo !== "dual") return titulo;
      var cual = (n.getAttribute("data-consent-optout") || "").toLowerCase();
      return cual === "limit" ? L.optOutLimit || "Limit the Use of My Sensitive Personal Information" : L.optOutSell || "Do Not Sell or Share My Personal Information";
    }
    function viste(n) {
      if (n.getAttribute("data-consent-ready")) return;
      n.setAttribute("data-consent-ready", "1");
      var miTitulo = tituloDe(n);
      if (!n.innerHTML.replace(/\s/g, "")) {
        var img = o.icono && o.estilo !== "dual" ? "<img src='" + escAttr(o.icono) + "' alt='' width='28' height='14' style='vertical-align:middle;margin-right:6px'>" : "";
        n.innerHTML = img + "<span>" + escHtml(miTitulo) + "</span>";
      }
      if (!n.getAttribute("aria-label")) {
        n.setAttribute(
          "aria-label",
          o.estilo === "dual" ? miTitulo : L.optOutAria || miTitulo
        );
      }
      if (o.href && n.tagName === "A" && !n.getAttribute("href")) {
        n.setAttribute("href", o.href);
      }
      function navegaSolo() {
        return n.tagName === "A" && !!n.getAttribute("href") && n.getAttribute("href") !== "#";
      }
      n.addEventListener("click", function(e) {
        if (navegaSolo()) return;
        e.preventDefault();
        abrirExclusion(C);
      });
      if (!navegaSolo()) {
        if (!n.getAttribute("tabindex")) n.setAttribute("tabindex", "0");
        if (!n.getAttribute("role") && n.tagName !== "A" && n.tagName !== "BUTTON") {
          n.setAttribute("role", "button");
        }
        n.addEventListener("keydown", function(e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            abrirExclusion(C);
          }
        });
      }
    }
    nodos.forEach(viste);
    if (!_optOutVigila) {
      _optOutVigila = true;
      var repasa = function() {
        try {
          Array.prototype.slice.call(
            document.querySelectorAll("[data-consent-optout]")
          ).forEach(viste);
        } catch (e) {
        }
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", repasa);
      }
      setTimeout(repasa, 400);
      setTimeout(repasa, 1500);
      try {
        if (window.MutationObserver && document.documentElement) {
          new MutationObserver(repasa).observe(
            document.documentElement,
            { childList: true, subtree: true }
          );
        }
      } catch (e) {
      }
    }
    if (!nodos.length && o.pintar) {
      ensureRoot(C);
      if (root.querySelector(".cb-optout")) return;
      var cuales = o.estilo === "dual" ? ["sell", "limit"] : [""];
      cuales.forEach(function(cual) {
        var a = document.createElement("a");
        a.className = "cb-optout";
        a.href = o.href || "#";
        a.setAttribute("data-consent-optout", cual);
        root.appendChild(a);
        viste(a);
      });
    }
  }
  function showChip(C) {
    if (C.chip && C.chip.enabled === false) return;
    ensureRoot(C);
    if (!chipEl) {
      chipEl = buildChip(C);
      root.appendChild(chipEl);
    }
    chipEl.setAttribute("data-on", "1");
  }
  function gpcActivo() {
    try {
      return navigator.globalPrivacyControl === true;
    } catch (e) {
      return false;
    }
  }
  function gpcCategorias(C) {
    var g = C.gpc || {};
    var ids = g.categories && g.categories.length ? g.categories : null;
    var porVenta = !ids && esOptOut(C) && hayMarcasDeVenta(C);
    var chosen = {};
    C.categories.forEach(function(c) {
      if (c.locked) {
        chosen[c.id] = true;
        return;
      }
      if (ids) {
        chosen[c.id] = ids.indexOf(c.id) === -1;
        return;
      }
      chosen[c.id] = porVenta ? !esVenta(c) : false;
    });
    return chosen;
  }
  function aplicarGPC(C) {
    var chosen = gpcCategorias(C);
    var apagadas = Object.keys(chosen).filter(function(k) {
      return !chosen[k];
    });
    log("gpc", "Senal GPC detectada. Se deniega sin preguntar: " + (apagadas.join(", ") || "nada") + ".");
    state.gpc = true;
    persist(C, "gpc", chosen);
  }
  function acceptAll(C) {
    var chosen = {};
    var apaga = gpcActivo() ? gpcCategorias(C) : null;
    C.categories.forEach(function(c) {
      chosen[c.id] = apaga ? c.locked || apaga[c.id] === true : true;
    });
    if (apaga) {
      var frenadas = C.categories.filter(function(c) {
        return !c.locked && !chosen[c.id];
      }).map(function(c) {
        return c.id;
      });
      if (frenadas.length) {
        log("gpc", "Aceptar todas, pero la senal GPC mantiene apagadas: " + frenadas.join(", ") + ".");
      }
    }
    persist(C, apaga ? "all-gpc" : "all", chosen);
  }
  function rejectAll(C) {
    var chosen = {};
    C.categories.forEach(function(c) {
      chosen[c.id] = !!c.locked;
    });
    persist(C, "none", chosen);
  }
  function loadRemoteThen(C, done) {
    var base = String(C.apiBase).replace(/\/$/, "");
    var url = base + "/api/config?site_id=" + encodeURIComponent(C.siteId);
    var tkp = paramsPrueba().token || tokenPrueba();
    if (tkp) url += "&preview=" + encodeURIComponent(tkp);
    log("remote", "Pidiendo config remota: " + url);
    fetch(url).then(function(r) {
      return r.json();
    }).then(function(remote) {
      _remote = remote || {};
      _remote.endpoint = base + "/api/consent";
      _remote.apiBase = base;
      _remote.siteId = C.siteId;
      if (C.publicKey && !_remote.publicKey) _remote.publicKey = C.publicKey;
      _remoteLoaded = true;
      if (tkp && _remote._preview !== true) {
        try {
          localStorage.removeItem(PRUEBA_TK);
          localStorage.removeItem(PRUEBA_KEY);
        } catch (e) {
        }
      }
      log("remote", "Config remota cargada (site_id=" + C.siteId + ").");
      var cr = merged();
      _duroActivo = cr.hardBlocking !== false;
      installAutoBlock();
      if (_reglasVivas.length) scanExisting(_reglasVivas);
      gcmDefault(cr);
      if (_reglasVivas.length) log("autoblock", "Reglas desde la config remota: " + _reglasVivas.length + ".");
      done();
    }).catch(function() {
      _remoteLoaded = true;
      log("remote", "No se pudo cargar la config remota; se usa la local.");
      done();
    });
  }
  var _triggersOn = false;
  function installTriggers(C) {
    if (_triggersOn) return;
    _triggersOn = true;
    var T = C.trigger || {};
    document.addEventListener("click", function(ev) {
      var n = ev.target;
      while (n && n !== document) {
        if (n.nodeType === 1) {
          var esNuestro = n.hasAttribute && n.hasAttribute("data-consent-open");
          if (!esNuestro && T.selector) {
            try {
              esNuestro = n.matches && n.matches(T.selector);
            } catch (e) {
            }
          }
          if (esNuestro) {
            ev.preventDefault();
            ev.stopPropagation();
            abrirDesdeTrigger(merged());
            return;
          }
        }
        n = n.parentNode;
      }
    }, true);
    if (T.hash) {
      var mira = function() {
        if (location.hash.replace(/^#/, "").toLowerCase() === String(T.hash).toLowerCase()) {
          abrirDesdeTrigger(merged());
          try {
            history.replaceState(null, "", location.pathname + location.search);
          } catch (e) {
          }
        }
      };
      window.addEventListener("hashchange", mira);
      mira();
    }
  }
  function gtmLlegoAntes() {
    var yo = document.getElementById("consent-banner-host");
    var marca = null;
    try {
      marca = document.querySelector("script[src*='consent-banner']");
    } catch (e) {
    }
    var guias = [];
    try {
      guias = Array.prototype.slice.call(document.querySelectorAll(
        "script[src*='googletagmanager.com'],script[src*='gtm.js'],script[src*='gtag/js']"
      ));
    } catch (e) {
      return null;
    }
    if (!guias.length) return null;
    var ref = marca || yo;
    if (!ref) return null;
    for (var i = 0; i < guias.length; i++) {
      var pos = ref.compareDocumentPosition(guias[i]);
      if (pos & 2) return guias[i].getAttribute("src");
    }
    return null;
  }
  function avisaOrdenDeGtm(C) {
    if (C.safety && C.safety.gtmOrder === false) return;
    setTimeout(function() {
      var antes = gtmLlegoAntes();
      if (!antes) return;
      var txt = "Google Tag Manager se carga ANTES que el bloque de consentimiento (" + antes + "). Para cuando este corre, GTM ya ha evaluado sus disparadores: el consent default llega tarde y lo que tuviera que salir ya salio. Mueve el bloque de Instalar por encima de la etiqueta de GTM, lo primero del <head>.";
      log("orden", txt);
      try {
        if (window.console && console.warn) console.warn("[consent] " + txt);
      } catch (e) {
      }
      try {
        if (!C.apiBase || !C.siteId) return;
        var h = { "Content-Type": "application/json" };
        if (C.publicKey) h["X-Api-Key"] = C.publicKey;
        fetch(String(C.apiBase).replace(/\/$/, "") + "/api/aviso-instalacion", {
          method: "POST",
          keepalive: true,
          headers: h,
          body: JSON.stringify({
            site_id: C.siteId,
            tipo: "gtm_antes",
            detalle: String(antes).slice(0, 300),
            page: rutaDePagina()
          })
        }).catch(function() {
        });
      } catch (e) {
      }
    }, 1200);
  }
  function checkSafety(C) {
    var T = C.trigger || {};
    if (T.safety === false) return;
    if (!C.chip || C.chip.enabled !== false) return;
    setTimeout(function() {
      var hay = document.querySelector("[data-consent-open]");
      if (!hay && T.hash) {
        try {
          hay = document.querySelector("a[href$='#" + T.hash + "']");
        } catch (e) {
        }
      }
      if (!hay && T.selector) {
        try {
          hay = document.querySelector(T.selector);
        } catch (e) {
        }
      }
      if (!hay) {
        log("safety", "Pill oculto y sin ningun disparador en la pagina: se muestra el pill para no dejar al visitante sin forma de cambiar de opinion.");
        var C2 = merged();
        C2.chip = Object.assign({}, C2.chip || {}, { enabled: true });
        showChip(C2);
      }
    }, 1500);
  }
  function init() {
    var C = merged();
    if (C.siteId && C.apiBase && !_remoteLoaded) {
      loadRemoteThen(C, function() {
        proceed(merged());
      });
      return;
    }
    proceed(C);
  }
  function proceed(C) {
    installTriggers(C);
    try {
      montaEnlaceExclusion(C);
    } catch (e) {
      log("optout", "No se pudo montar el enlace: " + e.message);
    }
    try {
      avisaOrdenDeGtm(C);
    } catch (e) {
    }
    state.lang = detectaIdioma(C);
    log("init", "Idioma del banner: " + state.lang + " (navegador: " + (navigator.languages || [navigator.language || "?"])[0] + ").");
    var prev = readConsent(C);
    var gpcMandaAhora = gpcActivo() && !(C.gpc && C.gpc.enabled === false);
    var choque = prev && prev.version === C.consentVersion && gpcMandaAhora && prev.choice !== "gpc" && prev.gpc !== true;
    if (choque) {
      var modo = C.gpc && C.gpc.onConflict || "revoke";
      if (modo === "revoke") {
        log("gpc", "Habia una decision previa, pero la senal GPC es posterior: se revoca.");
        aplicarGPC(C);
        showChip(C);
        return;
      }
      if (modo === "ask") {
        log("gpc", "Habia una decision previa y llega senal GPC: se vuelve a preguntar.");
        state.gpcChoque = true;
        showBanner(C);
        return;
      }
      log("gpc", "Senal GPC ignorada: este sitio prioriza la decision previa (onConflict=keep).");
    }
    if (prev && prev.version === C.consentVersion) {
      state.chosen = prev.categories || {};
      log("init", "Decision previa encontrada (choice=" + prev.choice + ").");
      var sigPrev = signalsFrom(C, state.chosen);
      gtag("consent", "update", sigPrev);
      gcmAjustes(C);
      log("update", "Decision previa restaurada: " + JSON.stringify(sigPrev));
      if (C.activeDeletion) {
        deleteAnalyticsCookies(state.chosen);
        startDeletionWatch(C, state.chosen);
      }
      showChip(C);
      checkSafety(C);
      refreshAutoBlock(C, state.chosen);
      activateScripts(C, state.chosen);
    } else if (esOptOut(C) && !gpcMandaAhora) {
      state.chosen = eleccionPorDefecto(C);
      state.modo = "optout";
      var sigOO = signalsFrom(C, state.chosen);
      gtag("consent", "update", sigOO);
      gcmAjustes(C);
      log("region", "Regimen opt-out (" + (C._region && (C._region.rule || C._region.country) || "por defecto") + "): lo opcional arranca concedido. " + JSON.stringify(sigOO));
      refreshAutoBlock(C, state.chosen);
      activateScripts(C, state.chosen);
      showBanner(C);
    } else if (gpcMandaAhora) {
      aplicarGPC(C);
      showChip(C);
    } else {
      log("init", prev ? "Version de consentimiento cambio: se vuelve a preguntar." : "Sin decision previa: se muestra el banner.");
      if (prev) {
        var sigCero = signalsFrom(C, {});
        gtag("consent", "update", sigCero);
        gcmAjustes(C);
        log("update", "Version caducada: se revoca mientras se vuelve a preguntar.");
      }
      showBanner(C);
    }
    startDiscovery(C);
  }
  function blockNow() {
    gcmDefault(merged());
    installAutoBlock();
    instalarBloqueoDuro(merged());
  }
  function start(config) {
    if (config) {
      _userConfig = config;
    }
    init();
  }
  function open() {
    openPanel(merged());
  }
  function openPrivacyChoices() {
    abrirExclusion(merged());
  }
  function saleCategories() {
    return (merged().categories || []).filter(esVenta).map(function(c) {
      return c.id;
    });
  }
  function reset() {
    var C = merged();
    document.cookie = cookieName(C) + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    location.reload();
  }
  function setLanguage(l) {
    var C = merged();
    var disp = idiomasDisponibles(C);
    var norm = normalizaIdioma(l, disp);
    if (!norm) {
      log("lang", "Idioma no disponible: " + l + ". Se mantiene " + state.lang + ".");
      return;
    }
    if (norm === state.lang) return;
    state.lang = norm;
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
      showBanner(C);
    }
    if (panelEl) {
      var venta = state.verVenta;
      hidePanel();
      state.verVenta = venta;
      openPanel(C);
    }
    if (chipEl) {
      chipEl.remove();
      chipEl = null;
      showChip(C);
    }
  }
  function getLanguage() {
    return state.lang;
  }
  var core_default = {
    start,
    open,
    reset,
    setLanguage,
    getLanguage,
    blockNow,
    openPrivacyChoices,
    saleCategories
  };

  // src/auto.js
  if (typeof document !== "undefined") {
    try {
      core_default.blockNow();
    } catch (e) {
    }
    run = function() {
      core_default.start();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }
  var run;
  var auto_default = core_default;
  return __toCommonJS(auto_exports);
})();

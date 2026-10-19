// core.js — logica del banner como modulo ESM, sin efectos secundarios.
//
// FUENTE UNICA DE VERDAD del bundle. De aqui salen, via build.js:
//   dist/consent-banner.esm.js   para bundlers
//   dist/consent-banner.umd.js   global window.ConsentBanner, auto-arranque
//   dist/consent-banner.min.js   el que sirve el backend y el CDN
//
// Incluye config remota (siteId + apiBase -> GET /api/config), diseno
// Expediente y borrado activo. Nada de esto se duplica ya en el backend.
let _userConfig = null;


  // ---- Config por defecto (todo sobreescribible por el cliente) -------------
  var DEFAULTS = {
    // Bloqueo endurecido: cierra iframes, pixeles, fetch, XHR, sendBeacon y la
    // escritura de cookies de categorias denegadas. Lo bloqueado no deja un
    // hueco: se sustituye por un marcador del mismo tamano que explica que
    // falta y concede esa categoria con un boton. Se apaga con
    // hardBlocking:false.
    hardBlocking: true,
    namespace: "fwc_consent",          // prefijo de cookie y de eventos dataLayer
    gtmId: "",                     // vacio = modo sin GTM (gtag directo)
    endpoint: "",                  // vacio = sin auditoria backend
    consentVersion: "2025-01",     // al cambiar, se vuelve a preguntar
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
      hash: "cookies",          // #cookies abre el panel; "" lo desactiva
      selector: "",             // selector extra del tema, si ya tiene su enlace
      safety: true,             // si el pill esta oculto y no hay disparador, mostrarlo
      text: { es: "Preferencias de cookies", en: "Cookie preferences" },
      mode: "link",             // link | button, solo afecta al codigo que genera el panel
      style: {
        color: "", background: "", border: "", radius: "6px",
        padding: "8px 14px", fontSize: "14px", fontWeight: "500",
        fontFamily: "", underline: true
      }
    },
    // Interruptores del panel. Vacio = los de siempre.
    switchStyle: {
      // shape: "switch" (interruptor deslizante) o "checkbox" (casilla con tic).
      shape: "switch",
      width: "", height: "", radius: "", knobRadius: "", inset: "",
      on: "", off: "", border: "", onBorder: "", knob: "", knobOn: ""
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
    autoDetectLanguage: true,          // mirar el idioma del navegador
    languages: ["es", "en"],           // idiomas que el sitio admite
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
      ink: "#16233B",          // --ink-900, fondo del banner
      inkSoft: "#21344F",      // --ink-800
      accent: "#2F7E6C",       // --brass-500
      accentHover: "#2A7062",  // --brass-600
      accentSoft: "#DCEEE9",   // --brass-100
      accentPale: "#8FD3C2",   // --brass-300, eyebrow y enlaces sobre ink
      text: "#F5F0E6",         // --paper-100, texto sobre ink
      textBright: "#FBF8F1",   // --paper-50
      heading: "#16233B",      // --text-strong
      body: "#5A6673",         // --slate-500
      border: "#D3D8DE",       // --slate-200
      borderStrong: "#8A94A0", // --slate-400
      switchOff: "#E7EAEE",    // --slate-100
      pillFg: "#3E6B54",       // --pine-600
      pillBg: "#E1EBE3",       // --pine-100
      cream: "#F5F0E6",        // pie del panel (--surface-sunken)
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
      layout: "bar",             // bar | card | centered
      position: "bottom",        // bottom | top
      align: "center",           // left | center | right
      inset: "",                 // separacion al borde en card/centered
      cardWidth: "420px",        // ancho de la tarjeta en layout card
      centeredWidth: "520px",    // ancho de la tarjeta en layout centered
      maxWidth: "1172px",
      padding: "22px 26px",
      margin: "0 20px 20px",     // separacion respecto al borde de la ventana
      radius: "12px",
      gap: "28px",               // entre el bloque de texto y los botones
      copyGap: "8px",            // entre eyebrow, titulo y cuerpo
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
      animate: true,   // false quita la subida del banner
      background: "",            // vacio = usa colors.ink
      color: ""                  // vacio = usa colors.text
    },

    // Medidas del panel de preferencias.
    panel: {
      placement: "center",   // center | side | bottom
      side: "right",         // right | left, solo con placement side
      sideWidth: "480px",    // ancho de la hoja lateral
      sheetWidth: "100%",    // ancho de la hoja inferior
      sheetHeight: "88vh",   // alto maximo de la hoja inferior
      footLayout: "row",     // row | stacked
      maxWidth: "560px",
      maxHeight: "92vh",
      radius: "12px",
      headPadding: "28px 28px 20px",
      rowPadding: "20px 28px",
      footPadding: "20px 28px 24px",
      rowGap: "20px",
      shadow: "0 20px 60px rgba(22,35,59,.28)",
      animate: true,   // false quita la entrada del panel y del velo
      overlay: "rgba(22,35,59,.28)",
      background: ""             // vacio = usa colors.panelBg
    },

    // Tipografia por elemento. size/weight/lineHeight/letterSpacing/transform,
    // y family para elegir entre heading, body o mono (o una pila propia).
    typography: {
      eyebrow:   { family: "mono",    size: "10px",   weight: 400, letterSpacing: ".14em", transform: "uppercase" },
      bannerText:{ family: "body",    size: "15px",   weight: 400, lineHeight: 1.55 },
      panelTitle:{ family: "heading", size: "26px",   weight: 500, lineHeight: 1.2, letterSpacing: "-.01em" },
      panelIntro:{ family: "body",    size: "14px",   weight: 400, lineHeight: 1.6 },
      catName:   { family: "body",    size: "15px",   weight: 700 },
      catDesc:   { family: "body",    size: "13.5px", weight: 400, lineHeight: 1.55 },
      button:    { family: "body",    size: "14px",   weight: 500 },
      chip:      { family: "mono",    size: "11px",   weight: 400, letterSpacing: ".1em", transform: "uppercase" }
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
      accept:    { background: "", color: "", border: "0",  weight: 600, padding: "" },
      reject:    { background: "transparent", color: "", border: "1px solid rgba(255,255,255,.32)", weight: 500, padding: "" },
      customize: { background: "transparent", color: "", border: "0", weight: 500, padding: "" },
      save:      { background: "", color: "", border: "0",  weight: 600, padding: "" }
    },

    // El pill que reabre el panel una vez cerrado.
    // mode: "text" | "image" | "both". Con imagen, image es una URL.
    chip: {
      enabled: true,
      mode: "text",
      image: "",
      imageSize: "18px",
      imageAlt: "",
      position: "bottom-left",   // bottom-left | bottom-right | top-left | top-right
      offsetX: "16px",
      offsetY: "16px",
      padding: "8px 13px",
      radius: "999px",
      gap: "7px",
      background: "",            // vacio = colors.panelBg
      color: "",                 // vacio = colors.body
      border: "",                // vacio = 1px solid colors.border
      shadow: "0 2px 6px rgba(22,35,59,.07)"
    },

    // Carga IBM Plex desde Google Fonts. Ponlo en false si la CSP del sitio
    // bloquea fonts.googleapis.com: se cae a las fuentes del sistema.
    webfont: true,
    // Inventario de cookies: el bundle reporta al backend que NOMBRES de cookie
    // aparecen en el sitio, para poder clasificarlos desde el dashboard.
    // Nunca se envia el valor de la cookie, solo el nombre.
    cookieDiscovery: false,
    discoverySeconds: 15,      // cuantos segundos se sigue mirando tras cargar
    activeDeletion: true,
    manageScripts: false,          // bloqueo manual de scripts para sitios sin GTM
    // Categorias por defecto. Mapean a las 6 senales de Consent Mode v2.
    categories: [
      { id: "necessary",  locked: true,  granted: true,
        label: { es: "Necesarias", en: "Necessary" },
        desc:  { es: "Imprescindibles para que el sitio cargue y funcione.",
                 en: "Required for the site to load and work." },
        signals: ["functionality_storage"] },
      { id: "statistics", locked: false, granted: false,
        label: { es: "Estadisticas", en: "Statistics" },
        desc:  { es: "Google Analytics y medicion de uso.",
                 en: "Google Analytics and usage measurement." },
        signals: ["analytics_storage"] },
      { id: "marketing",  locked: false, granted: false,
        label: { es: "Marketing", en: "Marketing" },
        desc:  { es: "Google Ads, remarketing y pixeles de campana.",
                 en: "Google Ads, remarketing and campaign pixels." },
        signals: ["ad_storage", "ad_user_data", "ad_personalization"] }
    ],
    onConsentChange: null
  };

  var ALL_SIGNALS = [
    "analytics_storage", "ad_storage", "ad_user_data",
    "ad_personalization", "functionality_storage", "personalization_storage"
  ];
  // security_storage no se deniega nunca: es seguridad, no seguimiento, y
  // Google la espera en el bloque. Va aparte para que no entre en el bucle que
  // pone todo en "denied".
  var SIEMPRE = { security_storage: "granted" };

  var COPY = {
    es: {
      gpcConflict: "Tu navegador pide que no vendamos ni compartamos tus datos, pero aqui ya habias aceptado. Dinos que prefieres.",
      eyebrow: "Cookies",
      body: "Usamos cookies para que el sitio funcione y, con tu permiso, para medir su uso y mostrarte contenido relevante.",
      policy: "Politica de cookies",
      blockedBody: "Este contenido de {host} esta bloqueado hasta que aceptes las cookies de {cat}.",
      blockedBtn: "Aceptar {cat}",
      manage: "Personalizar", reject: "Solo necesarias", accept: "Aceptar todas",
      rejectOptional: "Rechazar las opcionales",
      panelEyebrow: "Tu control",
      panelTitle: "Gestiona tus cookies",
      panelIntro: "Las esenciales no se pueden desactivar. Lo demas lo decides tu.",
      always: "Siempre activas", save: "Guardar preferencias",
      chip: "Cookies", close: "Cerrar"
    },
    en: {
      gpcConflict: "Your browser asks us not to sell or share your data, but you had accepted here before. Tell us what you prefer.",
      eyebrow: "Cookies",
      body: "We use cookies so the site works and, with your permission, to measure usage and show you relevant content.",
      policy: "Cookie policy",
      blockedBody: "This content from {host} is blocked until you accept {cat} cookies.",
      blockedBtn: "Accept {cat}",
      manage: "Customize", reject: "Necessary only", accept: "Accept all",
      rejectOptional: "Reject optional",
      panelEyebrow: "Your control",
      panelTitle: "Manage your cookies",
      panelIntro: "Essential cookies can't be turned off. Everything else is up to you.",
      always: "Always on", save: "Save preferences",
      chip: "Cookies", close: "Close"
    }
  };

  // ---- Utilidades -----------------------------------------------------------
  function cfg() { return window.__consentConfig || DEFAULTS; }
  var _remote = null, _remoteLoaded = false;
  // Mezcla profunda para objetos planos (colors, fonts, cookie, texts): si el
  // cliente solo define colors.accent, el resto de la paleta sigue viva.
  // Los arrays (categories) se reemplazan enteros, como antes.
  function isPlain(v) {
    return v && typeof v === "object" && !(v instanceof Array) && typeof v !== "function";
  }
  function assign(target, src) {
    for (var k in src) {
      if (!src.hasOwnProperty(k)) continue;
      if (isPlain(src[k]) && isPlain(target[k])) assign(target[k], src[k]);
      else target[k] = src[k];
    }
    return target;
  }
  /* Plantillas base, versionadas.
     DEFAULTS no se toca nunca: es lo que ven los sitios que llevan tiempo en
     produccion, y cambiarlo les movería el banner sin avisar. Una plantilla es
     un parche que se aplica encima y solo si la config lo pide con
     "template". Asi el rediseño llega a los sitios nuevos, y los antiguos lo
     adoptan cuando su dueño quiera. La config del cliente siempre gana sobre
     la plantilla: el parche va antes del assign de local. */
  var TEMPLATES = {
    "base-2026": {
      // 1. Simetria: rechazar cuesta lo mismo que aceptar.
      buttons: { equalWeight: true, padding: "12px 22px" },
      // 2. Una familia y dos tamanos; el peso hace la jerarquia. Sin mono,
      //    sin mayusculas y sin espaciado en los rotulos del sistema.
      typography: {
        eyebrow:   { family: "body", size: "12px", weight: 600, letterSpacing: "", transform: "none" },
        catName:   { family: "body", size: "14.5px", weight: 500, letterSpacing: "", transform: "none" },
        button:    { family: "body", size: "14px", weight: 500, letterSpacing: "", transform: "none" },
        chip:      { family: "body", size: "13px", weight: 500, letterSpacing: "", transform: "none" }
      },
      // 3. El rotulo de encima del titulo y la pildora de "siempre activas"
      //    no aportan informacion: el texto ya lo dice.
      showEyebrow: false,
      showAlwaysPill: false,
      // 4. Sin sombras y sin animacion de entrada: separa el borde de 1px.
      //    La animacion retrasa el primer clic y en moviles lentos lo falla.
      banner: { shadow: "none", animate: false },
      panel:  { shadow: "none", animate: false },
      // 5. El acento sale del verde y pasa a la tinta de marca. Un verde en un
      //    interruptor copia el de iOS y sugiere "correcto" donde solo hay una
      //    eleccion neutral.
      colors: { accent: "#1A1A1A", accentHover: "#333333", pillBg: "#EDEDED", pillFg: "#1A1A1A" }
    }
  };

  /* Modo de prueba: el cliente llega desde el dashboard con ?consentTheme=x,
     el bundle lo recuerda en este navegador y enseña un selector flotante para
     ir comparando sin tocar la URL. Un visitante normal nunca lo activa porque
     nunca llega con el parametro. */
  var PRUEBA_KEY = "cb_theme_preview";
  function leeParam(n) {
    try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; }
  }
  var BASE_MARCA = "__base";   // "ver la base", distinto de "no estar en prueba"

  function modoPrueba() {
    var p = leeParam("consentTheme");
    if (p !== null) {
      var v = (p === "" || p === "base") ? BASE_MARCA : p;
      try { localStorage.setItem(PRUEBA_KEY, v); } catch (e) {}
      // Se quita de la URL: si se quedara, al recargar volveria a imponerse y
      // lo elegido en el selector no duraria ni un clic.
      try {
        var u = new URL(location.href);
        u.searchParams.delete("consentTheme");
        history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      } catch (e) {}
      return v;
    }
    try { return localStorage.getItem(PRUEBA_KEY); } catch (e) { return null; }
  }
  function salirDePrueba() {
    try { localStorage.removeItem(PRUEBA_KEY); } catch (e) {}
    location.reload();
  }

  function temaActivo(m) {
    var t = m.themes || {};
    var prueba = modoPrueba();
    if (prueba === BASE_MARCA) return "";
    if (prueba && t[prueba]) return prueba;
    if (m.theme && t[m.theme]) return m.theme;
    return "";
  }


  /* Barrita de prueba. Vive FUERA del shadow DOM del banner, en su propio
     host, para que no herede sus estilos ni estorbe al medirlo. */
  function pintaSelectorPrueba(C) {
    if (!modoPrueba()) return;
    var nombres = Object.keys(C.themes || {});
    if (!nombres.length) return;
    if (document.getElementById("consent-theme-preview")) return;

    var caja = document.createElement("div");
    caja.id = "consent-theme-preview";
    var sh = caja.attachShadow ? caja.attachShadow({ mode: "open" }) : caja;
    var activo = C._temaActivo || "";
    var botones = [[BASE_MARCA, "Base"]].concat(nombres.map(function (n) { return [n, n]; }))
      .map(function (x) {
        var on = (x[0] === BASE_MARCA) ? !activo : (x[0] === activo);
        return "<button data-t='" + x[0] + "'" + (on ? " class='on'" : "") + ">" + x[1] + "</button>";
      }).join("");
    var st = document.createElement("style");
    st.textContent =
      ".w{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:2147483646;" +
      "display:flex;align-items:center;gap:6px;padding:6px;border-radius:10px;" +
      "background:#14243D;color:#F7F6F2;box-shadow:0 6px 24px rgba(0,0,0,.28);" +
      "font:500 12px/1 system-ui,-apple-system,sans-serif}" +
      ".t{padding:0 8px;opacity:.6;white-space:nowrap}" +
      "button{border:0;border-radius:6px;padding:7px 12px;cursor:pointer;" +
      "background:transparent;color:inherit;font:inherit;text-transform:capitalize}" +
      "button:hover{background:rgba(255,255,255,.12)}" +
      "button.on{background:#F7F6F2;color:#14243D}" +
      ".x{opacity:.6;padding:7px 9px}";
    var w = document.createElement("div");
    w.className = "w";
    w.innerHTML = "<span class='t'>Vista de prueba</span>" + botones + "<button class='x' data-x='1'>&times;</button>";
    sh.appendChild(st); sh.appendChild(w);
    document.body.appendChild(caja);

    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      if (b.getAttribute("data-x")) { salirDePrueba(); return; }
      var t = b.getAttribute("data-t");
      try { localStorage.setItem(PRUEBA_KEY, t); } catch (err) {}
      // Recargamos a proposito: el tema toca estilos que se calculan al montar.
      location.reload();
    });
  }

  function merged() {
    var m = JSON.parse(JSON.stringify(DEFAULTS));
    var local = _userConfig || (typeof window !== "undefined" && window.__consentConfig) || {};
    var plantilla = (_remote && _remote.template) || local.template || "";
    if (plantilla && TEMPLATES[plantilla]) {
      assign(m, JSON.parse(JSON.stringify(TEMPLATES[plantilla])));
    }
    assign(m, local);
    if (_remote) {
      var localBlock = m.autoBlock;
      assign(m, _remote);
      // Un autoBlock vacio en la config remota NO debe borrar el del snippet
      // inline: el inline es el unico que llega a tiempo de bloquear el parser.
      if ((!m.autoBlock || !m.autoBlock.length) && localBlock && localBlock.length) {
        m.autoBlock = localBlock;
      }
    }
    // El tema va el ultimo: es una variante de lo ya configurado, no una base.
    var th = temaActivo(m);
    if (th) {
      var parche = JSON.parse(JSON.stringify(m.themes[th]));
      // El CSS del tema se SUMA al del sitio, no lo reemplaza: si no, elegir un
      // tema borraria todo el CSS a medida que el cliente tenga escrito.
      var extra = parche.customCss; delete parche.customCss;
      assign(m, parche);
      if (extra) m.customCss = (m.customCss || "") + "\n" + extra;
      m._temaActivo = th;
    }
    return m;
  }
  function log(kind, detail) {
    // Puente para la consola de eventos de la demo (no afecta a produccion).
    if (typeof window.__consentLog === "function") window.__consentLog(kind, detail);
  }

  // ---- Google Consent Mode ---------------------------------------------
  // Dos modos, como los de Google:
  //
  //   "basic"    (por defecto) los tags se bloquean hasta que haya permiso.
  //              Es lo que hace autoBlock. El cliente pierde la medicion de
  //              quien rechaza, pero a Google no le llega nada.
  //   "advanced" los tags se cargan denegados y se actualizan al decidir.
  //              Google recibe pings sin cookies mientras tanto, con user
  //              agent, resolucion e IP, y con eso modela lo que falta.
  //
  // El modo avanzado es incompatible con bloquear los dominios de Google: si
  // el script no corre, no hay nadie escuchando el consent update.
  function modoConsent(C) {
    return (C.gcm && C.gcm.mode) === "advanced" ? "advanced" : "basic";
  }

  // El "default" deberia ir INLINE en el head del sitio, antes que ningun tag.
  // Desde aqui llega tarde para un tag que ya corra, pero sirve de red para el
  // caso normal (el bundle carga antes que GTM) y para los que se insertan
  // despues. El snippet de instalacion lo incluye tambien.
  function gcmDefault(C) {
    if (modoConsent(C) !== "advanced" || state.gcmDefault) return;
    state.gcmDefault = true;
    var d = {};
    ALL_SIGNALS.forEach(function (s) { d[s] = "denied"; });
    for (var k in SIEMPRE) d[k] = SIEMPRE[k];
    var espera = (C.gcm && C.gcm.waitForUpdate);
    d.wait_for_update = (espera === undefined || espera === null) ? 1500 : espera;
    gtag("consent", "default", d);
    gcmAjustes(C);
    log("gcm", "Consent Mode avanzado: default denegado, wait_for_update=" + d.wait_for_update);
  }

  function gcmAjustes(C) {
    var g = C.gcm || {};
    // Redacta los identificadores de clic publicitario mientras no haya
    // permiso; pasa la campana por la URL en vez de por cookie.
    gtag("set", "ads_data_redaction", g.adsDataRedaction !== false);
    gtag("set", "url_passthrough", g.urlPassthrough === true);
  }

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag === "function") window.gtag.apply(null, arguments);
    else window.dataLayer.push(arguments);
  }

  function cookieName(C) { return C.namespace + "_cookie_consent"; }

  function readConsent(C) {
    var name = cookieName(C) + "=";
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(name) === 0) {
        try { return JSON.parse(decodeURIComponent(p.substring(name.length))); }
        catch (e) { return null; }
      }
    }
    return null;
  }

  function writeConsent(C, obj) {
    var d = new Date();
    d.setMonth(d.getMonth() + (C.cookie.lifetimeMonths || 6));
    var v = encodeURIComponent(JSON.stringify(obj));
    var str = cookieName(C) + "=" + v + ";expires=" + d.toUTCString() +
              ";path=/;SameSite=Lax";
    if (C.cookie.domain) str += ";domain=" + C.cookie.domain;
    document.cookie = str;
  }

  // Mapea las categorias elegidas a las 6 senales de Consent Mode v2.
  function signalsFrom(C, chosen) {
    var out = {};
    for (var k in SIEMPRE) out[k] = SIEMPRE[k];
    ALL_SIGNALS.forEach(function (s) { out[s] = "denied"; });
    C.categories.forEach(function (cat) {
      var granted = cat.locked ? true : !!chosen[cat.id];
      // signals es opcional: una categoria sin ella tiraba todo el arranque
      // con "cannot read properties of undefined", y el banner se quedaba a
      // medias sin que nada lo dijera.
      if (granted && cat.signals) cat.signals.forEach(function (s) { out[s] = "granted"; });
    });
    return out;
  }

  // Normaliza cookiePatterns a [{match, category}]. Admite los dos formatos:
  //   ["_ga", "__hs"]                                  (heredado: sin categoria)
  //   [{match:"_ga", category:"analitica"}, ...]        (por categoria)
  // Un patron sin categoria se borra siempre que se ejecute el borrado, como antes.
  function normalizePatterns(C) {
    var raw = (C.cookiePatterns && C.cookiePatterns.length)
      ? C.cookiePatterns
      : ["_ga", "_gid", "_gat", "__utm", "_gcl"];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (typeof p === "string") out.push({ match: p, category: null });
      else if (p && p.match) out.push({ match: p.match, category: p.category || null });
    }
    return out;
  }

  // Vigilancia del borrado. Un solo pase no basta: los scripts de terceros que
  // no se pueden bloquear escriben sus cookies despues de que el banner arranque,
  // asi que al recargar reaparecen. Aqui se repasa durante unos segundos.
  var _watchTimer = null;

  function stopDeletionWatch() {
    if (_watchTimer) { clearInterval(_watchTimer); _watchTimer = null; }
  }

  function startDeletionWatch(C, chosen) {
    stopDeletionWatch();
    var secs = C.deletionWatchSeconds;
    if (secs === undefined || secs === null) secs = 20;
    if (!C.activeDeletion || secs <= 0) return;

    var every = 1000;                       // un repaso por segundo
    var left = Math.ceil(secs * 1000 / every);
    var total = 0;

    var sweep = function () {
      var gone = deleteAnalyticsCookies(chosen, true);   // silencioso
      if (gone && gone.length) total += gone.length;
      if (--left <= 0) {
        stopDeletionWatch();
        if (total) log("delete", "Vigilancia: " + total + " reescritura(s) borrada(s) en " + secs + "s.");
      }
    };

    // Un repaso en cuanto la pagina termina de cargar (ahi suele escribir el
    // grueso de los terceros) y luego el barrido periodico.
    if (document.readyState === "complete") sweep();
    else window.addEventListener("load", sweep);
    _watchTimer = setInterval(sweep, every);
  }

  // Borrado ACTIVO de cookies, por categoria denegada.
  // Antes se borraba todo o nada segun analytics_storage, asi que al aceptar
  // analitica y rechazar marketing las cookies de marketing sobrevivian.
  // Ahora cada patron se borra solo si SU categoria quedo denegada.
  // Nombres que huelen a sesion, login o seguridad. Misma lista que el
  // clasificador del servidor, replicada aqui porque alla solo protege la
  // SUGERENCIA: si alguien la acepta sin mirar, o teclea el patron a mano, el
  // banner dejaria al visitante sin sesion. Es la ultima comprobacion antes de
  // bloquear una escritura o de borrar una cookie.
  var SOSPECHOSAS = ["session", "sess", "auth", "token", "csrf", "xsrf", "login",
                     "logged", "sid", "jwt", "oauth", "saml", "identity", "secure"];

  // La red de arriba va por subcadena, y "sid" tapa de paso la familia
  // publicitaria de Google entera: __Secure-3PSID, APISID, HSID y companeras
  // son marketing de manual. No hay regla de subcadena que las distinga de
  // PHPSESSID o JSESSIONID, asi que van por nombre exacto. Conjunto cerrado y
  // documentado; se dejan fuera "sid", "lsid" y "osid" a secas porque en un
  // sitio pequeno pueden ser su cookie de sesion.
  var PESE_A_TODO = ["__secure-1psid", "__secure-3psid", "__secure-1psidcc",
    "__secure-3psidcc", "__secure-1psidts", "__secure-3psidts",
    "__secure-1papisid", "__secure-3papisid", "__secure-osid",
    "__host-1plsid", "__host-3plsid",
    "apisid", "sapisid", "hsid", "ssid", "dsid", "sidcc", "fpgsid"];

  function esSospechosa(nombre) {
    var bajo = String(nombre || "").toLowerCase();
    if (PESE_A_TODO.indexOf(bajo) !== -1) return false;   // la lista blanca manda
    for (var i = 0; i < SOSPECHOSAS.length; i++) {
      if (bajo.indexOf(SOSPECHOSAS[i]) !== -1) return true;
    }
    return false;
  }

  function deleteAnalyticsCookies(chosen, quiet) {
    var C = merged();
    var all = normalizePatterns(C);
    // Categorias denegadas segun la eleccion actual (las locked nunca lo estan).
    var denied = {};
    C.categories.forEach(function (cat) {
      var granted = cat.locked ? true : !!(chosen && chosen[cat.id]);
      if (!granted) denied[cat.id] = true;
    });
    // Compatibilidad: un patron SIN categoria conserva la regla antigua, es decir
    // solo se borra cuando la analitica quedo denegada. Si se le pone categoria,
    // se borra exactamente cuando esa categoria queda denegada.
    var sig = signalsFrom(C, chosen || {});
    var analyticsDenied = sig.analytics_storage === "denied";
    var patterns = all.filter(function (p) {
      return p.category ? !!denied[p.category] : analyticsDenied;
    }).map(function (p) { return p.match; }).filter(function (m) {
      // Misma red que en la escritura: un patron como "sess" o "auth" puesto
      // en una categoria denegable borraria la sesion del visitante y lo
      // echaria del sitio. Pase lo que pase, eso no se toca.
      if (esSospechosa(m)) {
        log("borrado", "No se borra el patron \"" + m + "\": apunta a sesion o " +
                       "autenticacion y dejaria al visitante sin poder entrar.");
        return false;
      }
      return true;
    });
    if (!patterns.length) return [];
    var host = location.hostname;
    var root = host.split(".").slice(-2).join(".");
    var domains = ["", host, "." + host, root, "." + root];
    var deleted = [], fallidas = [];
    // La cookie donde vive la propia decision NUNCA se borra: si un patron la
    // alcanzara (por ejemplo "fwc" con namespace "fwc_consent"), el banner
    // borraria su propio consentimiento y volveria a preguntar en cada carga.
    var propia = cookieName(C);
    document.cookie.split(";").forEach(function (raw) {
      var nm = raw.split("=")[0].trim();
      if (nm === propia) return;
      var hit = patterns.some(function (p) { return nm.indexOf(p) === 0; });
      if (!hit || !nm) return;
      domains.forEach(function (dm) {
        var s = nm + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        if (dm) s += ";domain=" + dm;
        document.cookie = s;
      });
      // Se cuenta lo que de verdad desaparecio, no lo que se intento. Un
      // contador que suma intentos dice "20 borradas" cuando no borro ninguna,
      // y eso es lo que acaba leyendo el cliente en el panel.
      var sigue = document.cookie.split(";").some(function (raw2) {
        return raw2.split("=")[0].trim() === nm;
      });
      if (!sigue) deleted.push(nm);
      else fallidas.push(nm);
    });
    if (deleted.length && !quiet) log("delete", "Borrado activo: " + deleted.join(", "));
    if (fallidas.length && !quiet) log("delete", "No se pudieron borrar: " + fallidas.join(", "));
    return deleted;
  }

  // Bloqueo AUTOMATICO: intercepta <script src> que casen con autoBlock y los
  // convierte en text/plain + data-consent-src ANTES de que se ejecuten, de modo que
  // activateScripts los pueda reactivar igual que a los marcados a mano.
  var _observer = null, _blocked = [];

  // Reglas SEGURAS: solo se comparan contra el HOST de la URL, nunca contra la
  // ruta ni los parametros, y jamas se bloquea un script del propio dominio.
  // Asi una regla corta no puede tumbar por accidente jQuery, el tema o el CMS.
  function hostOf(src) {
    try { return new URL(src, location.href).hostname.toLowerCase(); }
    catch (e) { return ""; }
  }
  function ruleFor(rules, src) {
    if (!src) return null;
    var h = hostOf(src);
    if (!h || h === location.hostname.toLowerCase()) return null; // nunca lo propio
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r || !r.match) continue;
      var m = String(r.match).toLowerCase().replace(/^\*?\.?/, "");
      if (h === m || h.slice(-(m.length + 1)) === "." + m) return r; // host o subdominio
    }
    return null;
  }

  // OJO con el nombre del atributo: NO usar "data-src". Muchos temas (lazy-load,
  // preloaders) recorren [data-src] esperando IMAGENES pendientes; si encuentran
  // aqui un script neutralizado intentan cargarlo como Image() y, si su contador
  // de precarga no maneja onerror, la pagina se queda colgada. Por eso: data-consent-src.
  function neutralize(node, rule) {
    var src = node.getAttribute("src");
    if (node.tagName === "SCRIPT") {
      node.type = "text/plain";                     // impide la ejecucion
      node.setAttribute("type", "text/plain");
    }
    node.setAttribute("data-consent-src", src);
    node.setAttribute("data-consent-category", rule.category);
    // En un iframe o una img no hay "type" que valga: lo unico que corta la
    // peticion es quitarle el src, y en el iframe ademas vaciarlo para que no
    // se quede la pagina anterior pintada.
    node.removeAttribute("src");
    if (node.tagName === "IFRAME") {
      try { node.src = "about:blank"; } catch (e) {}
      ponerMarcador(node, rule);
    }
    _blocked.push(src);
  }

  function scanExisting(rules) {
    var sel = _duroActivo ? "script[src],iframe[src],img[src]" : "script[src]";
    var nodes = document.querySelectorAll(sel);
    Array.prototype.forEach.call(nodes, function (n) {
      var r = ruleFor(rules, n.getAttribute("src"));
      if (r) neutralize(n, r);
    });
  }

  // Reglas vigentes, cacheadas. El parche de insercion se consulta en CADA
  // appendChild de la pagina, asi que no puede permitirse llamar a merged(),
  // que clona los DEFAULTS enteros.
  var _reglasVivas = [];
  // Igual que _reglasVivas y por el mismo motivo: esto se consulta en cada
  // escritura de cookie y en cada src, fetch, XHR y sendBeacon. Llamar a
  // merged() ahi clonaria los DEFAULTS enteros en cada llamada.
  var _duroActivo = true;

  /* Interceptar en la INSERCION, no despues.
     Un <script> al que se le pone src y luego se inserta queda "preparado" por
     el navegador en ese mismo instante: la descarga arranca y el elemento se
     marca como ya iniciado. Quitarle el src despues no cancela nada, y el
     callback de un MutationObserver es un microtask que corre cuando el script
     que hizo la insercion ya termino. Por eso un observer solo basta para las
     etiquetas que escribe el parser, y no para las que inyecta codigo, que es
     justo como se cargan GTM, HubSpot y casi todo lo que importa.
     Aqui envolvemos los tres metodos de insercion para neutralizar el nodo
     ANTES de que toque el documento. */
  var _preRules = null;   // las reglas del pre-bloqueador inline, si lo hay
  var _parcheado = false;
  function parcheaInsercion() {
    if (_parcheado || typeof Node === "undefined" || !Node.prototype) return;
    _parcheado = true;
    var P = Node.prototype;
    var nAppend = P.appendChild, nInsert = P.insertBefore, nReplace = P.replaceChild;

    function revisa(n) {
      // Camino rapido: sin reglas no se toca nada, y esto corre en cada
      // insercion del DOM de la pagina.
      if (!n || !_reglasVivas.length) return n;
      if (n.nodeType === 1) {
        if (n.tagName === "SCRIPT") {
          var r = ruleFor(_reglasVivas, n.getAttribute && n.getAttribute("src"));
          if (r) neutralize(n, r);
        }
        return n;
      }
      // Un fragmento puede traer varios scripts dentro.
      if (n.nodeType === 11 && n.querySelectorAll) {
        Array.prototype.forEach.call(n.querySelectorAll("script[src]"), function (s) {
          var r = ruleFor(_reglasVivas, s.getAttribute("src"));
          if (r) neutralize(s, r);
        });
      }
      return n;
    }

    P.appendChild  = function (n) { return nAppend.call(this, revisa(n)); };
    P.insertBefore = function (n, ref) { return nInsert.call(this, revisa(n), ref); };
    P.replaceChild = function (n, viejo) { return nReplace.call(this, revisa(n), viejo); };
  }

  // Se instala lo antes posible, sin esperar a la config remota ni al DOM.

  // ---- Bloqueo endurecido (hardBlocking) -----------------------------------
  // El bloqueo de serie solo mira etiquetas <script>. Un tercero tiene otras
  // cuatro vias para llamar a casa: un <iframe>, un pixel <img>, fetch/XHR y
  // sendBeacon. Y puede escribir su cookie directamente con document.cookie,
  // que hoy solo se borra DESPUES de existir.
  //
  // Esto va apagado por defecto a proposito: parchear fetch y document.cookie
  // es invasivo y en un sitio con integraciones raras puede romper algo. Se
  // enciende sitio a sitio, despues de probarlo.
  var _duroPuesto = false;

  function dominioBloqueado(C, url) {
    // Se mira AQUI y no al instalar: blockNow corre antes de que llegue la
    // config remota, asi que si la decision se tomara una sola vez, apagar el
    // bloqueo desde el panel no serviria de nada hasta desplegar un bundle.
    if (!_duroActivo) return null;
    if (!url) return null;
    var reglas = _reglasVivas || [];
    if (!reglas.length) return null;
    var h;
    try { h = new URL(url, location.href).hostname.toLowerCase(); } catch (e) { return null; }
    if (!h || h === location.hostname.toLowerCase()) return null;
    for (var i = 0; i < reglas.length; i++) {
      var r = reglas[i];
      if (!r || !r.match) continue;
      var m = String(r.match).toLowerCase().replace(/^\*?\.?/, "");
      if (h === m || h.slice(-(m.length + 1)) === "." + m) return r;
    }
    return null;
  }

  // Una cookie se deja escribir salvo que su patron apunte a una categoria que
  // el visitante ha denegado. Asi no llega a existir, en vez de borrarse luego.
  // Borrar una cookie es escribirla con el valor vacio o con una fecha ya
  // pasada. Si el bloqueo trata eso como una escritura mas, el borrado activo
  // deja de funcionar justo donde hace falta: el visitante que ya traia la
  // cookie de antes de instalar el banner. Dejar pasar un borrado no concede
  // nada, porque quita la cookie en vez de ponerla.
  function esBorradoDeCookie(str) {
    var s = String(str || "");
    var valor = s.split(";")[0].split("=").slice(1).join("=").trim();
    if (valor === "") return true;
    var ma = s.match(/max-age\s*=\s*(-?\d+)/i);
    if (ma && Number(ma[1]) <= 0) return true;
    var ex = s.match(/expires\s*=\s*([^;]+)/i);
    if (ex) {
      var t = Date.parse(ex[1]);
      if (!isNaN(t) && t <= Date.now()) return true;
    }
    return false;
  }

  function cookieDenegada(C, str) {
    if (!_duroActivo) return false;                // apagable en caliente
    if (esBorradoDeCookie(str)) return false;      // un borrado nunca se bloquea
    var pats = C.cookiePatterns || [];
    var nombre = String(str || "").split("=")[0].trim().toLowerCase();
    if (!nombre) return false;
    if (esSospechosa(nombre)) {
      log("duro", "No se bloquea \"" + nombre + "\": el nombre apunta a sesion " +
                  "o autenticacion y dejaria al visitante sin poder entrar.");
      return false;
    }
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i], match = (typeof p === "string") ? p : p.match;
      if (!match || nombre.indexOf(String(match).toLowerCase()) !== 0) continue;
      var cat = (typeof p === "string") ? "analitica" : p.category;
      if (!isGranted(C, state.chosen, cat)) return true;
    }
    return false;
  }

  function instalarBloqueoDuro(C) {
    // Sin mirar hardBlocking: los parches se ponen siempre y la decision se
    // toma en cada llamada. Antes, un hardBlocking:false en el snippet dejaba
    // los parches sin instalar y el conmutador del panel ya no podia
    // levantarlos: apagar en caliente funcionaba y encender no.
    if (_duroPuesto) return;
    _duroPuesto = true;
    var W = window;

    // 1. document.cookie: se impide la escritura, no se borra despues.
    try {
      var dc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (dc && dc.set) {
        Object.defineProperty(document, "cookie", {
          configurable: true,
          get: function () { return dc.get.call(document); },
          set: function (v) {
            if (cookieDenegada(merged(), v)) {
              log("duro", "Cookie bloqueada al escribirse: " + String(v).split("=")[0]);
              return;
            }
            dc.set.call(document, v);
          }
        });
      }
    } catch (e) { log("duro", "No se pudo parchear document.cookie: " + e.message); }

    // 2. fetch
    if (W.fetch) {
      var _fetch = W.fetch;
      W.fetch = function (entrada, init) {
        var url = (entrada && entrada.url) || entrada;
        if (dominioBloqueado(merged(), url)) {
          log("duro", "fetch bloqueado: " + url);
          return Promise.reject(new Error("bloqueado por consentimiento"));
        }
        return _fetch.apply(this, arguments);
      };
    }

    // 3. XMLHttpRequest
    if (W.XMLHttpRequest && W.XMLHttpRequest.prototype.open) {
      var _open = W.XMLHttpRequest.prototype.open;
      W.XMLHttpRequest.prototype.open = function (metodo, url) {
        if (dominioBloqueado(merged(), url)) {
          log("duro", "XHR bloqueado: " + url);
          this.__cbBloqueado = true;
          return;
        }
        return _open.apply(this, arguments);
      };
      var _send = W.XMLHttpRequest.prototype.send;
      W.XMLHttpRequest.prototype.send = function () {
        if (this.__cbBloqueado) return;      // open no llego a abrir nada
        return _send.apply(this, arguments);
      };
    }

    // 4. sendBeacon, que es como se mandan las metricas al cerrar la pestana
    if (W.navigator && W.navigator.sendBeacon) {
      var _beacon = W.navigator.sendBeacon.bind(W.navigator);
      W.navigator.sendBeacon = function (url) {
        if (dominioBloqueado(merged(), url)) {
          log("duro", "sendBeacon bloqueado: " + url);
          return false;
        }
        return _beacon.apply(null, arguments);
      };
    }
    // 5. src de <img> y <iframe>. El observer no basta: un pixel creado con
    //    new Image() nunca entra en el DOM, asi que nadie lo ve pasar. Hay que
    //    interceptar la asignacion del src, que es cuando sale la peticion.
    [[W.HTMLImageElement, "IMG"], [W.HTMLIFrameElement, "IFRAME"]].forEach(function (par) {
      var Clase = par[0];
      if (!Clase || !Clase.prototype) return;
      try {
        var d = Object.getOwnPropertyDescriptor(Clase.prototype, "src");
        if (!d || !d.set) return;
        Object.defineProperty(Clase.prototype, "src", {
          configurable: true,
          get: function () { return d.get.call(this); },
          set: function (v) {
            if (v && dominioBloqueado(merged(), v)) {
              log("duro", par[1] + " bloqueado: " + v);
              this.setAttribute("data-consent-src", v);
              return;                       // la peticion no llega a salir
            }
            d.set.call(this, v);
          }
        });
      } catch (e) {}
    });

    log("duro", "Bloqueo endurecido activo: iframes, pixeles, fetch, XHR, beacon y cookies.");
  }


  // ---- Marcador del contenido bloqueado (P7) --------------------------------
  // Un iframe bloqueado deja un rectangulo en blanco y el visitante no sabe por
  // que. Esto lo sustituye por un aviso del mismo tamano que explica que falta
  // y permite conceder ESA categoria desde ahi, sin abrir el panel entero.
  // Es lo que hacen OneTrust y Cookiebot, y por lo mismo: sin el marcador, el
  // bloqueo correcto parece una pagina rota.

  function textoMarcador(C, cat, host) {
    var L = t();
    var etiqueta = cat;
    (C.categories || []).forEach(function (c) {
      if (c.id !== cat) return;
      var lab = c.label;
      etiqueta = (lab && typeof lab === "object") ? (lab[state.lang] || lab.es || lab.en || cat)
                                                  : (lab || cat);
    });
    return {
      aviso: (L.blockedBody || "Este contenido de {host} esta bloqueado hasta que aceptes las cookies de {cat}.")
               .replace("{host}", host).replace("{cat}", etiqueta),
      boton: (L.blockedBtn || "Aceptar {cat}").replace("{cat}", etiqueta)
    };
  }

  function ponerMarcador(node, rule) {
    try {
      var C = merged();
      if (!C.hardBlocking || node.tagName !== "IFRAME") return;
      if (node.previousElementSibling &&
          node.previousElementSibling.getAttribute("data-consent-ph")) return;   // ya tiene
      var src = node.getAttribute("data-consent-src") || "";
      var host = "";
      try { host = new URL(src, location.href).hostname.replace(/^www\./, ""); } catch (e) { host = "un tercero"; }
      var T = textoMarcador(C, rule.category, host);
      var K = C.colors || {};

      // Mismo hueco que el iframe, para que la pagina no salte al bloquear ni
      // al restaurar. Se lee del atributo y, si no lo trae, de su caja.
      var caja = node.getBoundingClientRect();
      var an = node.getAttribute("width") || (caja.width ? Math.round(caja.width) + "px" : "100%");
      var al = node.getAttribute("height") || (caja.height ? Math.round(caja.height) + "px" : "200px");
      if (/^\d+$/.test(an)) an += "px";
      if (/^\d+$/.test(al)) al += "px";

      // Todo lo visual sale de C.placeholder; lo que no se defina hereda del
      // tema, que es lo que ya encaja con el sitio. Asi se puede afinar sin
      // tener que escribir CSS, que ademas aqui no serviria: el marcador vive
      // en la pagina del cliente, no dentro del shadow DOM.
      var P = C.placeholder || {};
      var bot = P.button || {};

      var ph = document.createElement("div");
      ph.setAttribute("data-consent-ph", rule.category);
      if (P.className) ph.className = P.className;     // para darle estilo desde el sitio
      ph.style.cssText = "box-sizing:border-box;width:" + an + ";height:" + al + ";max-width:100%;" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "gap:" + (P.gap || "12px") + ";padding:" + (P.padding || "16px") + ";text-align:center;" +
        "background:" + (P.background || K.panelBg || "#F2F3F5") + ";" +
        "color:" + (P.color || K.body || "#44505F") + ";" +
        "border:" + (P.border || ("1px dashed " + (K.border || "#C9CFD6"))) + ";" +
        "border-radius:" + (P.radius || "0") + ";" +
        "font:" + (P.fontSize || "14px") + "/1.5 " + (fam(C, P.family || "body") || "system-ui, sans-serif") + ";";

      var p = document.createElement("p");
      p.style.cssText = "margin:0;max-width:" + (P.textMaxWidth || "40ch");
      p.textContent = T.aviso;

      var b = document.createElement("button");
      b.type = "button";
      b.textContent = T.boton;
      if (P.buttonClassName) b.className = P.buttonClassName;
      b.style.cssText = "cursor:pointer;font:inherit;" +
        "border:" + (bot.border || "0") + ";" +
        "padding:" + (bot.padding || "10px 18px") + ";" +
        "font-weight:" + (bot.weight || "600") + ";" +
        "background:" + (bot.background || K.accent || "#2E7D74") + ";" +
        "color:" + (bot.color || K.textBright || "#FFFFFF") + ";" +
        "border-radius:" + (bot.radius || (C.buttons && C.buttons.radius) || "6px") + ";";
      b.onclick = function () { concederCategoria(rule.category); };

      ph.appendChild(p); ph.appendChild(b);
      node.parentNode.insertBefore(ph, node);
      node.style.display = "none";          // el hueco lo ocupa el marcador
    } catch (e) {}
  }

  // Concede UNA categoria y deja el resto como estaba. Es lo que espera quien
  // pulsa "ver el video": no quiere aceptarlo todo.
  function concederCategoria(cat) {
    var C = merged();
    var chosen = {};
    (C.categories || []).forEach(function (c) {
      chosen[c.id] = c.locked ? true : !!(state.chosen || {})[c.id];
    });
    chosen[cat] = true;
    log("duro", "El visitante concede \"" + cat + "\" desde el marcador.");
    persist(C, "custom", chosen);
  }

  function quitarMarcador(node) {
    var ph = node.previousElementSibling;
    if (ph && ph.getAttribute("data-consent-ph")) ph.parentNode.removeChild(ph);
    node.style.display = "";
  }

  function installAutoBlock() {
    var C = merged();
    var rules = C.autoBlock || [];
    _reglasVivas = rules;
    _duroActivo = C.hardBlocking !== false;
    // Si el pre-bloqueador inline ya esta corriendo, lo adoptamos en vez de
    // montar un segundo observer: el inline se instala antes que este bundle,
    // que llega por red y para entonces el parser ya lanzo las etiquetas.
    var pre = typeof window !== "undefined" && window.__consentBlocker;
    if (pre && pre.observer) {
      _observer = pre.observer;
      _blocked = pre.blocked || [];
      // El inline trae su propio parche; si es una version anterior que no lo
      // tiene, lo ponemos nosotros. Y repasamos lo que ya este en el documento:
      // antes esta rama se iba sin mirar, asi que una etiqueta que se le
      // escapara al observer no la revisaba nadie.
      if (!pre.patched) parcheaInsercion();
      // Su array de reglas vive en el closure del snippet: lo guardamos para
      // poder vaciarlo cuando el visitante conceda una categoria.
      if (pre.rules) _preRules = pre.rules;
      if (rules.length) scanExisting(rules);
      log("autoblock", "Pre-bloqueador inline adoptado (" + _blocked.length + " scripts).");
      return;
    }
    if (!rules.length || _observer) return;
    parcheaInsercion();
    scanExisting(rules);
    _observer = new MutationObserver(function (muts) {
      var live = merged().autoBlock || rules;
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (!n.tagName) return;
          var dura = _duroActivo;   // el observer corre en cada nodo insertado
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

  // Al conceder una categoria ya no hace falta seguir interceptandola.
  function refreshAutoBlock(C, chosen) {
    _duroActivo = C.hardBlocking !== false;
    var rules = (C.autoBlock || []).filter(function (r) {
      return !isGranted(C, chosen, r.category);
    });
    // El parche de insercion lee de aqui, asi que esto es lo que de verdad
    // deja de bloquear una categoria concedida. Va antes del return: el parche
    // sigue puesto aunque no haya observer que desconectar.
    _reglasVivas = rules;
    // Y las del inline, en sitio: su hit() cierra sobre ese mismo array.
    if (_preRules) { _preRules.length = 0; rules.forEach(function (r) { _preRules.push(r); }); }
    if (!_observer) return;
    if (!rules.length) { _observer.disconnect(); _observer = null; }
    if (_blocked.length) log("autoblock", "Bloqueados: " + _blocked.join(", "));
  }

  // Bloqueo manual de scripts (sitios sin GTM). El sitio marca los scripts como
  //   <script type="text/plain" data-consent-category="statistics" data-consent-src="..."></script>
  // y aqui, al conceder esa categoria, se convierten en scripts ejecutables.
  function isGranted(C, chosen, catId) {
    var cat = C.categories.filter(function (c) { return c.id === catId; })[0];
    if (cat && cat.locked) return true;
    return !!chosen[catId];
  }
  function activateScripts(C, chosen) {
    if (!C.manageScripts && !(C.autoBlock && C.autoBlock.length)) return;
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent-category]');
    var activated = [];
    Array.prototype.forEach.call(nodes, function (old) {
      var cat = old.getAttribute("data-consent-category");
      if (!isGranted(C, chosen, cat)) return; // sigue bloqueado
      var s = document.createElement("script");
      for (var i = 0; i < old.attributes.length; i++) {
        var a = old.attributes[i];
        if (a.name === "type" || a.name === "data-consent-category" || a.name === "data-consent-src" || a.name === "data-src") continue;
        s.setAttribute(a.name, a.value);
      }
      // data-src se sigue leyendo por compatibilidad con snippets inline antiguos.
      var src = old.getAttribute("data-consent-src") || old.getAttribute("data-src");
      if (src) s.src = src; else s.text = old.textContent;
      old.parentNode.replaceChild(s, old);
      activated.push(cat);
    });
    if (activated.length) log("scripts", "Scripts activados: " + activated.join(", "));

    restaurarMedios(C, chosen);
    // El bloqueo del iframe puede ocurrir DESPUES de esta pasada, segun como el
    // navegador ordene el parser y el observer. Un par de reintentos cortos
    // evitan la carrera sin tener que adivinar el orden.
    setTimeout(function () { restaurarMedios(merged(), chosen); }, 0);
    setTimeout(function () { restaurarMedios(merged(), chosen); }, 400);
  }

  // Iframes e imagenes que bloqueo el modo duro. No se reemplaza el nodo como
  // con los scripts: basta devolverles su src. Sin esto, un video embebido se
  // quedaba en blanco PARA SIEMPRE aunque el visitante aceptara despues.
  function restaurarMedios(C, chosen) {
    var medios = document.querySelectorAll("iframe[data-consent-src],img[data-consent-src]");
    var vueltos = [];
    Array.prototype.forEach.call(medios, function (n) {
      var cat = n.getAttribute("data-consent-category");
      // Los bloqueados al asignarles el src no llevan categoria: se mira su
      // dominio contra las reglas que siguen vivas.
      if (!cat) {
        var r = dominioBloqueado(C, n.getAttribute("data-consent-src"));
        if (r) return;                       // su dominio sigue bloqueado
      } else if (!isGranted(C, chosen, cat)) {
        return;
      }
      var src = n.getAttribute("data-consent-src");
      n.removeAttribute("data-consent-src");
      n.removeAttribute("data-consent-category");
      quitarMarcador(n);
      try { n.src = src; } catch (e) {}
      vueltos.push(src);
    });
    if (vueltos.length) log("duro", "Medios restaurados: " + vueltos.length);
  }

  function postAudit(C, consent) {
    if (!C.endpoint) return;
    var payload = {
      site_id: C.siteId || null,
      choice: consent.choice,
      categories: consent.categories,
      language: state.lang,
      consent_id: consent.consent_id || null,
      session_id: C.sessionId || null,
      version: C.consentVersion,
      gpc: !!state.gpc           // prueba de que se respeto la senal
    };
    var headers = { "Content-Type": "application/json" };
    if (C.publicKey) headers["X-Api-Key"] = C.publicKey;
    try {
      fetch(C.endpoint, {
        method: "POST", keepalive: true,
        headers: headers,
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.consent_id) {
            consent.consent_id = d.consent_id;
            writeConsent(C, consent);
            log("audit", "Auditoria OK. consent_id=" + d.consent_id);
          }
        }).catch(function () { log("audit", "Auditoria fallo (la eleccion local ya quedo guardada)."); });
    } catch (e) { /* no bloquea la UI */ }
    log("audit", "POST " + C.endpoint + " (no bloquea la UI)");
  }

  // ---- Deteccion de cookies -------------------------------------------------
  // Inventario, no consentimiento: mira que cookies existen de verdad en el
  // sitio para que el dueno pueda clasificarlas desde el dashboard en vez de
  // adivinar. Solo viaja el NOMBRE de cada cookie, nunca su valor, que es
  // donde estarian los identificadores y los datos personales.
  var _sent = {};      // nombres ya reportados en esta carga, para no repetir

  function cookieNames() {
    var out = [], vistos = {};
    String(document.cookie || "").split(";").forEach(function (raw) {
      var nm = raw.split("=")[0].trim();
      if (!nm || vistos[nm]) return;
      vistos[nm] = 1;
      out.push(nm);
    });
    return out;
  }

  /* ---- Inventario ampliado ---------------------------------------------
     document.cookie solo ve las cookies propias que no son HttpOnly, asi que
     por si solo deja fuera medio informe. Para un cookie audit hace falta
     tambien el almacenamiento local y los terceros a los que la pagina pide
     recursos. Nada de esto se bloquea: solo se anota que existe. */

  function _clavesAlmacen(tipo) {
    var out = [];
    try {
      var st = tipo === "local" ? window.localStorage : window.sessionStorage;
      if (!st) return out;
      for (var i = 0; i < st.length; i++) {
        var k = st.key(i);
        if (k) out.push(k);
      }
    } catch (e) { /* bloqueado por el navegador o por el modo privado */ }
    return out;
  }

  /* Hosts de terceros a los que la pagina ha pedido algo. Salen del Resource
     Timing, que el navegador ya lleva: no se intercepta nada. */
  var _hostsVistos = {};
  function _tercerosObservados() {
    var out = [];
    try {
      var propio = location.hostname.toLowerCase();
      var raiz = propio.split(".").slice(-2).join(".");
      (performance.getEntriesByType("resource") || []).forEach(function (e) {
        var h;
        try { h = new URL(e.name).hostname.toLowerCase(); } catch (err) { return; }
        if (!h || h === propio || h === raiz || h.slice(-(raiz.length + 1)) === "." + raiz) return;
        if (_hostsVistos[h]) return;
        _hostsVistos[h] = 1;
        out.push(h);
      });
    } catch (e) { /* navegador sin Resource Timing */ }
    return out;
  }


  /* Claves que escriben las EXTENSIONES del navegador de quien navega, no el
     sitio. Dark Reader, carteras de cripto y demas usan el localStorage del
     origen visitado, asi que aparecen como si fueran del cliente y ensucian el
     informe. La lista es explicita a proposito: un patron generico tipo "todo
     lo que empiece por doble guion bajo" se llevaria por delante cookies
     legitimas como __hstc o __cf_bm. */
  var EXTENSIONES = [
    "__darkreader__", "walletlink", "EIP6963", "__coupert", "__EXT_APP_",
    "MicrosoftApplicationsTelemetry", "RC_MFE_", "__cb_resourcesearch",
    "_bettercampus", "__metamask", "__phantom", "grammarly", "__honey",
    "__REACT_DEVTOOLS", "__VUE_DEVTOOLS", "loom-", "__pocket", "adblock"
  ];
  function esDeExtension(nombre) {
    var n = String(nombre || "").toLowerCase();
    for (var i = 0; i < EXTENSIONES.length; i++) {
      if (n.indexOf(EXTENSIONES[i].toLowerCase()) === 0) return true;
    }
    return false;
  }

  /* Todo lo observable, con su tipo y si es propio o de un tercero. */
  function inventario() {
    var items = [];
    function anotar(n, kind, party) {
      if (esDeExtension(n)) return;      // no es del sitio: no se reporta
      items.push({ name: n, kind: kind, party: party });
    }
    cookieNames().forEach(function (n) { anotar(n, "cookie", "first"); });
    _clavesAlmacen("local").forEach(function (n) { anotar(n, "localStorage", "first"); });
    _clavesAlmacen("session").forEach(function (n) { anotar(n, "sessionStorage", "first"); });
    _tercerosObservados().forEach(function (h) { anotar(h, "host", "third"); });
    return items;
  }

  function reportCookies(C, phase) {
    if (!C.cookieDiscovery || !C.apiBase || !C.siteId) return;
    // La clave incluye el tipo: una cookie "_ga" y una clave de localStorage
    // con el mismo nombre son dos hallazgos distintos.
    var nuevas = inventario().filter(function (it) { return !_sent[it.kind + ":" + it.name]; });
    if (!nuevas.length) return;
    nuevas.forEach(function (it) { _sent[it.kind + ":" + it.name] = 1; });
    var headers = { "Content-Type": "application/json" };
    if (C.publicKey) headers["X-Api-Key"] = C.publicKey;
    var url = String(C.apiBase).replace(/\/$/, "") + "/api/cookies";
    try {
      fetch(url, {
        method: "POST", keepalive: true, headers: headers,
        body: JSON.stringify({
          site_id: C.siteId,
          phase: phase || "",
          cookies: nuevas.map(function (it) {
            return { name: it.name, domain: location.hostname,
                     kind: it.kind, party: it.party, page: location.pathname };
          })
        })
      }).then(function () {
        log("discovery", "Inventario enviado (" + phase + "): " +
            nuevas.map(function (it) { return it.kind + " " + it.name; }).join(", "));
      }).catch(function () { /* el inventario nunca debe romper el sitio */ });
    } catch (e) { /* idem */ }
  }

  // Varias pasadas: al arrancar solo estan las cookies del servidor; las de
  // terceros aparecen segundos despues, y otras solo tras aceptar.
  function startDiscovery(C) {
    if (!C.cookieDiscovery) return;
    reportCookies(C, "inicial");
    var segundos = C.discoverySeconds == null ? 15 : C.discoverySeconds;
    if (segundos <= 0) return;
    var pasos = 0;
    var timer = setInterval(function () {
      pasos++;
      reportCookies(C, "tardia");
      if (pasos >= segundos) clearInterval(timer);
    }, 1000);
  }

  // ---- Estado y persist -----------------------------------------------------
  var state = { lang: "es", chosen: {} };

  // El corazon del sistema. Orden fijo (ver spec seccion 3).
  function persist(C, choice, chosen) {
    var signals = signalsFrom(C, chosen);
    var consent = {
      consent_id: (readConsent(C) || {}).consent_id || null,
      choice: choice,
      categories: chosen,
      signals: signals,
      ts: Date.now(),
      version: C.consentVersion,
      // Si la senal estaba puesta cuando se decidio, la decision ya la tiene en
      // cuenta y no hay que volver a revocarla en cada carga.
      gpc: gpcActivo()
    };
    // Que cambia respecto a lo que habia, para decidir si toca recargar.
    var antes = state.chosen || {};
    var concede = false, retira = false;
    C.categories.forEach(function (c) {
      // Las bloqueadas no se deciden: van siempre concedidas. Si contaran,
      // rechazar pareceria "conceder" porque las esenciales pasan de nada a si.
      if (c.locked) return;
      if (chosen[c.id] && !antes[c.id]) concede = true;
      if (!chosen[c.id] && antes[c.id]) retira = true;
    });

    // 1. Guardar en cookie.
    writeConsent(C, consent);
    log("save", "Guardado en cookie " + cookieName(C) + " (choice=" + choice + ")");
    // 2. Ocultar UI y actualizar estado.
    hideBanner(); hidePanel(); showChip(C); state.chosen = chosen;
    checkSafety(C);   // tambien tras decidir en esta misma carga, no solo al volver
    // 3. Consent Mode v2: update.
    gtag("consent", "update", signals);
    gcmAjustes(C);
    log("update", JSON.stringify(signals));
    // 3b. Activar scripts bloqueados de las categorias concedidas (sitios sin GTM).
    // Primero se retiran las reglas de las categorias concedidas y despues se
    // reactiva: al reves, el parche de insercion volveria a neutralizar el
    // script recien revivido, porque replaceChild tambien pasa por el.
    refreshAutoBlock(C, chosen);
    activateScripts(C, chosen);
    // 4. Borrado activo si analitica quedo en denied.
    // Se ejecuta siempre que haya alguna categoria denegada; dentro se filtra
    // que patrones tocar. Antes solo corria si la analitica estaba denegada.
    if (C.activeDeletion) { deleteAnalyticsCookies(chosen); startDeletionWatch(C, chosen); }
    else stopDeletionWatch();
    // 5. Auditoria (no bloquea).
    postAudit(C, consent);
    // Aceptar libera scripts que escriben cookies que antes no existian:
    // se vuelve a mirar para que el inventario las recoja.
    if (C.cookieDiscovery) setTimeout(function () { reportCookies(C, "tras-decision"); }, 3000);
    if (typeof C.onConsentChange === "function") C.onConsentChange(consent);

    // 6. Recarga opcional. Va la ultima y con un respiro, para no cortar el
    //    envio de auditoria que acaba de salir.
    var modo = C.reloadAfter || "never";
    var toca = (modo === "always") ||
               (modo === "accept" && concede) ||
               (modo === "reduce" && retira);
    if (toca) {
      log("reload", "Recargando la pagina tras la decision (reloadAfter=" + modo + ").");
      setTimeout(function () { location.reload(); }, 400);
    }
  }

  // ---- UI (Shadow DOM llega en Fase 1; aqui va sobre el documento) ----------
  var root, bannerEl, panelEl, chipEl;

  // Estilos "Expediente": mismos tokens que styles/tokens.css del frontend
  // (ink navy, paper calido, verdigris teal, trio IBM Plex).
  // Resuelve "heading" | "body" | "mono" a la pila real; cualquier otra cosa
  // se pasa tal cual, por si el sitio quiere una familia propia.
  function fam(C, v) {
    if (!v) return C.fonts.body;
    return C.fonts[v] || v;
  }
  // Devuelve las declaraciones de un bloque de tipografia.
  function typo(C, key) {
    var t = (C.typography && C.typography[key]) || {};
    var out = "font-family:" + fam(C, t.family) + ";";
    if (t.size)          out += "font-size:" + t.size + ";";
    if (t.weight)        out += "font-weight:" + t.weight + ";";
    if (t.lineHeight)    out += "line-height:" + t.lineHeight + ";";
    if (t.letterSpacing) out += "letter-spacing:" + t.letterSpacing + ";";
    if (t.transform)     out += "text-transform:" + t.transform + ";";
    return out;
  }
  // Declaraciones de un boton concreto, con herencia del tema.
  function btn(C, key, fallbackBg, fallbackFg) {
    var B = C.buttons || {}, b = B[key] || {};
    var out = "";
    out += "background:" + (b.background || fallbackBg) + ";";
    out += "color:" + (b.color || fallbackFg) + ";";
    if (b.border !== undefined && b.border !== "") out += "border:" + b.border + ";";
    if (b.weight)  out += "font-weight:" + b.weight + ";";
    if (b.size)    out += "font-size:" + b.size + ";";
    if (b.radius)  out += "border-radius:" + b.radius + ";";
    // Subrayado permanente: hay disenos donde "Personalizar" o "Aceptar" son
    // enlaces de texto, no botones, y el subrayado solo al pasar el raton no
    // los hace reconocibles como pulsables.
    if (b.underline) out += "text-decoration:underline;text-underline-offset:3px;";
    // Orden: lo puesto a mano en ESTE boton, luego el padding general y, por
    // ultimo, el de serie del boton. Antes el de serie vivia en los ajustes por
    // defecto, asi que ganaba al general y rellenar "padding" no movia ni
    // aceptar ni guardar. Sacandolo aqui, el general manda pero un valor
    // propio del boton lo sigue pisando.
    var deSerie = { accept: "12px 22px", save: "12px 22px", customize: "11px 14px" };
    out += "padding:" + (b.padding || B.padding || deSerie[key] || "11px 18px") + ";";
    return out;
  }
  // Interruptor del panel. Todo opcional: sin config, el de siempre.
  function swCss(C, K, pnBg) {
    var S = C.switchStyle || {};
    var w = S.width || "46px", h = S.height || "26px";
    var r = (S.radius !== undefined && S.radius !== "") ? S.radius : "100px";
    var kr = (S.knobRadius !== undefined && S.knobRadius !== "") ? S.knobRadius : "50%";
    var hueco = S.inset || "3px";
    // El recorrido del mando se calcula para que quede simetrico sea cual sea
    // el tamano: sin esto, cambiar el ancho descoloca el mando al encenderlo.
    var kw = "calc(" + h + " - " + hueco + " * 2 - 2px)";
    var izq = "calc(" + w + " - " + kw + " - " + hueco + " - 2px)";
    // Casilla: cuadrada, sin mando deslizante. El tic se pinta con el borde
    // de un pseudoelemento girado, asi no hace falta SVG dentro del boton.
    if (S.shape === "checkbox") {
      var lado = S.size || S.width || "20px";
      var rc = (S.radius !== undefined && S.radius !== "") ? S.radius : "3px";
      return ".cb-sw{position:relative;width:" + lado + ";height:" + lado +
        ";border-radius:" + rc + ";background:" + (S.off || K.switchOff) +
        ";border:" + (S.border || ("1px solid " + K.borderStrong)) +
        ";cursor:pointer;flex:none;padding:0;transition:background .16s,border-color .16s}" +
        ".cb-sw[aria-checked='true']{background:" + (S.on || K.accent) +
          ";border-color:" + (S.onBorder || S.on || K.accent) + "}" +
        ".cb-sw[disabled]{background:" + (S.locked || K.accentSoft) +
          ";border-color:" + (S.lockedBorder || K.accentPale) + ";opacity:.9;cursor:default}" +
        ".cb-sw:focus-visible{outline:2px solid " + K.accent + ";outline-offset:2px}" +
        ".cb-knob{position:absolute;left:0;right:0;top:0;bottom:0;margin:auto;width:28%;height:55%;" +
          "border:solid " + (S.knobOn || K.textBright) + ";border-width:0 2px 2px 0;" +
          "transform:translateY(-8%) rotate(45deg);opacity:0;transition:opacity .12s}" +
        ".cb-sw[aria-checked='true'] .cb-knob,.cb-sw[disabled] .cb-knob{opacity:1}";
    }
    return ".cb-sw{position:relative;width:" + w + ";height:" + h + ";border-radius:" + r +
      ";background:" + (S.off || K.switchOff) + ";border:" + (S.border || ("1px solid " + K.borderStrong)) +
      ";cursor:pointer;flex:none;padding:0;transition:background .16s cubic-bezier(.2,.6,.2,1),border-color .16s}" +
      ".cb-sw[aria-checked='true']{background:" + (S.on || K.accent) +
        ";border-color:" + (S.onBorder || S.on || K.accent) + "}" +
      ".cb-sw[disabled]{background:" + (S.locked || K.accentSoft) +
        ";border-color:" + (S.lockedBorder || K.accentPale) + ";opacity:.9;cursor:default}" +
      ".cb-sw:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}" +
      ".cb-knob{position:absolute;top:" + hueco + ";left:" + hueco + ";width:" + kw + ";height:" + kw +
        ";border-radius:" + kr + ";background:" + (S.knob || pnBg) +
        ";box-shadow:0 1px 3px rgba(22,35,59,.25);transition:left .18s cubic-bezier(.2,.6,.2,1)}" +
      ".cb-sw[aria-checked='true'] .cb-knob{left:" + izq + ";background:" + (S.knobOn || K.textBright) + "}" +
      ".cb-sw[disabled] .cb-knob{left:" + izq + ";background:" + (S.knobOn || K.accent) + ";box-shadow:none}";
  }

  function chipAnchor(C) {
    var P = C.chip || {}, pos = P.position || "bottom-left";
    var x = P.offsetX || "16px", y = P.offsetY || "16px", out = "";
    out += (pos.indexOf("top") === 0 ? "top:" : "bottom:") + y + ";";
    out += (pos.indexOf("right") > -1 ? "right:" : "left:") + x + ";";
    return out;
  }

  // Estilos "Expediente": mismos tokens que styles/tokens.css del frontend
  // (ink navy, paper calido, verdigris teal, trio IBM Plex). Todas las medidas
  // salen de la config, con los valores de DEFAULTS como red de seguridad.
  // El CSS lo escribe el cliente en el dashboard. Va al final, para que gane
  // sobre lo generado sin necesidad de !important.
  //
  // Se quitan dos cosas. @import trae una hoja de otro dominio, que es una
  // conexion a un tercero antes de que el visitante decida, justo lo que este
  // banner existe para evitar. Y javascript: dentro de un url() llega a
  // ejecutarse en navegadores viejos.
  function cssAMedida(C) {
    var t = C.customCss;
    if (!t || typeof t !== "string") return "";
    var limpio = t
      .replace(/@import[^;]*;?/gi, "")
      .replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, "none");
    // </style> dentro del texto cerraria la etiqueta antes de tiempo. No puede
    // pasar al usar textContent, pero lo quitamos por si algun dia se inyecta
    // de otra forma.
    limpio = limpio.replace(/<\/style/gi, "");
    if (limpio !== t) log("css", "Se ignoraron partes del CSS a medida (@import o javascript:).");
    return "\n/* CSS a medida */\n" + limpio;
  }

  /* banner.layout: "bar" (por defecto, la barra de siempre) | "card" | "centered".
     "card" es una tarjeta estrecha anclada a una esquina; "centered", una
     tarjeta en mitad de la pantalla. En las dos el contenido pasa a columna,
     porque a 420px el texto y tres botones en fila no caben. */
  function bannerLayoutCss(C, BN) {
    var modo = BN.layout || "bar";
    if (modo !== "card" && modo !== "centered") return "";
    var r = BN.radius || "12px";
    var columna =
      ".cb-inner{flex-direction:column;align-items:stretch;gap:" + (BN.gap || "20px") + "}" +
      ".cb-copy{flex:0 0 auto}" +
      ".cb-actions{justify-content:flex-start}";
    var hueco = BN.inset || "clamp(16px,3vw,32px)";

    if (modo === "centered") {
      // banner.position decide la altura: arriba, en medio o abajo. Antes
      // "centered" se quedaba siempre en el medio y la posicion se ignoraba.
      var alto = BN.position === "top" ? "flex-start"
               : (BN.position === "bottom" ? "flex-end" : "center");
      return ".cb-banner{top:0;right:0;bottom:0;left:0;align-items:" + alto +
             ";justify-content:center;margin:0;padding:" + hueco + "}" +
             ".cb-inner{max-width:" + (BN.centeredWidth || "520px") + ";border-radius:" + r + "}" +
             columna;
    }

    // card: la altura sale de banner.position y el lado de banner.align.
    // align "center" la centra en horizontal, que antes no se podia.
    var vert = BN.position === "top" ? "top:" : "bottom:";
    var centrada = BN.align === "center";
    var hor = centrada
      ? "left:50%;transform:translateX(-50%);"
      : ((BN.align === "right" ? "right:" : "left:") + hueco + ";");
    return ".cb-banner{top:auto;bottom:auto;left:auto;right:auto;" +
           vert + hueco + ";" + hor + "margin:0;padding:0;display:block;" +
           "width:min(" + (BN.cardWidth || "420px") + ",calc(100vw - 2 * " + hueco + "))}" +
           ".cb-inner{max-width:none;border-radius:" + r + "}" +
           columna;
  }

  /* panel.placement: "center" (por defecto) | "side" | "bottom".
     Las hojas van pegadas a su borde, sin margen del velo y sin radio en las
     esquinas que tocan la pantalla. */
  function panelPlacementCss(C, PN) {
    var modo = PN.placement || "center";
    if (modo !== "side" && modo !== "bottom") return "";
    var r = PN.radius || "12px";
    var anim = PN.animate === false ? "" :
      ";animation:" + (modo === "side" ? "cb-slide-x" : "cb-slide-y") + " .24s cubic-bezier(.2,.6,.2,1)";
    if (modo === "side") {
      var lado = PN.side === "left" ? "flex-start" : "flex-end";
      return ".cb-overlay{align-items:stretch;justify-content:" + lado + ";padding:0}" +
             ".cb-panel{height:100%;max-height:100%;width:100%;max-width:" + (PN.sideWidth || "480px") + ";" +
             "border-radius:0;animation:none" + anim + "}" +
             ".cb-foot{border-radius:0}";
    }
    return ".cb-overlay{align-items:flex-end;justify-content:center;padding:0}" +
           ".cb-panel{width:100%;max-width:" + (PN.sheetWidth || "100%") + ";" +
           "max-height:" + (PN.sheetHeight || "88vh") + ";border-radius:" + r + " " + r + " 0 0;" +
           "animation:none" + anim + "}" +
           ".cb-foot{border-radius:0}";
  }

  function css(C) {
    var K = C.colors, F = C.fonts;
    var BN = C.banner || {}, PN = C.panel || {}, BT = C.buttons || {}, CH = C.chip || {};
    var bnBg = BN.background || K.ink, bnFg = BN.color || K.text;
    var pnBg = PN.background || K.panelBg;
    var justify = BN.align === "left" ? "flex-start" : (BN.align === "right" ? "flex-end" : "center");
    var vert = BN.position === "top" ? "top:0;bottom:auto;" : "bottom:0;top:auto;";
    return "" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:" + F.body + "}" +
    // ---- Banner: tarjeta flotante sobre ink, no barra a sangre ----
    (BN.backdropOn && (BN.backdropCustom || BN.backdrop) ?
      ".cb-bdrop{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147482999;background:" +
      (BN.backdropCustom || BN.backdrop) + (BN.animate === false ? "" : ";animation:cb-fade .2s ease") + "}" : "") +
    ".cb-banner{position:fixed;left:0;right:0;" + vert + "z-index:2147483000;display:flex;justify-content:" + justify + ";padding:0;margin:" + (BN.margin || "0 20px 20px") + "}" +
    ".cb-inner{width:100%;max-width:" + (BN.maxWidth || "1172px") + ";background:" + bnBg + ";color:" + bnFg + ";border:" + (BN.border || "1px solid rgba(255,255,255,.14)") + ";border-radius:" + (BN.radius || "12px") + ";box-shadow:" + (BN.shadow || "0 10px 40px rgba(15,24,38,.28)") + ";padding:" + (BN.padding || "22px 26px") + ";display:flex;flex-wrap:wrap;gap:" + (BN.gap || "28px") + ";align-items:center;justify-content:space-between" + (BN.animate === false ? "" : ";animation:cb-rise .26s cubic-bezier(.2,.6,.2,1)") + "}" +
    ".cb-copy{flex:1 1 380px;display:flex;flex-direction:column;gap:" + (BN.copyGap || "8px") + ";min-width:0}" +
    ".cb-eyebrow{margin:0;" + typo(C, "eyebrow") + "color:" + K.accentPale + "}" +
    ".cb-gpc{margin:0;" + typo(C, "bannerText") + "color:" + K.accentPale +
      ";font-weight:600}" +
    ".cb-body{margin:0;" + typo(C, "bannerText") + "color:" + bnFg + ";max-width:68ch}" +
    ".cb-body a{color:" + K.accentPale + ";text-decoration:underline;text-underline-offset:2px;white-space:nowrap}" +
    ".cb-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end}" +
    ".cb-btn{border:0;border-radius:" + (BT.radius || "8px") + ";" + typo(C, "button") + "cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,opacity .14s}" +
    ".cb-btn:focus-visible{outline:2px solid " + K.accentPale + ";outline-offset:2px}" +
    // rechazar
    ".cb-ghost{" + btn(C, "reject", "transparent", bnFg) + "}" +
    ".cb-ghost:hover{border-color:rgba(255,255,255,.6)}" +
    // "Personalizar" es boton de texto
    ".cb-actions .cb-ghost:first-child{" + btn(C, "customize", "transparent", bnFg) + "}" +
    ".cb-actions .cb-ghost:first-child:hover{text-decoration:underline;text-underline-offset:3px}" +
    ".cb-accept{" + btn(C, "accept", K.accent, K.textBright) + "border-radius:" + (BT.radius || "8px") + "}" +
    // Simetria: misma caja para aceptar y rechazar. Va despues de las reglas
    // base a proposito, para ganarles sin depender del orden de las claves.
    (BT.equalWeight ? (
      ".cb-actions .cb-btn:not(:first-child){padding:" + (BT.padding || "12px 22px") +
        ";border-width:1px;border-style:solid;font-weight:" + (BT.accept && BT.accept.weight || 600) + "}" +
      ".cb-ghost:not(:first-child){border-color:" + bnFg + ";color:" + bnFg + "}" +
      ".cb-accept{border-color:" + (BT.accept && BT.accept.background || K.accent) + "}"
    ) : "") +
    ".cb-accept:hover{background:" + K.accentHover + "}" +
    // ---- Panel ----
    ".cb-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483001;background:" + (PN.overlay || "rgba(22,35,59,.28)") + ";display:flex;align-items:center;justify-content:center;padding:24px" + (PN.animate === false ? "" : ";animation:cb-fade .2s ease") + "}" +
    ".cb-panel{background:" + pnBg + ";color:" + K.heading + ";width:100%;max-width:" + (PN.maxWidth || "560px") + ";max-height:" + (PN.maxHeight || "92vh") + ";overflow:auto;border:1px solid " + K.border + ";border-radius:" + (PN.radius || "12px") + ";box-shadow:" + (PN.shadow || "0 20px 60px rgba(22,35,59,.28)") + (PN.animate === false ? "" : ";animation:cb-rise .24s cubic-bezier(.2,.6,.2,1)") + "}" +
    ".cb-head{padding:" + (PN.headPadding || "28px 28px 20px") + ";display:flex;flex-direction:column;gap:10px;border-bottom:1px solid " + K.border + "}" +
    ".cb-eyebrow2{margin:0;" + typo(C, "eyebrow") + "color:" + K.accentHover + "}" +
    ".cb-panel h2{margin:0;" + typo(C, "panelTitle") + "color:" + K.heading + "}" +
    ".cb-intro{margin:0;" + typo(C, "panelIntro") + "color:" + K.body + "}" +
    ".cb-rows{display:flex;flex-direction:column}" +
    ".cb-row{display:flex;gap:" + (PN.rowGap || "20px") + ";align-items:flex-start;padding:" + (PN.rowPadding || "20px 28px") + ";border-bottom:1px solid " + K.border + "}" +
    (PN.controlSide === "left" ? ".cb-row{flex-direction:row-reverse;justify-content:flex-end}" : "") +
    ".cb-close{position:absolute;top:" + (PN.closeTop || "24px") + ";right:" + (PN.closeRight || "24px") + ";background:none;border:0;padding:8px;cursor:pointer;color:" + K.heading + ";display:flex;line-height:0}" +
    ".cb-panel{position:relative}" +
    ".cb-row .t{flex:1 1 auto;display:flex;flex-direction:column;gap:5px;min-width:0}" +
    ".cb-row .t strong{" + typo(C, "catName") + "color:" + K.heading + "}" +
    ".cb-row .t span{" + typo(C, "catDesc") + "color:" + K.body + "}" +
    ".cb-row .t .cb-pill{display:inline-block;margin-left:10px;font-family:" + F.mono + ";font-size:9px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:" + K.pillFg + ";background:" + K.pillBg + ";padding:4px 9px;border-radius:100px;vertical-align:middle}" +
    swCss(C, K, pnBg) +
    ".cb-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:" + K.cream + ";padding:" + (PN.footPadding || "20px 28px 24px") + ";border-radius:0 0 " + (PN.radius || "12px") + " " + (PN.radius || "12px") + "}" +
    ".cb-btn2{border-radius:" + (BT.radius || "8px") + ";" + typo(C, "button") + "cursor:pointer;transition:background .14s,border-color .14s}" +
    ".cb-btn2:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}" +
    ".cb-outline{background:transparent;border:1px solid " + K.borderStrong + ";color:" + K.heading + "}" +
    ".cb-foot-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
    // Pie apilado: "rechazar" a todo el ancho arriba y los otros dos debajo.
    // Va despues de la regla base a proposito: si fuera antes, no ganaria.
    (PN.footLayout === "stacked"
      ? ".cb-foot{flex-direction:column;align-items:stretch}" +
        ".cb-foot .cb-outline{width:100%;order:-1}" +
        ".cb-foot-right{width:100%;justify-content:space-between}"
      : "") +
    ".cb-outline:hover{border-color:" + K.heading + "}" +
    ".cb-text{background:transparent;border:0;color:" + K.heading + ";padding:" + ((BT.text && BT.text.padding) || BT.padding || "11px 14px") + "}" +
    ".cb-text:hover{text-decoration:underline;text-underline-offset:3px}" +
    ".cb-save{" + btn(C, "save", K.accent, K.textBright) + "border-radius:" + (BT.radius || "8px") + "}" +
    ".cb-save:hover{background:" + K.accentHover + "}" +
    // ---- Pill para reabrir. Sin punto: lo que se ve sale de chip.mode ----
    ".cb-chip{position:fixed;" + chipAnchor(C) + "z-index:2147482999;display:none;align-items:center;gap:" + (CH.gap || "7px") + ";background:" + (CH.background || pnBg) + ";color:" + (CH.color || K.body) + ";border:" + (CH.border || ("1px solid " + K.border)) + ";border-radius:" + (CH.radius || "999px") + ";padding:" + (CH.padding || "8px 13px") + ";" + typo(C, "chip") + "cursor:pointer;box-shadow:" + (CH.shadow || "0 2px 6px rgba(22,35,59,.07)") + "}" +
    ".cb-chip[data-on='1']{display:flex}" +
    ".cb-chip img,.cb-chip svg{display:block;flex:0 0 auto;width:" + (CH.imageSize || "18px") + ";height:" + (CH.imageSize || "18px") + ";object-fit:contain}" +
    ".cb-chip:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}" +
    /* Disposicion del banner y del panel. Van DESPUES de las reglas base a
       proposito: son variantes que las pisan. Sin estas claves, el CSS que se
       genera es exactamente el de siempre. */
    bannerLayoutCss(C, BN) +
    panelPlacementCss(C, PN) +
    "@keyframes cb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
    "@keyframes cb-slide-x{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}" +
    "@keyframes cb-slide-y{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}" +
    "@keyframes cb-fade{from{opacity:0}to{opacity:1}}" +
    "@media (max-width:720px){.cb-inner{flex-direction:column;align-items:stretch;gap:18px}.cb-copy{flex:0 0 auto}.cb-actions{justify-content:flex-start}.cb-row{padding:18px 20px}.cb-head{padding:24px 20px 18px}.cb-foot{padding:18px 20px 20px;align-items:stretch;flex-direction:column}.cb-foot-right{justify-content:space-between}}" +
    "@media (prefers-reduced-motion:reduce){.cb-inner,.cb-panel,.cb-overlay{animation:none}}";
  }

  // Las reglas @font-face no cruzan el Shadow DOM: el <link> va en el <head>
  // del documento para que la tipografia de marca aplique dentro del shadow.
  function loadWebfont(C) {
    if (!C.webfont || document.getElementById("cb-webfont")) return;
    var l = document.createElement("link");
    l.id = "cb-webfont"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500&" +
             "family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";
    (document.head || document.documentElement).appendChild(l);
  }

  function ensureRoot(C) {
    if (root) return;
    // Fase 1: la UI se monta dentro de un Shadow DOM. Aisla estilos en ambos
    // sentidos: el CSS del sitio anfitrion no entra, y el nuestro no sale.
    loadWebfont(C);
    var host = document.createElement("div");
    host.id = "consent-banner-host";
    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = css(C) + cssAMedida(C);
    shadow.appendChild(style);
    document.body.appendChild(host);
    pintaSelectorPrueba(C);
    root = shadow; // a partir de aqui todo se monta dentro del shadow root
  }

  // ---- Deteccion de idioma --------------------------------------------------
  // Que idiomas sabe hablar este banner: los que trae de serie (COPY) mas los
  // que el sitio haya escrito a mano en texts. Si la config declara una lista
  // en "languages", manda esa, porque un sitio puede querer ofrecer solo dos
  // aunque el bundle sepa mas.
  function idiomasDisponibles(C) {
    var set = {}, k;
    for (k in COPY) if (COPY.hasOwnProperty(k)) set[k] = true;
    if (C && C.texts) for (k in C.texts) if (C.texts.hasOwnProperty(k)) set[k] = true;
    var todos = []; for (k in set) if (set.hasOwnProperty(k)) todos.push(k);
    if (C && C.languages && C.languages.length) {
      var permitidos = C.languages.map(function (x) { return String(x).toLowerCase(); });
      var filtrados = todos.filter(function (x) { return permitidos.indexOf(x) !== -1; });
      if (filtrados.length) return filtrados;   // si la lista deja todo fuera, la ignoramos
    }
    return todos;
  }

  // "es-419", "ES_es" o "es" tienen que acabar todos en "es". Comparamos solo
  // la parte base salvo que exista una variante exacta (por si algun dia hay
  // "pt-br" separado de "pt").
  function normalizaIdioma(valor, disponibles) {
    if (!valor) return null;
    var v = String(valor).toLowerCase().replace("_", "-");
    if (disponibles.indexOf(v) !== -1) return v;
    var base = v.split("-")[0];
    return disponibles.indexOf(base) !== -1 ? base : null;
  }

  // Orden de mando, de mas explicito a menos:
  //   1. ?consentLang=en en la URL      -> para poder probar y enlazar
  //   2. window.__consentLang            -> si el CMS ya sabe el idioma
  //   3. navigator.languages             -> lo que el visitante pidio
  //   4. <html lang="en">                -> el idioma de la pagina servida
  //   5. defaultLanguage
  // navigator va antes que <html lang> a proposito: un sitio con paginas solo
  // en espanol puede recibir a un aleman con el navegador en ingles, y el
  // ingles le sirve de mas que el espanol.
  function detectaIdioma(C) {
    var disp = idiomasDisponibles(C), elegido = null, i;

    try {
      var q = location.search.match(/[?&]consentLang=([^&]+)/);
      if (q) elegido = normalizaIdioma(decodeURIComponent(q[1]), disp);
    } catch (e) {}

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
      } catch (e) {}
      // Respetamos el orden de preferencia del visitante: si pidio fr, de, en
      // y solo tenemos en, le damos ingles.
      for (i = 0; i < pref.length && !elegido; i++) {
        elegido = normalizaIdioma(pref[i], disp);
      }
      if (!elegido) {
        try {
          var h = document.documentElement.getAttribute("lang");
          elegido = normalizaIdioma(h, disp);
        } catch (e) {}
      }
    }

    if (!elegido) elegido = normalizaIdioma(C.defaultLanguage, disp) || C.defaultLanguage || "es";
    return elegido;
  }

  // Texto multiidioma de una categoria. Sin esto, una categoria que solo
  // define "es" sale como "undefined" en cuanto el idioma activo es otro.
  // Orden: idioma activo -> idioma por defecto -> es -> en -> primero que haya.
  function lang(obj, C) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;          // admite label:"Texto"
    var candidatos = [state.lang, C && C.defaultLanguage, "es", "en"], i;
    for (i = 0; i < candidatos.length; i++) {
      var k = candidatos[i];
      if (k && obj[k] != null && obj[k] !== "") return obj[k];
    }
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] != null && obj[key] !== "") return obj[key];
    }
    return "";
  }

  // La URL la escribe el cliente en el dashboard y acaba dentro de un atributo
  // HTML, asi que hay que escaparla. Ademas solo dejamos pasar esquemas
  // seguros: un "javascript:..." aqui seria ejecucion de codigo en el sitio
  // de todos sus visitantes.
  function urlSegura(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;   // absoluta o protocolo relativo
    if (u.charAt(0) === "/" || u.charAt(0) === "#") return u;   // dentro del sitio
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";              // cualquier otro esquema
    return u;                                                   // relativa simple
  }

  function escAttr(v) {
    return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Sin URL configurada no pintamos un enlace muerto: un <a href="#"> que no
  // lleva a ninguna parte es peor que no tener enlace, porque el visitante
  // cree que puede leer la politica y no puede.
  function policyLink(C, L) {
    var u = urlSegura(lang(C.policyUrl, C));
    if (!u) return "";
    var extra = (C.policyNewTab === false) ? "" :
                " target='_blank' rel='noopener noreferrer'";
    return "<a href='" + escAttr(u) + "'" + extra + ">" + L.policy + "</a>";
  }

  function t() {
    var C = merged();
    var base = COPY[state.lang] || COPY.es;
    var over = (C.texts && C.texts[state.lang]) || {};
    var out = {}; var k;
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
    el.innerHTML =
      "<div class='cb-inner'>" +
        "<div class='cb-copy'>" +
          (C.showEyebrow === false ? "" : "<p class='cb-eyebrow'>" + L.eyebrow + "</p>") +
          (state.gpcChoque
            ? "<p class='cb-gpc'>" + (L.gpcConflict ||
                "Tu navegador pide que no vendamos ni compartamos tus datos, pero aqui "+
                "ya habias aceptado. Dinos que prefieres.") + "</p>"
            : "") +
          "<p class='cb-body'>" + L.body + " " + policyLink(C, L) + "</p>" +
        "</div>" +
        "<div class='cb-actions'>" +
          "<button class='cb-btn cb-ghost' data-a='manage'>" + L.manage + "</button>" +
          "<button class='cb-btn cb-ghost' data-a='reject'>" + L.reject + "</button>" +
          "<button class='cb-btn cb-accept' data-a='accept'>" + L.accept + "</button>" +
        "</div>" +
      "</div>";
    el.querySelector("[data-a='accept']").onclick = function () { acceptAll(C); };
    el.querySelector("[data-a='reject']").onclick = function () { rejectAll(C); };
    el.querySelector("[data-a='manage']").onclick = function () { openPanel(C); };
    return el;
  }

  // NodeList.forEach no existe en WebKit antiguo; este helper recorre igual.
  function each(list, fn) { Array.prototype.slice.call(list).forEach(fn); }

  function buildPanel(C) {
    var L = t();
    var overlay = document.createElement("div");
    overlay.className = "cb-overlay";
    overlay.onclick = function (e) { if (e.target === overlay) hidePanel(); };
    var rows = C.categories.map(function (cat) {
      var checked = cat.locked ? true : !!state.chosen[cat.id];
      var pill = (cat.locked && C.showAlwaysPill !== false) ? " <span class='cb-pill'>" + L.always + "</span>" : "";
      var rol = ((C.switchStyle || {}).shape === "checkbox") ? "checkbox" : "switch";
      var control = cat.locked
        ? "<button class='cb-sw' role='" + rol + "' aria-checked='true' aria-disabled='true' disabled><span class='cb-knob'></span></button>"
        : "<button class='cb-sw' role='" + rol + "' aria-checked='" + checked + "' data-cat='" + cat.id + "'><span class='cb-knob'></span></button>";
      return "<div class='cb-row'>" +
        "<div class='t'><strong>" + lang(cat.label, C) + pill + "</strong><span>" + lang(cat.desc, C) + "</span></div>" +
        control +
      "</div>";
    }).join("");
    overlay.innerHTML =
      "<div class='cb-panel' role='dialog' aria-modal='true' aria-label='" + L.panelTitle + "'>" +
        ((C.panel || {}).showClose ? "<button class='cb-close' data-a='close' aria-label='Close'><svg width='16' height='16' viewBox='0 0 16 16' stroke='currentColor' stroke-width='1.3'><line x1='1' y1='1' x2='15' y2='15'/><line x1='15' y1='1' x2='1' y2='15'/></svg></button>" : "") +
        "<div class='cb-head'>" +
          (C.showEyebrow === false ? "" : "<p class='cb-eyebrow2'>" + L.panelEyebrow + "</p>") +
          "<h2>" + L.panelTitle + "</h2>" +
          "<p class='cb-intro'>" + L.panelIntro + "</p>" +
        "</div>" +
        "<div class='cb-rows'>" + rows + "</div>" +
        "<div class='cb-foot'>" +
          "<button class='cb-btn2 cb-outline' data-a='reject'>" + L.rejectOptional + "</button>" +
          "<div class='cb-foot-right'>" +
            "<button class='cb-btn2 cb-text' data-a='accept'>" + L.accept + "</button>" +
            "<button class='cb-btn2 cb-save' data-a='save'>" + L.save + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    each(overlay.querySelectorAll(".cb-sw[data-cat]"), function (sw) {
      sw.onclick = function () {
        sw.setAttribute("aria-checked", (sw.getAttribute("aria-checked") !== "true").toString());
      };
      sw.onkeydown = function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); sw.click(); }
      };
    });
    overlay.querySelector("[data-a='save']").onclick = function () {
      var chosen = {};
      C.categories.forEach(function (cat) { chosen[cat.id] = !!cat.locked; });
      each(overlay.querySelectorAll(".cb-sw[data-cat]"), function (sw) {
        chosen[sw.getAttribute("data-cat")] = sw.getAttribute("aria-checked") === "true";
      });
      persist(C, "custom", chosen);
    };
    var btnClose = overlay.querySelector("[data-a='close']");
    if (btnClose) btnClose.onclick = function () { hidePanel(); };
    overlay.querySelector("[data-a='reject']").onclick = function () { rejectAll(C); };
    overlay.querySelector("[data-a='accept']").onclick = function () { acceptAll(C); };
    return overlay;
  }

  /* Galleta de trazo, hereda el color del pill con currentColor. Va en linea
     para no pedir una peticion de red ni tocar la CSP del sitio. */
  var ICONO_PILL =
    "<svg viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>" +
    "<path d='M12 3a9 9 0 1 0 9 9 4.5 4.5 0 0 1-4.5-4.5A4.5 4.5 0 0 1 12 3Z' " +
    "stroke='currentColor' stroke-width='1.6' stroke-linejoin='round'/>" +
    "<circle cx='9.2' cy='9.4' r='1.05' fill='currentColor'/>" +
    "<circle cx='8.4' cy='14.8' r='1.05' fill='currentColor'/>" +
    "<circle cx='13.9' cy='14.4' r='1.05' fill='currentColor'/></svg>";

  // El pill ya no lleva punto de color: su contenido lo decide chip.mode.
  //   text  -> solo la etiqueta de textos.chip
  //   image -> solo el icono (chip.image si lo hay, si no el incluido)
  //   both  -> icono + etiqueta
  function buildChip(C) {
    var P = C.chip || {}, mode = P.mode || "text", label = t().chip, html = "";
    /* Sin chip.image el modo imagen antes caia a texto, asi que las tres
       opciones se veian igual. Con este icono incluido cada modo se distingue
       sin pedir una URL; chip.image lo sigue pisando cuando lo hay. */
    var img = P.image
      ? "<img src='" + String(P.image).replace(/'/g, "&#39;") +
        "' alt='" + String(P.imageAlt || "").replace(/'/g, "&#39;") + "'>"
      : ICONO_PILL;
    if (mode === "image")      html = img;
    else if (mode === "both")  html = img + "<span>" + label + "</span>";
    else                       html = "<span>" + label + "</span>";
    var el = document.createElement("button");
    el.className = "cb-chip";
    el.type = "button";
    el.innerHTML = html;
    // Con solo imagen el boton se queda sin texto accesible: se etiqueta aparte.
    if (mode === "image") el.setAttribute("aria-label", P.imageAlt || label);
    el.onclick = function () { openPanel(C); };
    return el;
  }

  // ---- Mostrar / ocultar ----------------------------------------------------
  var bdropEl = null;

  /* El velo es un elemento aparte del banner: asi el banner conserva su propio
     layout (barra, tarjeta o centrado) sin tener que meterlo dentro. */
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
      try { document.documentElement.style.overflow = "hidden"; } catch (e) {}
    }
  }
  function hideBackdrop() {
    if (bdropEl) bdropEl.style.display = "none";
    try { document.documentElement.style.overflow = ""; } catch (e) {}
  }

  function showBanner(C) {
    ensureRoot(C);
    if (!bannerEl) { bannerEl = buildBanner(C); root.appendChild(bannerEl); }
    bannerEl.style.display = "";
    showBackdrop(C);
  }
  function hideBanner() { if (bannerEl) bannerEl.style.display = "none"; hideBackdrop(); }
  function openPanel(C) { ensureRoot(C); panelEl = buildPanel(C); root.appendChild(panelEl); }

  /* Lo que abre el disparador del sitio. Por defecto el panel, que es lo que
     hacia antes; con trigger.opens = "banner" reabre el aviso entero, util si
     se quiere dar la opcion de aceptar o rechazar de golpe sin pasar por los
     ajustes. */
  function abrirDesdeTrigger(C) {
    if (((C.trigger || {}).opens) === "banner") {
      hidePanel();
      if (chipEl) chipEl.removeAttribute("data-on");   // el pill se apaga asi
      showBanner(C);
    } else {
      openPanel(C);
    }
  }
  function hidePanel() { if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl); panelEl = null; }
  function showChip(C) {
    if (C.chip && C.chip.enabled === false) return;   // el sitio no quiere pill
    ensureRoot(C);
    if (!chipEl) { chipEl = buildChip(C); root.appendChild(chipEl); }
    chipEl.setAttribute("data-on", "1");
  }


  // ---- Global Privacy Control ----------------------------------------------
  // Desde enero de 2026 es exigible en una docena de estados: la senal GPC del
  // navegador vale como peticion de opt-out y hay que respetarla SIN preguntar.
  // Solo cuenta si no hay decision previa: una eleccion explicita posterior del
  // visitante manda sobre la senal, porque es mas informada y mas reciente.
  function gpcActivo() {
    try { return navigator.globalPrivacyControl === true; } catch (e) { return false; }
  }

  // Categorias que la senal apaga. Por defecto, todas las que se pueden
  // denegar: GPC cubre "venta y comparticion" y, sin saber que hace cada
  // categoria del sitio, apagar de menos seria arriesgar el incumplimiento.
  function gpcCategorias(C) {
    var g = C.gpc || {};
    var ids = (g.categories && g.categories.length) ? g.categories : null;
    var chosen = {};
    C.categories.forEach(function (c) {
      if (c.locked) { chosen[c.id] = true; return; }          // esenciales, siempre
      chosen[c.id] = ids ? (ids.indexOf(c.id) === -1) : false;
    });
    return chosen;
  }

  function aplicarGPC(C) {
    var chosen = gpcCategorias(C);
    var apagadas = Object.keys(chosen).filter(function (k) { return !chosen[k]; });
    log("gpc", "Senal GPC detectada. Se deniega sin preguntar: " +
        (apagadas.join(", ") || "nada") + ".");
    state.gpc = true;
    persist(C, "gpc", chosen);
  }

  function acceptAll(C) {
    var chosen = {}; C.categories.forEach(function (c) { chosen[c.id] = true; });
    persist(C, "all", chosen);
  }
  function rejectAll(C) {
    var chosen = {}; C.categories.forEach(function (c) { chosen[c.id] = !!c.locked; });
    persist(C, "none", chosen);
  }

  // ---- Arranque -------------------------------------------------------------
  function loadRemoteThen(C, done) {
    var base = String(C.apiBase).replace(/\/$/, "");
    var url = base + "/api/config?site_id=" + encodeURIComponent(C.siteId);
    log("remote", "Pidiendo config remota: " + url);
    fetch(url).then(function (r) { return r.json(); }).then(function (remote) {
      _remote = remote || {};
      _remote.endpoint = base + "/api/consent";
      _remote.apiBase = base;
      _remote.siteId = C.siteId;
      if (C.publicKey && !_remote.publicKey) _remote.publicKey = C.publicKey;
      _remoteLoaded = true;
      log("remote", "Config remota cargada (site_id=" + C.siteId + ").");
      // Las reglas de bloqueo se cargaron antes de tener esta config, asi que
      // estaban vacias: con el sitio configurado en remoto, el bloqueo duro no
      // protegia a un visitante nuevo. Se repueblan aqui y, mientras no haya
      // decision, se consideran todas denegadas, que es lo que exige la ley.
      var cr = merged();
      _reglasVivas = cr.autoBlock || [];
      _duroActivo = cr.hardBlocking !== false;
      // Y con las reglas ya puestas hay que repasar el DOM: lo que el parser
      // monto mientras no habia reglas (un iframe de video, un pixel) seguiria
      // cargado. Sin esto, un sitio configurado en remoto no bloqueaba nada de
      // lo que viniera en el HTML inicial.
      if (_reglasVivas.length) scanExisting(_reglasVivas);
      // El Consent Mode se decide con la misma config: si el modo avanzado solo
      // esta en la remota, el "default" no se habria emitido nunca.
      gcmDefault(cr);
      if (_reglasVivas.length) log("autoblock", "Reglas desde la config remota: " + _reglasVivas.length + ".");
      done();
    }).catch(function () {
      _remoteLoaded = true;
      log("remote", "No se pudo cargar la config remota; se usa la local.");
      done();
    });
  }

  // ---- Disparadores de reapertura ------------------------------------------
  // Delegacion en el documento: funciona con elementos que aparezcan despues
  // (footers cargados por AJAX, menus del tema) sin volver a enganchar nada.
  var _triggersOn = false;
  function installTriggers(C) {
    if (_triggersOn) return;
    _triggersOn = true;
    var T = C.trigger || {};

    document.addEventListener("click", function (ev) {
      var n = ev.target;
      while (n && n !== document) {
        if (n.nodeType === 1) {
          var esNuestro = n.hasAttribute && n.hasAttribute("data-consent-open");
          if (!esNuestro && T.selector) {
            try { esNuestro = n.matches && n.matches(T.selector); } catch (e) {}
          }
          if (esNuestro) {
            // preventDefault evita el salto de scroll del href="#" y, sobre
            // todo, que el router del tema intente navegar a esa ancla.
            ev.preventDefault();
            ev.stopPropagation();
            abrirDesdeTrigger(merged());
            return;
          }
        }
        n = n.parentNode;
      }
    }, true);   // fase de captura: llegamos antes que el router del tema

    if (T.hash) {
      var mira = function () {
        if (location.hash.replace(/^#/, "").toLowerCase() === String(T.hash).toLowerCase()) {
          abrirDesdeTrigger(merged());
          // Limpiamos el hash para que recargar no reabra el panel una y otra vez.
          try { history.replaceState(null, "", location.pathname + location.search); }
          catch (e) {}
        }
      };
      window.addEventListener("hashchange", mira);
      mira();   // tambien si se llega con el ancla ya puesta
    }
  }

  // Red de seguridad: retirar el consentimiento tiene que ser tan facil como
  // darlo. Si el pill esta oculto y en la pagina no hay ningun disparador, el
  // visitante se quedaria encerrado con su decision, asi que mostramos el pill
  // igualmente. Se comprueba tarde porque muchos footers se pintan despues.
  function checkSafety(C) {
    var T = C.trigger || {};
    if (T.safety === false) return;
    if (!C.chip || C.chip.enabled !== false) return;   // el pill ya se ve
    setTimeout(function () {
      var hay = document.querySelector("[data-consent-open]");
      // Un enlace al ancla tambien es un disparador valido: sin esto,
      // un footer con <a href="#cookies"> haria aparecer el pill de todos modos.
      if (!hay && T.hash) {
        try { hay = document.querySelector("a[href$='#" + T.hash + "']"); } catch (e) {}
      }
      if (!hay && T.selector) {
        try { hay = document.querySelector(T.selector); } catch (e) {}
      }
      if (!hay) {
        log("safety", "Pill oculto y sin ningun disparador en la pagina: se muestra " +
                      "el pill para no dejar al visitante sin forma de cambiar de opinion.");
        var C2 = merged();
        C2.chip = Object.assign({}, C2.chip || {}, { enabled: true });
        showChip(C2);
      }
    }, 1500);
  }

  function init() {
    var C = merged();
    if (C.siteId && C.apiBase && !_remoteLoaded) {
      loadRemoteThen(C, function () { proceed(merged()); });
      return;
    }
    proceed(C);
  }

  function proceed(C) {
    installTriggers(C);
    state.lang = detectaIdioma(C);
    log("init", "Idioma del banner: " + state.lang +
        " (navegador: " + ((navigator.languages || [navigator.language || "?"])[0]) + ").");
    var prev = readConsent(C);
    var gpcMandaAhora = gpcActivo() && !(C.gpc && C.gpc.enabled === false);
    // La persona decidio en su dia Y AHORA llega con la senal puesta: son dos
    // instrucciones suyas que se contradicen, y la senal es la mas reciente.
    // Que hacer con eso no es una cuestion tecnica sino de riesgo, asi que lo
    // decide cada sitio con gpc.onConflict:
    //   "revoke" (por defecto) la senal gana y se deniega lo denegable
    //   "ask"    se vuelve a preguntar, explicando el choque en el banner
    //   "keep"   la decision explicita de antes se mantiene
    // Lo que NUNCA se revoca es lo que el visitante eligio con la senal ya
    // puesta: si no, su eleccion volveria atras en cada visita y el pill no
    // serviria de nada.
    var choque = prev && prev.version === C.consentVersion &&
                 gpcMandaAhora && prev.choice !== "gpc" && prev.gpc !== true;
    if (choque) {
      var modo = (C.gpc && C.gpc.onConflict) || "revoke";
      if (modo === "revoke") {
        log("gpc", "Habia una decision previa, pero la senal GPC es posterior: se revoca.");
        aplicarGPC(C);
        showChip(C);
        return;
      }
      if (modo === "ask") {
        log("gpc", "Habia una decision previa y llega senal GPC: se vuelve a preguntar.");
        state.gpcChoque = true;        // el banner lo explica arriba del todo
        showBanner(C);
        return;
      }
      // modo "keep": la decision explicita de antes se mantiene y seguimos.
      log("gpc", "Senal GPC ignorada: este sitio prioriza la decision previa (onConflict=keep).");
    }

    if (prev && prev.version === C.consentVersion) {
      // Ya decidio: no mostrar banner, cargar toggles, limpiar si hace falta.
      state.chosen = prev.categories || {};
      log("init", "Decision previa encontrada (choice=" + prev.choice + ").");
      if (C.activeDeletion) {
        deleteAnalyticsCookies(state.chosen);
        startDeletionWatch(C, state.chosen);   // los terceros reescriben tras cargar
      }
      showChip(C);
      checkSafety(C);
      // Mismo orden que en persist: retirar las reglas concedidas antes de
      // reactivar, o el parche de insercion mata lo que acabamos de revivir.
      refreshAutoBlock(C, state.chosen);
      activateScripts(C, state.chosen);
    } else if (gpcMandaAhora) {
      // Nada de banner: la senal YA es la respuesta. Queda el pill (o el enlace
      // del pie) para que el visitante pueda cambiarla cuando quiera.
      aplicarGPC(C);
      showChip(C);
    } else {
      log("init", prev ? "Version de consentimiento cambio: se vuelve a preguntar." : "Sin decision previa: se muestra el banner.");
      showBanner(C);
    }
    startDiscovery(C);
  }


  // ---- API publica (ESM) ----------------------------------------------------
  // start(config) permite a un framework pasar la config por argumento en vez
  // de por window.__consentConfig. El resto es la misma API de siempre.
export function blockNow() { gcmDefault(merged()); installAutoBlock(); instalarBloqueoDuro(merged()); }
export function start(config) { if (config) { _userConfig = config; } init(); }
export function open() { openPanel(merged()); }
export function reset() {
  var C = merged();
  document.cookie = cookieName(C) + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  location.reload();
}
export function setLanguage(l) {
  var C = merged();
  var disp = idiomasDisponibles(C);
  var norm = normalizaIdioma(l, disp);
  if (!norm) { log("lang", "Idioma no disponible: " + l + ". Se mantiene " + state.lang + "."); return; }
  if (norm === state.lang) return;
  state.lang = norm;
  // Hay que repintar TODO lo que este en pantalla, no solo el banner: si el
  // visitante tenia el panel abierto o el pill puesto, se quedaban en el
  // idioma anterior hasta recargar.
  if (bannerEl) { bannerEl.remove(); bannerEl = null; showBanner(C); }
  if (panelEl) { hidePanel(); openPanel(C); }
  if (chipEl) { chipEl.remove(); chipEl = null; showChip(C); }
}
export function getLanguage() { return state.lang; }
export default { start: start, open: open, reset: reset, setLanguage: setLanguage, getLanguage: getLanguage, blockNow: blockNow };
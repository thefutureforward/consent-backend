/*
 * Consent Banner. Bundle universal embebible (Fase 1, scaffold).
 *
 * Parte B del modelo de dos partes. Trae la UI, la logica de persist,
 * el borrado activo de cookies y la auditoria. La Parte A (stub inline
 * en el <head>) fija Consent Mode en denied y reaplica lo guardado antes
 * de que cargue GTM.
 *
 * Agnostico de plataforma y de framework. Se carga con una etiqueta
 * script async cuyo src apunta a este archivo (ver index.html),
 * y se configura con window.__consentConfig.
 *
 * Todo lo que aqui aparece hardcodeado es un DEFAULT: se sobreescribe por config.
 */
(function () {
  "use strict";

  // ---- Config por defecto (todo sobreescribible por el cliente) -------------
  var DEFAULTS = {
    namespace: "consent",          // prefijo de cookie y de eventos dataLayer
    gtmId: "",                     // vacio = modo sin GTM (gtag directo)
    endpoint: "",                  // vacio = sin auditoria backend
    consentVersion: "2025-01",     // al cambiar, se vuelve a preguntar
    defaultLanguage: "es",
    cookie: { lifetimeMonths: 6, domain: "" },
    colors: {
      ink: "#14243D", inkSoft: "#22344F", accent: "#2E7D74", text: "#E7ECF3",
      accentSoft: "#E4EDE7", heading: "#1c1e1c", body: "#54606a",
      cream: "#F3EEE1", panelBg: "#ffffff"
    },
    fonts: {
      heading: "Georgia, 'Times New Roman', serif",
      body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    },
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

  var COPY = {
    es: {
      eyebrow: "Cookies",
      body: "Usamos cookies para que el sitio funcione y, con tu permiso, para medir su uso y mostrarte contenido relevante.",
      policy: "Politica de cookies",
      manage: "Personalizar", reject: "Solo necesarias", accept: "Aceptar todas",
      rejectOptional: "Rechazar las opcionales",
      panelEyebrow: "Tu control",
      panelTitle: "Gestiona tus cookies",
      panelIntro: "Las esenciales no se pueden desactivar. Lo demas lo decides tu.",
      always: "Siempre activas", save: "Guardar preferencias",
      chip: "Cookies", close: "Cerrar"
    },
    en: {
      eyebrow: "Cookies",
      body: "We use cookies so the site works and, with your permission, to measure usage and show you relevant content.",
      policy: "Cookie policy",
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
  function merged() {
    var c = window.__consentConfig || {};
    var m = JSON.parse(JSON.stringify(DEFAULTS));
    for (var k in c) if (c.hasOwnProperty(k)) m[k] = c[k];
    if (_remote) for (var k2 in _remote) if (_remote.hasOwnProperty(k2)) m[k2] = _remote[k2];
    return m;
  }
  function log(kind, detail) {
    // Puente para la consola de eventos de la demo (no afecta a produccion).
    if (typeof window.__consentLog === "function") window.__consentLog(kind, detail);
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
    ALL_SIGNALS.forEach(function (s) { out[s] = "denied"; });
    C.categories.forEach(function (cat) {
      var granted = cat.locked ? true : !!chosen[cat.id];
      if (granted) cat.signals.forEach(function (s) { out[s] = "granted"; });
    });
    return out;
  }

  // Borrado ACTIVO de cookies de analitica de Google. No toca otros servicios.
  function deleteAnalyticsCookies() {
    var patterns = ["_ga", "_gid", "_gat", "__utm", "_gcl"];
    var host = location.hostname;
    var root = host.split(".").slice(-2).join(".");
    var domains = ["", host, "." + host, root, "." + root];
    var deleted = [];
    document.cookie.split(";").forEach(function (raw) {
      var nm = raw.split("=")[0].trim();
      var hit = patterns.some(function (p) { return nm.indexOf(p) === 0; });
      if (!hit || !nm) return;
      domains.forEach(function (dm) {
        var s = nm + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        if (dm) s += ";domain=" + dm;
        document.cookie = s;
      });
      deleted.push(nm);
    });
    if (deleted.length) log("delete", "Borrado activo: " + deleted.join(", "));
    return deleted;
  }

  // Bloqueo manual de scripts (sitios sin GTM). El sitio marca los scripts como
  //   <script type="text/plain" data-consent-category="statistics" data-src="..."></script>
  // y aqui, al conceder esa categoria, se convierten en scripts ejecutables.
  function isGranted(C, chosen, catId) {
    var cat = C.categories.filter(function (c) { return c.id === catId; })[0];
    if (cat && cat.locked) return true;
    return !!chosen[catId];
  }
  function activateScripts(C, chosen) {
    if (!C.manageScripts) return;
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent-category]');
    var activated = [];
    Array.prototype.forEach.call(nodes, function (old) {
      var cat = old.getAttribute("data-consent-category");
      if (!isGranted(C, chosen, cat)) return; // sigue bloqueado
      var s = document.createElement("script");
      for (var i = 0; i < old.attributes.length; i++) {
        var a = old.attributes[i];
        if (a.name === "type" || a.name === "data-consent-category" || a.name === "data-src") continue;
        s.setAttribute(a.name, a.value);
      }
      var src = old.getAttribute("data-src");
      if (src) s.src = src; else s.text = old.textContent;
      old.parentNode.replaceChild(s, old);
      activated.push(cat);
    });
    if (activated.length) log("scripts", "Scripts activados: " + activated.join(", "));
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
      version: C.consentVersion
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
      version: C.consentVersion
    };
    // 1. Guardar en cookie.
    writeConsent(C, consent);
    log("save", "Guardado en cookie " + cookieName(C) + " (choice=" + choice + ")");
    // 2. Ocultar UI y actualizar estado.
    hideBanner(); hidePanel(); showChip(C); state.chosen = chosen;
    // 3. Consent Mode v2: update.
    gtag("consent", "update", signals);
    log("update", JSON.stringify(signals));
    // 3b. Activar scripts bloqueados de las categorias concedidas (sitios sin GTM).
    activateScripts(C, chosen);
    // 4. Borrado activo si analitica quedo en denied.
    if (C.activeDeletion && signals.analytics_storage === "denied") deleteAnalyticsCookies();
    // 5. Auditoria (no bloquea).
    postAudit(C, consent);
    if (typeof C.onConsentChange === "function") C.onConsentChange(consent);
  }

  // ---- UI (Shadow DOM llega en Fase 1; aqui va sobre el documento) ----------
  var root, bannerEl, panelEl, chipEl;

  function css(C) {
    return "" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:" + C.fonts.body + "}" +
    ".cb-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:" + C.colors.ink + ";color:" + C.colors.text + ";padding:20px clamp(16px,5vw,48px);box-shadow:0 -8px 30px rgba(0,0,0,.25);animation:cb-rise .4s cubic-bezier(.2,.8,.2,1)}" +
    ".cb-inner{max-width:1100px;margin:0 auto;display:flex;gap:24px;align-items:center;flex-wrap:wrap}" +
    ".cb-copy{flex:1 1 380px;min-width:0}" +
    ".cb-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin:0 0 6px}" +
    ".cb-body{margin:0;font-size:14px;line-height:1.55;max-width:62ch}" +
    ".cb-body a{color:#fff;text-decoration:underline;text-underline-offset:2px}" +
    ".cb-actions{display:flex;gap:10px;flex-wrap:wrap}" +
    ".cb-btn{border:0;border-radius:10px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:transform .08s,opacity .15s}" +
    ".cb-btn:active{transform:translateY(1px)}" +
    ".cb-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".cb-ghost{background:transparent;color:" + C.colors.text + ";border:1px solid rgba(255,255,255,.28)}" +
    ".cb-ghost:hover{border-color:rgba(255,255,255,.6)}" +
    ".cb-accept{background:" + C.colors.accent + ";color:#fff}" +
    ".cb-accept:hover{opacity:.92}" +
    // ---- Panel ----
    ".cb-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(20,26,40,.5);display:flex;align-items:center;justify-content:center;padding:20px;animation:cb-fade .2s ease}" +
    ".cb-panel{background:" + C.colors.panelBg + ";color:" + C.colors.heading + ";width:min(600px,100%);max-height:88vh;overflow:auto;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}" +
    ".cb-head{padding:30px 32px 14px}" +
    ".cb-eyebrow2{margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:" + C.colors.accent + "}" +
    ".cb-panel h2{margin:0 0 12px;font-family:" + C.fonts.heading + ";font-weight:600;font-size:30px;line-height:1.1;color:" + C.colors.heading + "}" +
    ".cb-intro{margin:0;font-size:14.5px;line-height:1.6;color:" + C.colors.body + ";max-width:56ch}" +
    ".cb-rows{padding:6px 32px}" +
    ".cb-row{display:flex;gap:16px;align-items:flex-start;padding:18px 0;border-top:1px solid #ececec}" +
    ".cb-row:first-child{border-top:0}" +
    ".cb-row .t{flex:1}" +
    ".cb-row .t strong{display:block;font-size:15px;color:" + C.colors.heading + "}" +
    ".cb-row .t span{display:block;font-size:13.5px;color:" + C.colors.body + ";margin-top:3px;line-height:1.5}" +
    ".cb-row .t .cb-pill{display:inline-block;width:auto;margin-left:10px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:" + C.colors.accent + ";background:" + C.colors.accentSoft + ";padding:3px 9px;border-radius:999px;vertical-align:middle}" +
    ".cb-sw{position:relative;width:44px;height:26px;border-radius:999px;background:#cfd6df;border:0;cursor:pointer;flex:0 0 auto;transition:background .15s;padding:0}" +
    ".cb-sw[aria-checked='true']{background:" + C.colors.accent + "}" +
    ".cb-sw[disabled]{opacity:.5;cursor:not-allowed}" +
    ".cb-sw:focus-visible{outline:2px solid " + C.colors.accent + ";outline-offset:2px}" +
    ".cb-knob{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}" +
    ".cb-sw[aria-checked='true'] .cb-knob{left:21px}" +
    ".cb-foot{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:" + C.colors.cream + ";padding:20px 32px;margin-top:8px}" +
    ".cb-btn2{border-radius:10px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s}" +
    ".cb-btn2:focus-visible{outline:2px solid " + C.colors.accent + ";outline-offset:2px}" +
    ".cb-outline{background:transparent;border:1px solid #c9c2b2;color:" + C.colors.heading + ";margin-right:auto}" +
    ".cb-outline:hover{border-color:" + C.colors.heading + "}" +
    ".cb-text{background:transparent;border:0;color:" + C.colors.heading + "}" +
    ".cb-text:hover{text-decoration:underline;text-underline-offset:3px}" +
    ".cb-save{background:" + C.colors.accent + ";border:0;color:#fff}" +
    ".cb-save:hover{opacity:.92}" +
    ".cb-chip{position:fixed;left:16px;bottom:16px;z-index:2147482999;background:" + C.colors.ink + ";color:" + C.colors.text + ";border:0;border-radius:999px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:none}" +
    ".cb-chip:focus-visible{outline:2px solid " + C.colors.ink + ";outline-offset:2px}" +
    "@keyframes cb-rise{from{transform:translateY(100%)}to{transform:translateY(0)}}" +
    "@keyframes cb-fade{from{opacity:0}to{opacity:1}}" +
    "@media (max-width:680px){.cb-inner{flex-direction:column;align-items:stretch}.cb-actions{justify-content:stretch}.cb-btn{flex:1}.cb-foot{flex-direction:column;align-items:stretch}.cb-outline{margin-right:0}}" +
    "@media (prefers-reduced-motion:reduce){.cb-banner,.cb-overlay{animation:none}}";
  }

  function ensureRoot(C) {
    if (root) return;
    // Fase 1: la UI se monta dentro de un Shadow DOM. Aisla estilos en ambos
    // sentidos: el CSS del sitio anfitrion no entra, y el nuestro no sale.
    var host = document.createElement("div");
    host.id = "consent-banner-host";
    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = css(C);
    shadow.appendChild(style);
    document.body.appendChild(host);
    root = shadow; // a partir de aqui todo se monta dentro del shadow root
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
          "<p class='cb-eyebrow'>" + L.eyebrow + "</p>" +
          "<p class='cb-body'>" + L.body + " <a href='#'>" + L.policy + "</a></p>" +
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

  function buildPanel(C) {
    var L = t();
    var overlay = document.createElement("div");
    overlay.className = "cb-overlay";
    overlay.onclick = function (e) { if (e.target === overlay) hidePanel(); };
    var rows = C.categories.map(function (cat) {
      var checked = cat.locked ? true : !!state.chosen[cat.id];
      var pill = cat.locked ? " <span class='cb-pill'>" + L.always + "</span>" : "";
      var control = cat.locked
        ? "<button class='cb-sw' role='switch' aria-checked='true' aria-disabled='true' disabled><span class='cb-knob'></span></button>"
        : "<button class='cb-sw' role='switch' aria-checked='" + checked + "' data-cat='" + cat.id + "'><span class='cb-knob'></span></button>";
      return "<div class='cb-row'>" +
        "<div class='t'><strong>" + cat.label[state.lang] + pill + "</strong><span>" + cat.desc[state.lang] + "</span></div>" +
        control +
      "</div>";
    }).join("");
    overlay.innerHTML =
      "<div class='cb-panel' role='dialog' aria-modal='true' aria-label='" + L.panelTitle + "'>" +
        "<div class='cb-head'>" +
          "<p class='cb-eyebrow2'>" + L.panelEyebrow + "</p>" +
          "<h2>" + L.panelTitle + "</h2>" +
          "<p class='cb-intro'>" + L.panelIntro + "</p>" +
        "</div>" +
        "<div class='cb-rows'>" + rows + "</div>" +
        "<div class='cb-foot'>" +
          "<button class='cb-btn2 cb-outline' data-a='reject'>" + L.rejectOptional + "</button>" +
          "<button class='cb-btn2 cb-text' data-a='accept'>" + L.accept + "</button>" +
          "<button class='cb-btn2 cb-save' data-a='save'>" + L.save + "</button>" +
        "</div>" +
      "</div>";
    overlay.querySelectorAll(".cb-sw[data-cat]").forEach(function (sw) {
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
      overlay.querySelectorAll(".cb-sw[data-cat]").forEach(function (sw) {
        chosen[sw.getAttribute("data-cat")] = sw.getAttribute("aria-checked") === "true";
      });
      persist(C, "custom", chosen);
    };
    overlay.querySelector("[data-a='reject']").onclick = function () { rejectAll(C); };
    overlay.querySelector("[data-a='accept']").onclick = function () { acceptAll(C); };
    return overlay;
  }

  function buildChip(C) {
    var el = document.createElement("button");
    el.className = "cb-chip";
    el.textContent = t().chip;
    el.onclick = function () { openPanel(C); };
    return el;
  }

  // ---- Mostrar / ocultar ----------------------------------------------------
  function showBanner(C) { ensureRoot(C); if (!bannerEl) { bannerEl = buildBanner(C); root.appendChild(bannerEl); } bannerEl.style.display = ""; }
  function hideBanner() { if (bannerEl) bannerEl.style.display = "none"; }
  function openPanel(C) { ensureRoot(C); panelEl = buildPanel(C); root.appendChild(panelEl); }
  function hidePanel() { if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl); panelEl = null; }
  function showChip(C) { ensureRoot(C); if (!chipEl) { chipEl = buildChip(C); root.appendChild(chipEl); } chipEl.style.display = "block"; }

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
      done();
    }).catch(function () {
      _remoteLoaded = true;
      log("remote", "No se pudo cargar la config remota; se usa la local.");
      done();
    });
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
    state.lang = C.defaultLanguage || "es";
    var prev = readConsent(C);
    if (prev && prev.version === C.consentVersion) {
      // Ya decidio: no mostrar banner, cargar toggles, limpiar si hace falta.
      state.chosen = prev.categories || {};
      log("init", "Decision previa encontrada (choice=" + prev.choice + ").");
      if (C.activeDeletion && prev.signals && prev.signals.analytics_storage === "denied") deleteAnalyticsCookies();
      showChip(C);
      activateScripts(C, state.chosen);
    } else {
      log("init", prev ? "Version de consentimiento cambio: se vuelve a preguntar." : "Sin decision previa: se muestra el banner.");
      showBanner(C);
    }
  }

  // API publica minima para la demo y para reabrir preferencias desde el footer.
  window.ConsentBanner = {
    init: init,
    open: function () { openPanel(merged()); },
    reset: function () {
      var C = merged();
      document.cookie = cookieName(C) + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      location.reload();
    },
    setLanguage: function (l) { state.lang = l; if (bannerEl) { bannerEl.remove(); bannerEl = null; showBanner(merged()); } }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

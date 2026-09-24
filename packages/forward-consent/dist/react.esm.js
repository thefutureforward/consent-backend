// src/react.jsx
import { useEffect } from "react";

// src/core.js
var _userConfig = null;
var DEFAULTS = {
  namespace: "fwc_consent",
  // prefijo de cookie y de eventos dataLayer
  gtmId: "",
  // vacio = modo sin GTM (gtag directo)
  endpoint: "",
  // vacio = sin auditoria backend
  consentVersion: "2025-01",
  // al cambiar, se vuelve a preguntar
  defaultLanguage: "es",
  cookie: { lifetimeMonths: 6, domain: "" },
  // Prefijos de cookie que borra activeDeletion al denegar analitica.
  // Ampliable por sitio desde la config remota.
  cookiePatterns: ["_ga", "_gid", "_gat", "__utm", "_gcl"],
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
  // Carga IBM Plex desde Google Fonts. Ponlo en false si la CSP del sitio
  // bloquea fonts.googleapis.com: se cae a las fuentes del sistema.
  webfont: true,
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
var COPY = {
  es: {
    eyebrow: "Cookies",
    body: "Usamos cookies para que el sitio funcione y, con tu permiso, para medir su uso y mostrarte contenido relevante.",
    policy: "Politica de cookies",
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
    close: "Cerrar"
  },
  en: {
    eyebrow: "Cookies",
    body: "We use cookies so the site works and, with your permission, to measure usage and show you relevant content.",
    policy: "Cookie policy",
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
    close: "Close"
  }
};
var _remote = null;
var _remoteLoaded = false;
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
function merged() {
  var m = JSON.parse(JSON.stringify(DEFAULTS));
  var local = _userConfig || typeof window !== "undefined" && window.__consentConfig || {};
  assign(m, local);
  if (_remote) {
    var localBlock = m.autoBlock;
    assign(m, _remote);
    if ((!m.autoBlock || !m.autoBlock.length) && localBlock && localBlock.length) {
      m.autoBlock = localBlock;
    }
  }
  return m;
}
function log(kind, detail) {
  if (typeof window.__consentLog === "function") window.__consentLog(kind, detail);
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
function signalsFrom(C, chosen) {
  var out = {};
  ALL_SIGNALS.forEach(function(s) {
    out[s] = "denied";
  });
  C.categories.forEach(function(cat) {
    var granted = cat.locked ? true : !!chosen[cat.id];
    if (granted) cat.signals.forEach(function(s) {
      out[s] = "granted";
    });
  });
  return out;
}
function deleteAnalyticsCookies() {
  var C = merged();
  var patterns = C.cookiePatterns && C.cookiePatterns.length ? C.cookiePatterns : ["_ga", "_gid", "_gat", "__utm", "_gcl"];
  var host = location.hostname;
  var root2 = host.split(".").slice(-2).join(".");
  var domains = ["", host, "." + host, root2, "." + root2];
  var deleted = [];
  document.cookie.split(";").forEach(function(raw) {
    var nm = raw.split("=")[0].trim();
    var hit = patterns.some(function(p) {
      return nm.indexOf(p) === 0;
    });
    if (!hit || !nm) return;
    domains.forEach(function(dm) {
      var s = nm + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      if (dm) s += ";domain=" + dm;
      document.cookie = s;
    });
    deleted.push(nm);
  });
  if (deleted.length) log("delete", "Borrado activo: " + deleted.join(", "));
  return deleted;
}
var _observer = null;
var _blocked = [];
function refreshAutoBlock(C, chosen) {
  if (!_observer) return;
  var rules = (C.autoBlock || []).filter(function(r) {
    return !isGranted(C, chosen, r.category);
  });
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
      if (a.name === "type" || a.name === "data-consent-category" || a.name === "data-src") continue;
      s.setAttribute(a.name, a.value);
    }
    var src = old.getAttribute("data-src");
    if (src) s.src = src;
    else s.text = old.textContent;
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
var state = { lang: "es", chosen: {} };
function persist(C, choice, chosen) {
  var signals = signalsFrom(C, chosen);
  var consent = {
    consent_id: (readConsent(C) || {}).consent_id || null,
    choice,
    categories: chosen,
    signals,
    ts: Date.now(),
    version: C.consentVersion
  };
  writeConsent(C, consent);
  log("save", "Guardado en cookie " + cookieName(C) + " (choice=" + choice + ")");
  hideBanner();
  hidePanel();
  showChip(C);
  state.chosen = chosen;
  gtag("consent", "update", signals);
  log("update", JSON.stringify(signals));
  activateScripts(C, chosen);
  refreshAutoBlock(C, chosen);
  if (C.activeDeletion && signals.analytics_storage === "denied") deleteAnalyticsCookies();
  postAudit(C, consent);
  if (typeof C.onConsentChange === "function") C.onConsentChange(consent);
}
var root;
var bannerEl;
var panelEl;
var chipEl;
function css(C) {
  var K = C.colors, F = C.fonts;
  return ":host{all:initial}*{box-sizing:border-box;font-family:" + F.body + "}.cb-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;padding:0 20px 20px}.cb-inner{width:100%;max-width:1172px;background:" + K.ink + ";color:" + K.text + ";border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 10px 40px rgba(15,24,38,.28);padding:22px 26px;display:flex;flex-wrap:wrap;gap:28px;align-items:center;justify-content:space-between;animation:cb-rise .26s cubic-bezier(.2,.6,.2,1)}.cb-copy{flex:1 1 380px;display:flex;flex-direction:column;gap:8px;min-width:0}.cb-eyebrow{margin:0;font-family:" + F.mono + ";font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:" + K.accentPale + "}.cb-body{margin:0;font-size:15px;line-height:1.55;color:" + K.text + ";max-width:68ch}.cb-body a{color:" + K.accentPale + ";text-decoration:underline;text-underline-offset:2px;white-space:nowrap}.cb-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end}.cb-btn{border:0;border-radius:8px;padding:11px 18px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,opacity .14s}.cb-btn:focus-visible{outline:2px solid " + K.accentPale + ";outline-offset:2px}.cb-ghost{background:transparent;color:" + K.text + ";border:1px solid rgba(255,255,255,.32)}.cb-ghost:hover{border-color:rgba(255,255,255,.6)}.cb-actions .cb-ghost:first-child{border-color:transparent;padding:11px 14px}.cb-actions .cb-ghost:first-child:hover{border-color:transparent;text-decoration:underline;text-underline-offset:3px}.cb-accept{background:" + K.accent + ";color:" + K.textBright + ";font-weight:600;padding:12px 22px}.cb-accept:hover{background:" + K.accentHover + "}.cb-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483001;background:rgba(22,35,59,.28);display:flex;align-items:center;justify-content:center;padding:24px;animation:cb-fade .2s ease}.cb-panel{background:" + K.panelBg + ";color:" + K.heading + ";width:100%;max-width:560px;max-height:92vh;overflow:auto;border:1px solid " + K.border + ";border-radius:12px;box-shadow:0 20px 60px rgba(22,35,59,.28);animation:cb-rise .24s cubic-bezier(.2,.6,.2,1)}.cb-head{padding:28px 28px 20px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid " + K.border + "}.cb-eyebrow2{margin:0;font-family:" + F.mono + ";font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:" + K.accentHover + "}.cb-panel h2{margin:0;font-family:" + F.heading + ";font-weight:500;font-size:26px;letter-spacing:-.01em;line-height:1.2;color:" + K.heading + "}.cb-intro{margin:0;font-size:14px;line-height:1.6;color:" + K.body + "}.cb-rows{display:flex;flex-direction:column}.cb-row{display:flex;gap:20px;align-items:flex-start;padding:20px 28px;border-bottom:1px solid " + K.border + "}.cb-row .t{flex:1 1 auto;display:flex;flex-direction:column;gap:5px;min-width:0}.cb-row .t strong{font-size:15px;font-weight:700;color:" + K.heading + "}.cb-row .t span{font-size:13.5px;line-height:1.55;color:" + K.body + "}.cb-row .t .cb-pill{display:inline-block;margin-left:10px;font-family:" + F.mono + ";font-size:9px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:" + K.pillFg + ";background:" + K.pillBg + ";padding:4px 9px;border-radius:100px;vertical-align:middle}.cb-sw{position:relative;width:46px;height:26px;border-radius:100px;background:" + K.switchOff + ";border:1px solid " + K.borderStrong + ";cursor:pointer;flex:none;padding:0;transition:background .16s cubic-bezier(.2,.6,.2,1),border-color .16s}.cb-sw[aria-checked='true']{background:" + K.accent + ";border-color:" + K.accent + "}.cb-sw[disabled]{background:" + K.accentSoft + ";border-color:" + K.accentPale + ";opacity:.9;cursor:default}.cb-sw:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}.cb-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:" + K.panelBg + ";box-shadow:0 1px 3px rgba(22,35,59,.25);transition:left .18s cubic-bezier(.2,.6,.2,1)}.cb-sw[aria-checked='true'] .cb-knob{left:23px;background:" + K.textBright + "}.cb-sw[disabled] .cb-knob{left:23px;background:" + K.accent + ";box-shadow:none}.cb-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:" + K.cream + ";padding:20px 28px 24px;border-radius:0 0 11px 11px}.cb-btn2{border-radius:8px;padding:11px 18px;font-size:14px;font-weight:500;cursor:pointer;transition:background .14s,border-color .14s}.cb-btn2:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}.cb-outline{background:transparent;border:1px solid " + K.borderStrong + ";color:" + K.heading + "}.cb-foot-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cb-outline:hover{border-color:" + K.heading + "}.cb-text{background:transparent;border:0;color:" + K.heading + ";padding:11px 14px}.cb-text:hover{text-decoration:underline;text-underline-offset:3px}.cb-save{background:" + K.accent + ";border:0;color:" + K.textBright + ";font-weight:600;padding:12px 22px}.cb-save:hover{background:" + K.accentHover + "}.cb-chip{position:fixed;left:16px;bottom:16px;z-index:2147482999;display:none;align-items:center;gap:7px;background:" + K.panelBg + ";color:" + K.body + ";border:1px solid " + K.border + ";border-radius:999px;padding:8px 13px;font-family:" + F.mono + ";font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 2px 6px rgba(22,35,59,.07)}.cb-chip[data-on='1']{display:flex}.cb-chip .cb-dot{width:7px;height:7px;border-radius:50%;background:" + K.accent + "}.cb-chip:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(47,126,108,.35)}@keyframes cb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes cb-fade{from{opacity:0}to{opacity:1}}@media (max-width:720px){.cb-inner{flex-direction:column;align-items:stretch;gap:18px}.cb-actions{justify-content:flex-start}.cb-row{padding:18px 20px}.cb-head{padding:24px 20px 18px}.cb-foot{padding:18px 20px 20px;align-items:stretch;flex-direction:column}.cb-foot-right{justify-content:space-between}}@media (prefers-reduced-motion:reduce){.cb-inner,.cb-panel,.cb-overlay{animation:none}}";
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
  style.textContent = css(C);
  shadow.appendChild(style);
  document.body.appendChild(host);
  root = shadow;
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
  el.innerHTML = "<div class='cb-inner'><div class='cb-copy'><p class='cb-eyebrow'>" + L.eyebrow + "</p><p class='cb-body'>" + L.body + " <a href='#'>" + L.policy + "</a></p></div><div class='cb-actions'><button class='cb-btn cb-ghost' data-a='manage'>" + L.manage + "</button><button class='cb-btn cb-ghost' data-a='reject'>" + L.reject + "</button><button class='cb-btn cb-accept' data-a='accept'>" + L.accept + "</button></div></div>";
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
  var rows = C.categories.map(function(cat) {
    var checked = cat.locked ? true : !!state.chosen[cat.id];
    var pill = cat.locked ? " <span class='cb-pill'>" + L.always + "</span>" : "";
    var control = cat.locked ? "<button class='cb-sw' role='switch' aria-checked='true' aria-disabled='true' disabled><span class='cb-knob'></span></button>" : "<button class='cb-sw' role='switch' aria-checked='" + checked + "' data-cat='" + cat.id + "'><span class='cb-knob'></span></button>";
    return "<div class='cb-row'><div class='t'><strong>" + cat.label[state.lang] + pill + "</strong><span>" + cat.desc[state.lang] + "</span></div>" + control + "</div>";
  }).join("");
  overlay.innerHTML = "<div class='cb-panel' role='dialog' aria-modal='true' aria-label='" + L.panelTitle + "'><div class='cb-head'><p class='cb-eyebrow2'>" + L.panelEyebrow + "</p><h2>" + L.panelTitle + "</h2><p class='cb-intro'>" + L.panelIntro + "</p></div><div class='cb-rows'>" + rows + "</div><div class='cb-foot'><button class='cb-btn2 cb-outline' data-a='reject'>" + L.rejectOptional + "</button><div class='cb-foot-right'><button class='cb-btn2 cb-text' data-a='accept'>" + L.accept + "</button><button class='cb-btn2 cb-save' data-a='save'>" + L.save + "</button></div></div></div>";
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
  overlay.querySelector("[data-a='reject']").onclick = function() {
    rejectAll(C);
  };
  overlay.querySelector("[data-a='accept']").onclick = function() {
    acceptAll(C);
  };
  return overlay;
}
function buildChip(C) {
  var el = document.createElement("button");
  el.className = "cb-chip";
  el.innerHTML = "<span class='cb-dot'></span>" + t().chip;
  el.onclick = function() {
    openPanel(C);
  };
  return el;
}
function showBanner(C) {
  ensureRoot(C);
  if (!bannerEl) {
    bannerEl = buildBanner(C);
    root.appendChild(bannerEl);
  }
  bannerEl.style.display = "";
}
function hideBanner() {
  if (bannerEl) bannerEl.style.display = "none";
}
function openPanel(C) {
  ensureRoot(C);
  panelEl = buildPanel(C);
  root.appendChild(panelEl);
}
function hidePanel() {
  if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
  panelEl = null;
}
function showChip(C) {
  ensureRoot(C);
  if (!chipEl) {
    chipEl = buildChip(C);
    root.appendChild(chipEl);
  }
  chipEl.setAttribute("data-on", "1");
}
function acceptAll(C) {
  var chosen = {};
  C.categories.forEach(function(c) {
    chosen[c.id] = true;
  });
  persist(C, "all", chosen);
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
    log("remote", "Config remota cargada (site_id=" + C.siteId + ").");
    done();
  }).catch(function() {
    _remoteLoaded = true;
    log("remote", "No se pudo cargar la config remota; se usa la local.");
    done();
  });
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
  state.lang = C.defaultLanguage || "es";
  var prev = readConsent(C);
  if (prev && prev.version === C.consentVersion) {
    state.chosen = prev.categories || {};
    log("init", "Decision previa encontrada (choice=" + prev.choice + ").");
    if (C.activeDeletion && prev.signals && prev.signals.analytics_storage === "denied") deleteAnalyticsCookies();
    showChip(C);
    activateScripts(C, state.chosen);
    refreshAutoBlock(C, state.chosen);
  } else {
    log("init", prev ? "Version de consentimiento cambio: se vuelve a preguntar." : "Sin decision previa: se muestra el banner.");
    showBanner(C);
  }
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
function reset() {
  var C = merged();
  document.cookie = cookieName(C) + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  location.reload();
}
function setLanguage(l) {
  state.lang = l;
  if (bannerEl) {
    bannerEl.remove();
    bannerEl = null;
    showBanner(merged());
  }
}

// src/react.jsx
function ConsentBanner({ config }) {
  useEffect(function() {
    start(config || {});
  }, []);
  return null;
}
var react_default = ConsentBanner;
export {
  ConsentBanner,
  react_default as default,
  open,
  reset,
  setLanguage
};

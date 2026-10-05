#!/usr/bin/env python3
"""
Backend multi-tenant (Fase 3). Esqueleto desplegable.

Decisiones tomadas por defecto (cambiables):
  - Stack: Python de la libreria estandar (corre con `py backend.py`, sin instalar nada).
  - Base de datos: SQLite (archivo backend.db). Migrable a Postgres al crecer.
  - Auth del dashboard: login propio con contrasena hasheada (pbkdf2) y cookie de sesion.

Que expone:
  Publico (para el banner en cualquier sitio, con CORS):
    GET  /api/config?site_id=...   -> la config de ese sitio (config remota)
    POST /api/consent              -> registra un consentimiento (append-only). Requiere X-Api-Key.
  Dashboard (requiere login):
    /dashboard                     -> panel web
    POST /dash/login | /dash/logout
    GET  /dash/me
    POST /dash/site/create
    GET  /dash/site/get?site_id=...
    POST /dash/site/save
    POST /dash/site/delete
    GET  /dash/site/logs?site_id=...

Ejecutar:  py backend.py     y abrir  http://localhost:8000/dashboard
Al primer arranque crea la base, un usuario demo y un sitio demo, e imprime las credenciales.

NOTA DE PRODUCCION: esto es un esqueleto. Para produccion hay que endurecer
(HTTPS, secretos fuera del codigo, rate limiting, y mover consent_logs a una
base con retencion y copias). El registro es append-only: solo se inserta.
"""
import json, os, re, sqlite3, uuid, hashlib, secrets, datetime, http.cookies, time, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuracion por entorno (local funciona igual sin definir nada).
PORT = int(os.environ.get("PORT", 8000))                 # Railway inyecta PORT
HERE = os.path.dirname(os.path.abspath(__file__))
# La base va al volumen persistente si existe; si no, junto al codigo (local).
DATA_DIR = os.environ.get("DATA_DIR") or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or HERE
DB = os.path.join(DATA_DIR, "backend.db")
# Cookie Secure cuando hay HTTPS delante (Railway lo termina en el borde).
SECURE_COOKIES = os.environ.get("SECURE_COOKIES", "1" if os.environ.get("RAILWAY_ENVIRONMENT") else "0") == "1"

# Config por defecto de un sitio nuevo (el diseno de marca actual).
DEFAULT_CONFIG = {
    "namespace": "fwc_consent",
    "consentVersion": "2025-01",
    "defaultLanguage": "en",
    "activeDeletion": True,
    "manageScripts": False,
    # Paleta "Expediente" (misma que styles/tokens.css del frontend).
    "colors": {"ink": "#16233B", "inkSoft": "#21344F", "accent": "#2F7E6C",
               "accentHover": "#2A7062", "accentSoft": "#DCEEE9", "accentPale": "#8FD3C2",
               "text": "#F5F0E6", "textBright": "#FBF8F1", "heading": "#16233B",
               "body": "#5A6673", "border": "#D3D8DE", "borderStrong": "#8A94A0",
               "switchOff": "#E7EAEE", "pillFg": "#3E6B54", "pillBg": "#E1EBE3",
               "cream": "#F5F0E6", "panelBg": "#FFFFFF"},
    "fonts": {"heading": "'IBM Plex Serif', Georgia, serif",
              "body": "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
              "mono": "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"},
    "webfont": True,
    # Prefijos de cookie que borra activeDeletion al denegar analitica.
    "cookiePatterns": ["_ga", "_gid", "_gat", "__utm", "_gcl"],
    # Reglas de bloqueo automatico por URL. El snippet de instalacion las
    # incrusta inline para que actuen antes de que el parser lance las etiquetas.
    "autoBlock": [],
    "texts": {"es": {"panelEyebrow": "Tu control", "panelTitle": "Gestiona tus cookies",
                     "panelIntro": "Las esenciales no se pueden desactivar. Lo demas lo decides tu.",
                     "rejectOptional": "Rechazar las opcionales", "accept": "Aceptar todas",
                     "save": "Guardar preferencias"}},
    "categories": [
        {"id": "esenciales", "locked": True,
         "label": {"es": "Esenciales", "en": "Essential"},
         "desc": {"es": "Mantienen tu sesion activa y recuerdan tu consentimiento.",
                  "en": "Keep your session active and remember your choice."},
         "signals": ["functionality_storage", "security_storage"]},
        {"id": "analitica", "locked": False,
         "label": {"es": "Analitica anonima", "en": "Anonymous analytics"},
         "desc": {"es": "Metricas agregadas de uso. Sin perfiles publicitarios.",
                  "en": "Aggregated usage metrics. No advertising profiles."},
         "signals": ["analytics_storage"]},
        {"id": "preferencias", "locked": False,
         "label": {"es": "Preferencias", "en": "Preferences"},
         "desc": {"es": "Recuerdan tu idioma y ajustes de interfaz.",
                  "en": "Remember your language and interface settings."},
         "signals": ["personalization_storage"]}
    ]
}

# ---------------------------------------------------------------- base de datos
def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    fresh = not os.path.exists(DB)
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS sites(
      site_id TEXT PRIMARY KEY, name TEXT, domain TEXT, plan TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS api_keys(
      key TEXT PRIMARY KEY, site_id TEXT, kind TEXT, active INTEGER, created_at TEXT);
    CREATE TABLE IF NOT EXISTS site_config(
      site_id TEXT PRIMARY KEY, version INTEGER, json TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS consent_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, consent_id TEXT, site_id TEXT,
      choice TEXT, categories TEXT, version_texto TEXT, language TEXT,
      ts TEXT, ip TEXT, user_agent TEXT);
    -- role:   super | admin | user      (super es el dueno de la instalacion)
    -- status: activo | pendiente        (el alta por registro nace pendiente)
    CREATE TABLE IF NOT EXISTS users(
      username TEXT PRIMARY KEY, pw_hash TEXT, salt TEXT, created_at TEXT,
      role TEXT DEFAULT 'user', status TEXT DEFAULT 'activo');
    CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY, username TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS site_owners(
      username TEXT, site_id TEXT, PRIMARY KEY(username, site_id));
    -- Cookies observadas en el sitio real por el bundle. Una fila por nombre.
    -- status: nueva (sin clasificar) | asignada (ya tiene categoria) | ignorada
    CREATE TABLE IF NOT EXISTS cookies_found(
      site_id TEXT, name TEXT, first_seen TEXT, last_seen TEXT, hits INTEGER,
      sample_domain TEXT, phase TEXT, status TEXT, category TEXT, note TEXT,
      PRIMARY KEY(site_id, name));
    """)
    # Migracion para bases anteriores al rol. ALTER TABLE falla si la columna
    # ya existe, y no hay IF NOT EXISTS para columnas en SQLite.
    cols = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
    if "role" not in cols:
        c.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        # Quien ya existia era el unico que habia: se queda como admin para
        # no dejar la instalacion sin nadie que pueda gestionar usuarios.
        c.execute("UPDATE users SET role='admin'")
    # Migracion al rol super. Va atada a la columna status, que se anade una
    # sola vez: asi la promocion no se repite en cada arranque y un super al
    # que se degrade a proposito se queda degradado.
    if "status" not in cols:
        c.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'activo'")
        c.execute("UPDATE users SET status='activo' WHERE status IS NULL")
        # Los administradores de antes pasan a super: eran los duenos de la
        # instalacion, y si no quedara ninguno nadie podria aprobar altas.
        c.execute("UPDATE users SET role='super' WHERE role='admin'")
    migra_cookies_found(c)
    c.commit()
    if fresh:
        seed(c)
    c.close()

# ---------------------------------------------------------------------------
# Catalogo de cookies conocidas. Sirve para SUGERIR una categoria cuando el
# bundle descubre una cookie nueva; la decision final siempre es del usuario.
# El orden importa: gana la primera coincidencia, asi que lo especifico va
# antes que lo generico ("_gat_" antes que "_ga").
# tipo: esencial | analitica | marketing | funcional
COOKIE_CATALOGO = [
    # --- Google Analytics / Ads / Tag Manager ---
    ("_gat",        "analitica", "Google Analytics: limita la frecuencia de peticiones."),
    ("_gid",        "analitica", "Google Analytics: identifica al visitante durante 24 h."),
    ("_ga",         "analitica", "Google Analytics: identifica al visitante (2 anos)."),
    ("__utm",       "analitica", "Google Analytics clasico (Urchin)."),
    ("_gcl",        "marketing", "Google Ads: atribucion de clics en campanas."),
    ("_gac",        "marketing", "Google Ads: datos de campana."),
    ("IDE",         "marketing", "DoubleClick de Google: publicidad y remarketing."),
    ("test_cookie", "marketing", "DoubleClick: comprueba si el navegador acepta cookies."),
    ("NID",         "marketing", "Google: preferencias y anuncios personalizados."),
    ("1P_JAR",      "marketing", "Google: estadisticas de uso de sus servicios."),
    ("SEARCH_SAMESITE", "esencial", "Google: control tecnico de envio de cookies."),
    # --- Registros de consentimiento (propios o de otro CMP) ---
    # Un registro de consentimiento esta exento: no se puede pedir permiso para
    # guardar el permiso. Pero si viene de OTRO banner instalado a la vez, hay
    # dos sistemas decidiendo y conviene retirar el viejo.
    ("accepted_tracking",   "esencial", "Registro de consentimiento del propio sitio."),
    ("accepted_cookies",    "esencial", "Registro de consentimiento del propio sitio."),
    ("cookie_consent",      "esencial", "Registro de consentimiento del propio sitio."),
    ("cookieconsent_status","esencial", "Cookie Consent (Osano): otro banner instalado."),
    ("CookieConsent",       "esencial", "Cookiebot: otro banner instalado."),
    ("cookielawinfo",       "esencial", "CookieYes / GDPR Cookie Consent: otro banner instalado."),
    ("OptanonConsent",      "esencial", "OneTrust: otro banner instalado."),
    ("OptanonAlertBoxClosed","esencial","OneTrust: otro banner instalado."),
    ("euconsent-v2",        "esencial", "TCF de IAB: registro de consentimiento publicitario."),
    ("_iub_cs",             "esencial", "Iubenda: otro banner instalado."),
    ("borlabs-cookie",      "esencial", "Borlabs (WordPress): otro banner instalado."),
    ("moove_gdpr_popup",    "esencial", "GDPR Cookie Compliance (WordPress): otro banner instalado."),
    ("complianz",           "esencial", "Complianz (WordPress): otro banner instalado."),
    # --- LeadLander / Trackalyzer ---
    ("trackalyzer",  "analitica", "LeadLander: identifica visitantes y sigue su recorrido."),
    ("llvisit",      "analitica", "LeadLander: control de la visita actual."),
    # --- HubSpot ---
    ("hubspotutk",  "marketing", "HubSpot: identifica al visitante entre sesiones."),
    ("__hstc",      "marketing", "HubSpot: seguimiento principal del visitante."),
    ("__hssrc",     "esencial",  "HubSpot: detecta si es una sesion nueva."),
    ("__hssc",      "analitica", "HubSpot: control de sesion para analitica."),
    ("__hs_opt_out","esencial",  "HubSpot: recuerda el rechazo del propio banner de HubSpot."),
    ("__hs_do_not_track", "esencial", "HubSpot: recuerda la peticion de no seguimiento."),
    ("messagesUtk", "marketing", "HubSpot: identifica al usuario del chat."),
    # --- Meta / redes ---
    ("_fbp",        "marketing", "Meta (Facebook) Pixel: publicidad y medicion."),
    ("fr",          "marketing", "Meta: publicidad y remarketing."),
    ("_ttp",        "marketing", "TikTok Pixel: medicion de campanas."),
    ("li_",         "marketing", "LinkedIn: seguimiento e insight tag."),
    ("_pin_",       "marketing", "Pinterest: medicion de conversiones."),
    # --- Analitica de terceros ---
    ("_hj",         "analitica", "Hotjar: mapas de calor y grabacion de sesion."),
    ("_clck",       "analitica", "Microsoft Clarity: identificador de analitica."),
    ("_clsk",       "analitica", "Microsoft Clarity: une las visitas de una sesion."),
    ("MUID",        "marketing", "Microsoft: identificador publicitario."),
    ("_uetsid",     "marketing", "Microsoft Ads UET: seguimiento de conversiones."),
    ("_uetvid",     "marketing", "Microsoft Ads UET: identificador persistente."),
    ("mp_",         "analitica", "Mixpanel: analitica de producto."),
    ("amplitude",   "analitica", "Amplitude: analitica de producto."),
    ("ajs_",        "analitica", "Segment: analitica."),
    ("_pk_",        "analitica", "Matomo: analitica."),
    # --- Video / contenido embebido ---
    ("vuid",        "analitica", "Vimeo: identificador de analitica del reproductor."),
    ("player",      "funcional", "Vimeo: preferencias del reproductor."),
    ("VISITOR_INFO1_LIVE", "marketing", "YouTube: estima el ancho de banda y personaliza."),
    ("YSC",         "marketing", "YouTube: seguimiento de videos vistos."),
    ("PREF",        "funcional", "YouTube/Google: preferencias del reproductor."),
    # --- El propio banner ---
    # Guarda la decision del visitante. Es esencial por definicion y ademas el
    # bundle la protege de su propio borrado: sin ella volveria a preguntar.
    ("fwc_consent",  "esencial", "Este banner: guarda la decision del visitante."),
    ("cookie_consent", "esencial", "Banner de consentimiento: guarda la decision."),
    # --- Infraestructura y sesion (esenciales) ---
    ("PHPSESSID",   "esencial", "PHP: identificador de sesion del servidor."),
    ("JSESSIONID",  "esencial", "Java: identificador de sesion del servidor."),
    ("ASP.NET_SessionId", "esencial", "ASP.NET: identificador de sesion."),
    ("__cf_bm",     "esencial", "Cloudflare: distingue humanos de bots."),
    ("cf_clearance","esencial", "Cloudflare: recuerda que se supero la verificacion."),
    ("__cfduid",    "esencial", "Cloudflare: identificacion de seguridad (obsoleta)."),
    ("csrftoken",   "esencial", "Proteccion contra falsificacion de peticiones."),
    ("XSRF-TOKEN",  "esencial", "Proteccion contra falsificacion de peticiones."),
    ("wordpress_logged_in", "esencial", "WordPress: sesion iniciada."),
    ("wp-settings", "funcional", "WordPress: preferencias del escritorio."),
    ("woocommerce_cart_hash", "esencial", "WooCommerce: contenido del carrito."),
    ("wp_woocommerce_session", "esencial", "WooCommerce: sesion de compra."),
    ("PrestaShop",  "esencial", "PrestaShop: sesion de la tienda."),
    ("laravel_session", "esencial", "Laravel: sesion del servidor."),
    ("modx",        "esencial", "MODX: sesion del gestor de contenidos."),
    ("SERVERID",    "esencial", "Balanceador de carga: mantiene el servidor asignado."),
    ("AWSALB",      "esencial", "AWS: balanceo de carga."),
    ("__stripe",    "esencial", "Stripe: prevencion de fraude en el pago."),
    ("__Secure-",   "esencial", "Cookie de seguridad del navegador."),
    ("__Host-",     "esencial", "Cookie de seguridad del navegador."),
]


def cookie_propia(c, site_id):
    """Nombre de la cookie donde el banner guarda la decision, segun el
    namespace configurado. Se calcula igual que en el bundle (core.js)."""
    fila = c.execute("SELECT json FROM site_config WHERE site_id=?", (site_id,)).fetchone()
    if not fila:
        return ""
    try:
        return (json.loads(fila["json"]).get("namespace") or "") + "_cookie_consent"
    except Exception:
        return ""



# Quien pone cada cookie. Es lo que de verdad importa en un cookie audit: las
# cookies de un dominio ajeno no se pueden leer desde JavaScript (el navegador
# no lo permite), pero la mayoria de lo que se llama "de terceros" son cookies
# del dominio propio escritas por un proveedor externo. Eso si se sabe por el
# nombre, y es lo que hay que declarar.
PROVEEDORES = [
    ("_ga",         "Google Analytics",    "google-analytics.com"),
    ("_gid",        "Google Analytics",    "google-analytics.com"),
    ("_gat",        "Google Analytics",    "google-analytics.com"),
    ("__utm",       "Google Analytics",    "google-analytics.com"),
    ("_gcl",        "Google Ads",          "google.com"),
    ("_gac",        "Google Ads",          "google.com"),
    ("IDE",         "Google Ads",          "doubleclick.net"),
    ("test_cookie", "Google Ads",          "doubleclick.net"),
    ("NID",         "Google",              "google.com"),
    ("1P_JAR",      "Google",              "google.com"),
    ("__hstc",      "HubSpot",             "hubspot.com"),
    ("__hssc",      "HubSpot",             "hubspot.com"),
    ("__hssrc",     "HubSpot",             "hubspot.com"),
    ("hubspotutk",  "HubSpot",             "hubspot.com"),
    ("__hs_",       "HubSpot",             "hubspot.com"),
    ("_fbp",        "Meta (Facebook)",     "facebook.com"),
    ("_fbc",        "Meta (Facebook)",     "facebook.com"),
    ("fr",          "Meta (Facebook)",     "facebook.com"),
    ("_hj",         "Hotjar",              "hotjar.com"),
    ("_clck",       "Microsoft Clarity",   "clarity.ms"),
    ("_clsk",       "Microsoft Clarity",   "clarity.ms"),
    ("MUID",        "Microsoft",           "bing.com"),
    ("_uetsid",     "Microsoft Ads",       "bing.com"),
    ("_uetvid",     "Microsoft Ads",       "bing.com"),
    ("li_",         "LinkedIn",            "linkedin.com"),
    ("bcookie",     "LinkedIn",            "linkedin.com"),
    ("bscookie",    "LinkedIn",            "linkedin.com"),
    ("lidc",        "LinkedIn",            "linkedin.com"),
    ("UserMatchHistory", "LinkedIn",       "linkedin.com"),
    ("_ttp",        "TikTok",              "tiktok.com"),
    ("_tt_",        "TikTok",              "tiktok.com"),
    ("_pin_",       "Pinterest",           "pinterest.com"),
    ("_scid",       "Snapchat",            "snapchat.com"),
    ("personalization_id", "X (Twitter)",  "twitter.com"),
    ("muc_ad",      "X (Twitter)",         "twitter.com"),
    ("vuid",        "Vimeo",               "vimeo.com"),
    ("player",      "Vimeo",               "vimeo.com"),
    ("VISITOR_INFO1_LIVE", "YouTube",      "youtube.com"),
    ("YSC",         "YouTube",             "youtube.com"),
    ("__cf_bm",     "Cloudflare",          "cloudflare.com"),
    ("cf_",         "Cloudflare",          "cloudflare.com"),
    ("__stripe",    "Stripe",              "stripe.com"),
    ("intercom-",   "Intercom",            "intercom.io"),
    ("_mkto_trk",   "Marketo",             "marketo.com"),
    ("__insp",      "Inspectlet",          "inspectlet.com"),
    ("ajs_",        "Segment",             "segment.com"),
    ("amplitude",   "Amplitude",           "amplitude.com"),
    ("mp_",         "Mixpanel",            "mixpanel.com"),
    ("trackalyzer", "LeadLander",          "leadlander.com"),
    ("_mcid",       "Mailchimp",           "mailchimp.com"),
    ("mailchimp",   "Mailchimp",           "mailchimp.com"),
]


def proveedor_de(nombre):
    """(proveedor, dominio) del que pone la cookie, o (None, None) si es propia.

    Se busca el prefijo mas largo que encaje: "_gat" debe ganar a "_ga" y
    "__hstc" a "__hs_", o se atribuiria al proveedor equivocado.
    """
    n = (nombre or "").strip().lower()
    if not n:
        return None, None
    mejor = None
    for pref, prov, dom in PROVEEDORES:
        p = pref.lower()
        if n.startswith(p) and (mejor is None or len(p) > len(mejor[0])):
            mejor = (p, prov, dom)
    return (mejor[1], mejor[2]) if mejor else (None, None)

def clasificar_cookie(nombre):
    """Devuelve (categoria_sugerida, explicacion) o (None, None) si no se reconoce."""
    n = (nombre or "").strip()
    if not n:
        return None, None
    bajo = n.lower()
    for prefijo, tipo, desc in COOKIE_CATALOGO:
        if bajo.startswith(prefijo.lower()):
            return tipo, desc
    return None, None


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 100000).hex()

def seed(c):
    salt = secrets.token_hex(16)
    pw = os.environ.get("ADMIN_PASSWORD", "admin")       # en produccion, definir la variable
    c.execute("INSERT INTO users(username,pw_hash,salt,created_at,role,status)"
              " VALUES(?,?,?,?,?,?)",
              ("admin", hash_pw(pw, salt), salt, now(), "super", "activo"))
    site_id = "site_" + secrets.token_hex(4)
    key = "pk_" + secrets.token_hex(16)
    c.execute("INSERT INTO sites VALUES(?,?,?,?,?)", (site_id, "Sitio demo", "localhost", "pro", now()))
    c.execute("INSERT INTO api_keys VALUES(?,?,?,?,?)", (key, site_id, "public", 1, now()))
    c.execute("INSERT INTO site_config VALUES(?,?,?,?)", (site_id, 1, json.dumps(DEFAULT_CONFIG), now()))
    c.execute("INSERT INTO site_owners VALUES(?,?)", ("admin", site_id))
    c.commit()
    print("\n" + "=" * 60)
    print("BASE CREADA. Credenciales del dashboard:")
    if os.environ.get("ADMIN_PASSWORD"):
        print("  usuario: admin    contrasena: la de ADMIN_PASSWORD")
    else:
        print("  usuario: admin    contrasena: admin   (cambiala)")
    print("Sitio demo:")
    print("  site_id : " + site_id)
    print("  API key : " + key)
    print("=" * 60 + "\n")

# ---------------------------------------------------------------- limites de uso
# Ventana deslizante en memoria, por IP y por cubo. Suficiente para una replica;
# al migrar a varias instancias esto se mueve a Redis o al borde.
# ---------------------------------------------------------------- DETECTOR
# Lee la portada del sitio del cliente y deduce tipografia, color de accion,
# fondo y radios. Reglas simples sobre el HTML y el CSS, sin IA.
#
# Un endpoint que descarga una URL que manda el usuario es un riesgo clasico
# (SSRF): sirve para que alguien use tu servidor como trampolin hacia la red
# interna. De ahi las comprobaciones de abajo.

import socket, ipaddress, urllib.request, urllib.error
from urllib.parse import urljoin

DET_MAX_BYTES = 1_500_000      # 1,5 MB por recurso
DET_TIMEOUT   = 6              # segundos
DET_MAX_CSS   = 4              # hojas enlazadas que se miran

DET_PERMITIR = set(filter(None, (os.environ.get("DETECT_ALLOW_HOSTS") or "").split(",")))

def _ip_publica(host):
    """False si el nombre resuelve a una direccion privada, local o reservada."""
    if host in DET_PERMITIR:   # escotilla solo para pruebas automaticas
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for inf in infos:
        try:
            ip = ipaddress.ip_address(inf[4][0])
        except ValueError:
            return False
        if (ip.is_private or ip.is_loopback or ip.is_link_local or
                ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False
    return True

def det_normaliza(url):
    url = (url or "").strip()
    if not url:
        return None, "Falta la URL."
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return None, "Solo http o https."
    if not p.hostname:
        return None, "URL invalida."
    if not _ip_publica(p.hostname):
        return None, "Ese dominio no es publico."
    return url, None

def det_baja(url):
    """Descarga un recurso con limite de tamano y sin seguir a sitios privados."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "ConsentBanner-Detector/1.0",
        "Accept": "text/html,text/css,*/*",
    })
    with urllib.request.urlopen(req, timeout=DET_TIMEOUT) as r:
        destino = r.geturl()
        if not _ip_publica(urlparse(destino).hostname or ""):
            raise ValueError("redireccion a un destino no publico")
        datos = r.read(DET_MAX_BYTES + 1)
    if len(datos) > DET_MAX_BYTES:
        datos = datos[:DET_MAX_BYTES]
    return datos.decode("utf-8", "ignore")

def _color_valido(c):
    c = c.strip().lower()
    if c in ("transparent", "inherit", "currentcolor", "none", "#fff", "#ffffff",
             "#000", "#000000", "white", "black"):
        return None
    m = re.match(r"^#([0-9a-f]{3}|[0-9a-f]{6})$", c)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        return "#" + h.upper()
    m = re.match(r"^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)", c)
    if m:
        r, g, b = (int(m.group(i)) for i in (1, 2, 3))
        if (r, g, b) in ((255, 255, 255), (0, 0, 0)):
            return None
        return "#%02X%02X%02X" % (r, g, b)
    return None

def _resuelve_var(fam, todo, saltos=3):
    """Devuelve la familia lista para usar, o "" si no sirve.

    Sustituye var(--x) por el valor de --x declarado en cualquier parte del CSS,
    hasta tres saltos para las cadenas tipo --font: var(--font-sans). Si queda
    algun var() sin resolver, se descarta: una familia a medias es peor que
    ninguna, porque el banner acabaria con texto "var(--algo)" en el CSS.
    """
    for _ in range(saltos):
        if "var(" not in fam:
            break
        def _uno(m):
            nom = re.escape(m.group(1))
            d = re.search(r"--" + nom + r"\s*:\s*([^;}]+)", todo, re.I)
            # var(--x, fallback): si no hay declaracion, vale el respaldo.
            return (d.group(1).strip() if d else (m.group(2) or "")).strip()
        fam = re.sub(r"var\(\s*--([A-Za-z0-9_-]+)\s*(?:,([^()]*))?\)", _uno, fam).strip()
    fam = re.sub(r"\s+", " ", fam).strip().strip(",").strip()
    if not fam or "var(" in fam:
        return ""
    return fam


def det_analiza(html, css):
    todo = css + "\n" + html
    out = {}

    # Tipografia: la primera font-family de body o :root, que es la del sitio.
    # Se prueban varias fuentes por orden y se acepta la primera que de una
    # familia utilizable. Antes bastaba que la de body fuera un var() para que
    # no se detectara nada, y eso es justo lo que escribe media web moderna.
    pistas = [
        r"(?:^|[},])\s*(?:body|html|:root)[^{}]*\{[^{}]*font-family\s*:\s*([^;}]+)",
        r"font-family\s*:\s*([^;}]+)",
    ]
    for pista in pistas:
        for m in re.finditer(pista, todo, re.I):
            fam = _resuelve_var(re.sub(r"\s+", " ", m.group(1)).strip().rstrip(";"), todo)
            if fam:
                out["fontFamily"] = fam
                break
        if "fontFamily" in out:
            break

    # Color de accion: el color de fondo mas repetido entre botones y enlaces,
    # descartando blancos y negros, que no dicen nada de la marca.
    cand = {}
    for m in re.finditer(r"(\.?btn[^{}]*|a[^{}]*|button[^{}]*)\{([^{}]*)\}", todo, re.I):
        for c in re.findall(r"background(?:-color)?\s*:\s*([^;}]+)", m.group(2), re.I):
            v = _color_valido(c)
            if v:
                cand[v] = cand.get(v, 0) + 1
    if not cand:
        for c in re.findall(r"background(?:-color)?\s*:\s*([^;}]+)", todo, re.I):
            v = _color_valido(c)
            if v:
                cand[v] = cand.get(v, 0) + 1
    if cand:
        out["accent"] = max(cand.items(), key=lambda kv: kv[1])[0]

    # Fondo de la pagina: claro u oscuro, para elegir la superficie del banner.
    m = re.search(r"(?:^|[},])\s*body[^{}]*\{[^{}]*background(?:-color)?\s*:\s*([^;}]+)", todo, re.I)
    fondo = _color_valido(m.group(1)) if m else None
    if fondo:
        r = int(fondo[1:3], 16); g = int(fondo[3:5], 16); b = int(fondo[5:7], 16)
        out["surface"] = "dark" if (0.2126*r + 0.7152*g + 0.0722*b) < 110 else "light"
    else:
        out["surface"] = "light"

    # Radios: el valor mas repetido manda.
    rad = {}
    for c in re.findall(r"border-radius\s*:\s*([0-9.]+)px", todo, re.I):
        try:
            rad[round(float(c))] = rad.get(round(float(c)), 0) + 1
        except ValueError:
            pass
    if rad:
        px = max(rad.items(), key=lambda kv: kv[1])[0]
        out["radius"] = "rectas" if px <= 1 else ("suaves" if px <= 10 else "redondeadas")
    else:
        out["radius"] = "rectas"
    return out

def det_detectar(url):
    url, err = det_normaliza(url)
    if err:
        return {"error": err}
    try:
        html = det_baja(url)
    except Exception as e:
        return {"error": "No se pudo leer la pagina: " + str(e)[:120]}

    css = ""
    hojas = re.findall(r"<link[^>]+rel=[\"']?stylesheet[\"']?[^>]*>", html, re.I)
    enlaces = []
    for h in hojas:
        m = re.search(r"href=[\"']([^\"']+)[\"']", h, re.I)
        if m:
            enlaces.append(urljoin(url, m.group(1)))
    for e in enlaces[:DET_MAX_CSS]:
        try:
            if _ip_publica(urlparse(e).hostname or ""):
                css += "\n" + det_baja(e)
        except Exception:
            pass
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", html, re.S | re.I):
        css += "\n" + m.group(1)

    r = det_analiza(html, css)
    r["url"] = url
    r["hojas"] = len(enlaces[:DET_MAX_CSS])
    return r

LIMITES = {
    "consent": (60, 60),    # 60 registros por minuto y por IP
    "login":   (20, 300),   # 20 intentos de login por 5 minutos y por IP
    "config":  (120, 60),   # 120 lecturas de config por minuto y por IP
    "cookies": (90, 60),    # 90 envios de inventario por minuto y por IP
    "detect":  (10, 300),   # 10 detecciones por 5 minutos y por IP: descarga webs ajenas
    "registro": (5, 900),   # 5 altas por 15 minutos y por IP: endpoint publico
}
_hits = {}
_hits_lock = threading.Lock()

def rate_ok(bucket, ip):
    if bucket not in LIMITES:       # bucket sin configurar: no se limita, pero no se cae
        return True
    tope, ventana = LIMITES[bucket]
    ahora = time.time()
    clave = (bucket, ip)
    with _hits_lock:
        t = [x for x in _hits.get(clave, []) if ahora - x < ventana]
        if len(_hits) > 5000:            # poda para que el dict no crezca sin fin
            for k in [k for k, v in _hits.items() if not v or ahora - v[-1] > 3600]:
                _hits.pop(k, None)
        if len(t) >= tope:
            _hits[clave] = t
            return False
        t.append(ahora)
        _hits[clave] = t
        return True

def ip_cliente(handler):
    """Detras del proxy de Railway, client_address es siempre la IP del borde:
    sin esto, el limitador contaria a todos los visitantes como uno solo y el
    registro legal guardaria la IP equivocada. X-Forwarded-For trae la cadena
    real, con el visitante primero."""
    xff = handler.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return handler.client_address[0]

def host_de(url):
    """Devuelve el host de un Origin/Referer, sin esquema ni puerto."""
    if not url:
        return ""
    try:
        h = urlparse(url).hostname or ""
    except Exception:
        return ""
    return h.lower()



def migra_cookies_found(c):
    """Anade kind/party/page a bases que vienen de versiones anteriores.
    SQLite no tiene "ADD COLUMN IF NOT EXISTS", asi que se mira antes."""
    cols = {r["name"] for r in c.execute("PRAGMA table_info(cookies_found)")}
    for col, defecto in (("kind", "'cookie'"), ("party", "'first'"), ("page", "''")):
        if col not in cols:
            c.execute("ALTER TABLE cookies_found ADD COLUMN %s TEXT DEFAULT %s" % (col, defecto))
    c.commit()

def normaliza_dominios(txt):
    """Limpia lo que escriba el cliente y devuelve una lista sin duplicados.

    Se aceptan comas, espacios o saltos de linea como separadores, y se quita
    lo que sobra: protocolo, "www.", puerto, ruta, barra final y mayusculas.
    Sin esto, guardar "https://midominio.com/" hacia que la comprobacion de
    origen no encontrara nunca el host y devolviera 403.
    """
    fuera = []
    for trozo in re.split(r"[,\s]+", txt or ""):
        d = trozo.strip().lower()
        if not d:
            continue
        d = re.sub(r"^[a-z][a-z0-9+.-]*://", "", d)   # protocolo
        d = d.split("/")[0]                            # ruta
        d = d.split("?")[0].split("#")[0]
        d = d.split("@")[-1]                           # usuario:clave@
        d = re.sub(r":\d+$", "", d)                    # puerto
        d = d.rstrip(".")
        if d.startswith("www."):
            d = d[4:]
        # Un dominio valido: etiquetas separadas por puntos. Deja pasar
        # "localhost" porque se usa en desarrollo.
        if d != "localhost" and not re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$", d):
            continue
        if d not in fuera:
            fuera.append(d)
    return fuera

def origen_permitido(origin_host, propio_host, dominios):
    """El dominio del sitio se guarda al crearlo; si esta vacio, no se valida.
    Se acepta el dominio exacto, sus subdominios, y el host del propio backend
    (para el sitio demo, que se sirve desde aqui)."""
    if not origin_host:                       # peticion sin Origin: no verificable
        return True
    if origin_host == propio_host:
        return True
    if not dominios:                          # sitio sin dominio configurado
        return True
    for d in [x.strip().lower() for x in dominios.split(",") if x.strip()]:
        if origin_host == d or origin_host.endswith("." + d):
            return True
    return False

# ---------------------------------------------------------------- utilidades
def public_key_for(c, site_id):
    r = c.execute("SELECT key FROM api_keys WHERE site_id=? AND kind='public' AND active=1", (site_id,)).fetchone()
    return r["key"] if r else None

# ---------------------------------------------------------------- HTTP handler
class H(BaseHTTPRequestHandler):
    def _send(self, code, obj=None, ctype="application/json", raw=None, cookie=None,
              headers=None):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        body = raw if raw is not None else json.dumps(obj if obj is not None else {}).encode()
        if isinstance(body, str):
            body = body.encode()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def _user(self):
        ck = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        if "dash" not in ck:
            return None
        c = db()
        r = c.execute("SELECT username FROM sessions WHERE token=?", (ck["dash"].value,)).fetchone()
        c.close()
        return r["username"] if r else None

    def _role(self, user):
        if not user:
            return None
        c = db()
        r = c.execute("SELECT role FROM users WHERE username=?", (user,)).fetchone()
        c.close()
        return (r["role"] if r else None) or "user"

    def _es_super(self, user):
        return self._role(user) == "super"

    def _es_admin(self, user):
        # Un super es tambien administrador: hereda todo lo que puede un admin.
        return self._role(user) in ("admin", "super")

    def _owns(self, user, site_id):
        if self._es_super(user):
            return True          # solo el super llega a todos los sitios
        c = db()
        r = c.execute("SELECT 1 FROM site_owners WHERE username=? AND site_id=?", (user, site_id)).fetchone()
        c.close()
        return bool(r)

    def do_OPTIONS(self):
        self._send(204)

    # ---- GET ----
    def do_GET(self):
        u = urlparse(self.path)
        p, q = u.path, parse_qs(u.query)
        if p in ("/", "/dashboard"):
            return self._file("dashboard.html")
        if p == "/api/config":
            return self.api_config(q)
        if p == "/dash/users":
            return self.dash_users_list()
        if p == "/dash/pending":
            return self.dash_pending_list()
        if p == "/dash/me":
            return self.dash_me()
        if p == "/dash/site/detect":
            return self.dash_detect(q)
        if p == "/dash/site/get":
            return self.dash_site_get(q)
        if p == "/dash/site/logs":
            return self.dash_site_logs(q)
        if p == "/dash/site/cookies":
            return self.dash_site_cookies(q)
        return self._file(p.lstrip("/"))  # servir estaticos (sitio-demo.html, consent-banner.js)

    # ---- POST ----
    def do_POST(self):
        p = urlparse(self.path).path
        if p == "/api/consent":
            return self.api_consent()
        if p == "/api/cookies":
            return self.api_cookies()
        if p == "/dash/login":
            return self.dash_login()
        if p == "/dash/register":
            return self.dash_register()
        if p == "/dash/pending/resolve":
            return self.dash_pending_resolve()
        if p == "/dash/logout":
            return self.dash_logout()
        if p == "/dash/site/create":
            return self.dash_site_create()
        if p == "/dash/site/save":
            return self.dash_site_save()
        if p == "/dash/site/delete":
            return self.dash_site_delete()
        if p == "/dash/users/create":
            return self.dash_user_create()
        if p == "/dash/users/delete":
            return self.dash_user_delete()
        if p == "/dash/users/assign":
            return self.dash_user_assign()
        if p == "/dash/users/password":
            return self.dash_user_password()
        if p == "/dash/password":
            return self.dash_password()
        if p == "/dash/site/domain":
            return self.dash_site_domain()
        if p == "/dash/site/cookies/classify":
            return self.dash_cookies_classify()
        if p == "/dash/site/cookies/apply":
            return self.dash_cookies_apply()
        self._send(404, {"error": "not found"})

    # ---- estaticos ----
    PUBLIC_FILES = {"dashboard.html", "sitio-demo.html", "consent-banner.js"}

    def _file(self, rel):
        rel = rel.split("?")[0]
        if rel not in self.PUBLIC_FILES:
            return self._send(404, {"error": "not found"})
        path = os.path.normpath(os.path.join(HERE, rel))
        if not path.startswith(HERE) or not os.path.isfile(path):
            return self._send(404, {"error": "not found"})
        ext = os.path.splitext(path)[1]
        ctype = {".html": "text/html; charset=utf-8", ".js": "text/javascript",
                 ".css": "text/css", ".json": "application/json"}.get(ext, "application/octet-stream")
        # Sin cabeceras de cache el navegador aplica su heuristica y se queda
        # con la copia vieja: al publicar un dashboard nuevo el cliente seguia
        # viendo el anterior sin enterarse. El HTML no se guarda nunca; los
        # demas se revalidan con ETag, asi que casi siempre solo viaja un 304
        # y no el archivo entero.
        st = os.stat(path)
        etag = '"%x-%x"' % (int(st.st_mtime), st.st_size)
        if ext == ".html":
            cache = "no-store"
        else:
            cache = "no-cache"
            if self.headers.get("If-None-Match") == etag:
                return self._send(304, raw=b"", ctype=ctype,
                                  headers={"ETag": etag, "Cache-Control": cache})
        with open(path, "rb") as f:
            self._send(200, raw=f.read(), ctype=ctype,
                       headers={"ETag": etag, "Cache-Control": cache})

    # ---- API publica ----
    def api_config(self, q):
        if not rate_ok("config", ip_cliente(self)):
            return self._send(429, {"error": "demasiadas peticiones"})
        site_id = (q.get("site_id") or [""])[0]
        c = db()
        r = c.execute("SELECT json FROM site_config WHERE site_id=?", (site_id,)).fetchone()
        if not r:
            c.close(); return self._send(404, {"error": "site not found"})
        cfg = json.loads(r["json"])
        cfg["siteId"] = site_id
        cfg["publicKey"] = public_key_for(c, site_id)
        c.close()
        self._send(200, cfg)

    def api_consent(self):
        if not rate_ok("consent", ip_cliente(self)):
            return self._send(429, {"error": "demasiadas peticiones"})
        data = self._body()
        site_id = data.get("site_id")
        key = self.headers.get("X-Api-Key")
        c = db()
        valid = c.execute("SELECT 1 FROM api_keys WHERE key=? AND site_id=? AND kind='public' AND active=1",
                          (key, site_id)).fetchone()
        if not valid:
            c.close(); return self._send(401, {"error": "invalid site_id or api key"})
        # La API key viaja en el HTML del cliente, asi que es publica por diseno:
        # el dominio del sitio es la segunda barrera contra registros falsificados.
        row = c.execute("SELECT domain FROM sites WHERE site_id=?", (site_id,)).fetchone()
        origen = host_de(self.headers.get("Origin") or self.headers.get("Referer"))
        propio = host_de("http://" + (self.headers.get("Host") or ""))
        if not origen_permitido(origen, propio, row["domain"] if row else ""):
            c.close(); return self._send(403, {"error": "origen no autorizado para este site_id"})
        cid = data.get("consent_id") or str(uuid.uuid4())
        # APPEND-ONLY: solo INSERT, nunca UPDATE/DELETE.
        c.execute("INSERT INTO consent_logs(consent_id,site_id,choice,categories,version_texto,language,ts,ip,user_agent)"
                  " VALUES(?,?,?,?,?,?,?,?,?)",
                  (cid, site_id, data.get("choice"), json.dumps(data.get("categories")),
                   data.get("version"), data.get("language"), now(),
                   ip_cliente(self), self.headers.get("User-Agent", "")))
        c.commit(); c.close()
        self._send(200, {"consent_id": cid, "ts": now()})

    # ---- Dashboard ----
    def dash_login(self):
        if not rate_ok("login", ip_cliente(self)):
            return self._send(429, {"error": "demasiados intentos, espera unos minutos"})
        d = self._body()
        c = db()
        r = c.execute("SELECT pw_hash,salt,status FROM users WHERE username=?", (d.get("username", ""),)).fetchone()
        if not r or hash_pw(d.get("password", ""), r["salt"]) != r["pw_hash"]:
            c.close(); return self._send(401, {"error": "credenciales invalidas"})
        # La contrasena es correcta, pero la cuenta todavia no esta aprobada.
        # Se comprueba DESPUES de la contrasena: si no, cualquiera podria
        # averiguar que cuentas existen probando nombres.
        if (r["status"] or "activo") != "activo":
            c.close(); return self._send(403, {"error": "tu cuenta todavia esta pendiente de aprobacion"})
        token = secrets.token_hex(24)
        c.execute("INSERT INTO sessions VALUES(?,?,?)", (token, d["username"], now()))
        c.commit(); c.close()
        ck = "dash=%s; Path=/; HttpOnly; SameSite=Lax%s" % (token, "; Secure" if SECURE_COOKIES else "")
        self._send(200, {"ok": True}, cookie=ck)

    # ---- Alta de cuenta (publico) -----------------------------------------
    # Cualquiera puede pedir una cuenta de administrador, pero nace PENDIENTE:
    # no puede iniciar sesion hasta que un super la aprueba. Asi el formulario
    # puede estar abierto sin que una alta cree acceso por si sola.
    def dash_register(self):
        if not rate_ok("registro", ip_cliente(self)):
            return self._send(429, {"error": "demasiadas solicitudes, espera un rato"})
        d = self._body()
        nombre = (d.get("username") or "").strip().lower()
        pw = d.get("password") or ""
        if not re.match(r"^[a-z0-9._-]{3,32}$", nombre):
            return self._send(400, {"error": "usuario: de 3 a 32 caracteres, letras, numeros, punto, guion o guion bajo"})
        if len(pw) < 8:
            return self._send(400, {"error": "la contrasena debe tener al menos 8 caracteres"})
        c = db()
        if c.execute("SELECT 1 FROM users WHERE username=?", (nombre,)).fetchone():
            # Mismo mensaje y mismo codigo que el alta buena: desde fuera no se
            # puede distinguir un nombre ocupado de uno libre.
            c.close(); return self._send(200, {"ok": True, "pendiente": True})
        salt = secrets.token_hex(16)
        c.execute("INSERT INTO users(username,pw_hash,salt,created_at,role,status)"
                  " VALUES(?,?,?,?,?,?)",
                  (nombre, hash_pw(pw, salt), salt, now(), "admin", "pendiente"))
        c.commit(); c.close()
        self._send(200, {"ok": True, "pendiente": True})

    def dash_pending_list(self):
        if not self._solo_super():
            return
        c = db()
        filas = [dict(r) for r in c.execute(
            "SELECT username, created_at FROM users WHERE status='pendiente' ORDER BY created_at")]
        c.close()
        self._send(200, {"rows": filas, "total": len(filas)})

    def dash_pending_resolve(self):
        """Aprueba o rechaza una solicitud. Rechazar borra la fila: la persona
        puede volver a pedirla, y no dejamos cuentas muertas ocupando nombre."""
        yo = self._solo_super()
        if not yo:
            return
        d = self._body()
        nombre = (d.get("username") or "").strip().lower()
        accion = d.get("accion")
        if accion not in ("aprobar", "rechazar"):
            return self._send(400, {"error": "accion debe ser aprobar o rechazar"})
        c = db()
        r = c.execute("SELECT status FROM users WHERE username=?", (nombre,)).fetchone()
        if not r or r["status"] != "pendiente":
            c.close(); return self._send(404, {"error": "no hay ninguna solicitud con ese nombre"})
        if accion == "aprobar":
            rol = "super" if d.get("role") == "super" else "admin"
            c.execute("UPDATE users SET status='activo', role=? WHERE username=?", (rol, nombre))
        else:
            c.execute("DELETE FROM users WHERE username=?", (nombre,))
        c.commit(); c.close()
        self._send(200, {"ok": True, "username": nombre, "accion": accion})

    def dash_logout(self):
        ck = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        if "dash" in ck:
            c = db(); c.execute("DELETE FROM sessions WHERE token=?", (ck["dash"].value,)); c.commit(); c.close()
        self._send(200, {"ok": True}, cookie="dash=; Path=/; Max-Age=0")

    def dash_me(self):
        u = self._user()
        if not u:
            return self._send(401, {"error": "no auth"})
        c = db()
        # Solo el super ve el catalogo entero. Un admin ve lo que tenga asignado
        # en site_owners, igual que un usuario normal.
        if self._es_super(u):
            rows = c.execute("SELECT site_id,name,domain,plan FROM sites ORDER BY name").fetchall()
        else:
            rows = c.execute("SELECT s.site_id,s.name,s.domain,s.plan FROM sites s "
                             "JOIN site_owners o ON o.site_id=s.site_id WHERE o.username=?", (u,)).fetchall()
        sites = []
        for r in rows:
            d = dict(r); d["publicKey"] = public_key_for(c, r["site_id"]); sites.append(d)
        c.close()
        self._send(200, {"username": u, "sites": sites, "role": self._role(u)})

    # ---- Gestion de usuarios (solo admin) ---------------------------------
    # El acceso a un sitio se decide en site_owners, que ya se comprueba en
    # cada endpoint. Aqui solo se administra esa tabla; no hay que tocar nada
    # mas para que un usuario deje de ver un sitio.

    def _solo_admin(self):
        """Devuelve el usuario si es admin o super; si no, responde y devuelve None."""
        u = self._user()
        if not u:
            self._send(401, {"error": "no auth"}); return None
        if not self._es_admin(u):
            self._send(403, {"error": "hace falta ser administrador"})
            return None
        return u

    def _solo_super(self):
        """Lo reservado al dueno de la instalacion: gestionar cuentas, borrar
        sitios y escribir CSS a medida. Un admin normal recibe 403."""
        u = self._user()
        if not u:
            self._send(401, {"error": "no auth"}); return None
        if not self._es_super(u):
            self._send(403, {"error": "solo el super administrador puede hacer esto"})
            return None
        return u

    def dash_users_list(self):
        if not self._solo_super():
            return
        c = db()
        users = []
        # Las cuentas pendientes no se listan aqui: viven en la bandeja de
        # solicitudes, y mezclarlas con las activas invita a asignarles sitios
        # a gente que todavia no tiene acceso.
        for r in c.execute("SELECT username, role, created_at FROM users "
                           "WHERE status IS NULL OR status='activo' ORDER BY username").fetchall():
            sids = [x["site_id"] for x in c.execute(
                "SELECT site_id FROM site_owners WHERE username=?", (r["username"],)).fetchall()]
            users.append({"username": r["username"], "role": r["role"] or "user",
                          "created_at": r["created_at"], "sites": sids})
        sitios = [dict(x) for x in c.execute(
            "SELECT site_id, name FROM sites ORDER BY name").fetchall()]
        c.close()
        self._send(200, {"users": users, "sites": sitios})

    def dash_user_create(self):
        if not self._solo_super():
            return
        d = self._body()
        nombre = (d.get("username") or "").strip().lower()
        pw = d.get("password") or ""
        rol = d.get("role") if d.get("role") in ("super", "admin") else "user"
        if not re.match(r"^[a-z0-9._-]{3,32}$", nombre):
            return self._send(400, {"error": "usuario: de 3 a 32 caracteres, letras, numeros, punto, guion o guion bajo"})
        if len(pw) < 8:
            return self._send(400, {"error": "la contrasena debe tener al menos 8 caracteres"})
        c = db()
        if c.execute("SELECT 1 FROM users WHERE username=?", (nombre,)).fetchone():
            c.close(); return self._send(400, {"error": "ese usuario ya existe"})
        salt = secrets.token_hex(16)
        # Una cuenta creada a mano por el super nace activa: no tiene sentido
        # que tenga que aprobar su propia alta.
        c.execute("INSERT INTO users(username,pw_hash,salt,created_at,role,status)"
                  " VALUES(?,?,?,?,?,?)",
                  (nombre, hash_pw(pw, salt), salt, now(), rol, "activo"))
        for sid in (d.get("sites") or []):
            if c.execute("SELECT 1 FROM sites WHERE site_id=?", (sid,)).fetchone():
                c.execute("INSERT OR IGNORE INTO site_owners VALUES(?,?)", (nombre, sid))
        c.commit(); c.close()
        self._send(200, {"ok": True, "username": nombre})

    def dash_user_delete(self):
        yo = self._solo_super()
        if not yo:
            return
        nombre = (self._body().get("username") or "").strip().lower()
        if nombre == yo:
            return self._send(400, {"error": "no puedes borrarte a ti mismo"})
        c = db()
        if not c.execute("SELECT 1 FROM users WHERE username=?", (nombre,)).fetchone():
            c.close(); return self._send(404, {"error": "ese usuario no existe"})
        # Nunca dejar la instalacion sin ningun super: es el unico rol que
        # aprueba altas y gestiona cuentas.
        if self._es_super(nombre):
            n = c.execute("SELECT COUNT(*) n FROM users WHERE role='super'").fetchone()["n"]
            if n <= 1:
                c.close(); return self._send(400, {"error": "es el unico super administrador que queda"})
        c.execute("DELETE FROM users        WHERE username=?", (nombre,))
        c.execute("DELETE FROM site_owners  WHERE username=?", (nombre,))
        c.execute("DELETE FROM sessions     WHERE username=?", (nombre,))   # cerrarle la sesion
        c.commit(); c.close()
        self._send(200, {"ok": True})

    def dash_user_assign(self):
        """Reemplaza la lista completa de sitios de un usuario."""
        yo = self._solo_super()
        if not yo:
            return
        d = self._body()
        nombre = (d.get("username") or "").strip().lower()
        sids = d.get("sites") or []
        c = db()
        if not c.execute("SELECT 1 FROM users WHERE username=?", (nombre,)).fetchone():
            c.close(); return self._send(404, {"error": "ese usuario no existe"})
        c.execute("DELETE FROM site_owners WHERE username=?", (nombre,))
        n = 0
        for sid in sids:
            if c.execute("SELECT 1 FROM sites WHERE site_id=?", (sid,)).fetchone():
                c.execute("INSERT OR IGNORE INTO site_owners VALUES(?,?)", (nombre, sid)); n += 1
        c.commit(); c.close()
        self._send(200, {"ok": True, "sites": n})

    def dash_user_password(self):
        """El admin fija una contrasena nueva sin conocer la anterior."""
        if not self._solo_super():
            return
        d = self._body()
        nombre = (d.get("username") or "").strip().lower()
        pw = d.get("password") or ""
        if len(pw) < 8:
            return self._send(400, {"error": "la contrasena debe tener al menos 8 caracteres"})
        c = db()
        if not c.execute("SELECT 1 FROM users WHERE username=?", (nombre,)).fetchone():
            c.close(); return self._send(404, {"error": "ese usuario no existe"})
        salt = secrets.token_hex(16)
        c.execute("UPDATE users SET pw_hash=?, salt=? WHERE username=?",
                  (hash_pw(pw, salt), salt, nombre))
        c.execute("DELETE FROM sessions WHERE username=?", (nombre,))   # se cierran sus sesiones
        c.commit(); c.close()
        self._send(200, {"ok": True})

    def dash_site_create(self):
        u = self._solo_admin()
        if not u:
            return
        d = self._body()
        name = (d.get("name") or "").strip()
        if not name:
            return self._send(400, {"error": "el nombre del sitio es obligatorio"})
        if len(name) > 80:
            return self._send(400, {"error": "el nombre no puede pasar de 80 caracteres"})
        # Dominios: coma como separador, sin espacios ni entradas vacias.
        dominios = ",".join(normaliza_dominios(d.get("domain")))
        site_id = "site_" + secrets.token_hex(4)
        key = "pk_" + secrets.token_hex(16)
        c = db()
        c.execute("INSERT INTO sites VALUES(?,?,?,?,?)", (site_id, name, dominios, "free", now()))
        c.execute("INSERT INTO api_keys VALUES(?,?,?,?,?)", (key, site_id, "public", 1, now()))
        c.execute("INSERT INTO site_config VALUES(?,?,?,?)", (site_id, 1, json.dumps(DEFAULT_CONFIG), now()))
        c.execute("INSERT INTO site_owners VALUES(?,?)", (u, site_id))
        c.commit(); c.close()
        self._send(200, {"site_id": site_id, "publicKey": key})

    def dash_detect(self, q):
        """Lee la portada del sitio y propone marca. Solo con sesion iniciada."""
        u = self._user()
        if not u:
            return self._send(401, {"error": "no auth"})
        if not rate_ok("detect", ip_cliente(self)):
            return self._send(429, {"error": "demasiadas detecciones, espera un poco"})
        r = det_detectar((q.get("url") or [""])[0])
        return self._send(400 if r.get("error") else 200, r)

    def dash_site_get(self, q):
        u = self._user(); site_id = (q.get("site_id") or [""])[0]
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        c = db()
        r = c.execute("SELECT version,json FROM site_config WHERE site_id=?", (site_id,)).fetchone()
        dom = c.execute("SELECT domain FROM sites WHERE site_id=?", (site_id,)).fetchone()
        key = public_key_for(c, site_id); c.close()
        self._send(200, {"site_id": site_id, "version": r["version"], "domain": (dom["domain"] if dom else ""),
                         "config": json.loads(r["json"]), "publicKey": key})

    def dash_site_save(self):
        u = self._user(); d = self._body(); site_id = d.get("site_id")
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        try:
            cfg = d["config"]
            assert isinstance(cfg, dict)
        except Exception:
            return self._send(400, {"error": "config invalida"})
        c = db()
        row = c.execute("SELECT version, json FROM site_config WHERE site_id=?", (site_id,)).fetchone()
        # El CSS a medida es la via mas facil de romper el banner de un cliente,
        # asi que solo el super lo escribe. A un admin no se le responde con un
        # error: se le conserva el que ya habia, de modo que pueda seguir
        # guardando el resto de la config sin pelearse con el formulario.
        if row and not self._es_super(u):
            try:
                previa = json.loads(row["json"])
            except Exception:
                previa = {}
            if cfg.get("customCss") != previa.get("customCss"):
                if "customCss" in previa:
                    cfg["customCss"] = previa["customCss"]
                else:
                    cfg.pop("customCss", None)
        newv = (row["version"] if row else 0) + 1
        c.execute("UPDATE site_config SET version=?, json=?, updated_at=? WHERE site_id=?",
                  (newv, json.dumps(cfg), now(), site_id))
        c.commit(); c.close()
        self._send(200, {"ok": True, "version": newv})

    def dash_site_delete(self):
        """Borra un sitio y todo lo que cuelga de el: config, claves, registros.
        Irreversible. El bundle instalado en ese dominio dejara de recibir config."""
        u = self._solo_super()
        if not u:
            return
        d = self._body(); site_id = d.get("site_id")
        c = db()
        c.execute("DELETE FROM consent_logs WHERE site_id=?", (site_id,))
        c.execute("DELETE FROM site_config  WHERE site_id=?", (site_id,))
        c.execute("DELETE FROM api_keys     WHERE site_id=?", (site_id,))
        c.execute("DELETE FROM site_owners  WHERE site_id=?", (site_id,))
        c.execute("DELETE FROM sites        WHERE site_id=?", (site_id,))
        c.commit(); c.close()
        self._send(200, {"ok": True, "site_id": site_id})

    def dash_site_domain(self):
        """Dominios autorizados a enviar consentimientos de este sitio.
        Varios, separados por coma. Vacio = no se valida el origen."""
        u = self._user(); d = self._body(); site_id = d.get("site_id")
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        dominios = ",".join(normaliza_dominios(d.get("domain")))
        c = db()
        c.execute("UPDATE sites SET domain=? WHERE site_id=?", (dominios, site_id))
        c.commit(); c.close()
        self._send(200, {"ok": True, "domain": dominios})

    def dash_password(self):
        u = self._user()
        if not u:
            return self._send(401, {"error": "no auth"})
        d = self._body()
        actual, nueva = d.get("actual", ""), d.get("nueva", "")
        if len(nueva) < 8:
            return self._send(400, {"error": "la contrasena nueva necesita 8 caracteres o mas"})
        c = db()
        r = c.execute("SELECT pw_hash,salt FROM users WHERE username=?", (u,)).fetchone()
        if not r or hash_pw(actual, r["salt"]) != r["pw_hash"]:
            c.close(); return self._send(401, {"error": "la contrasena actual no coincide"})
        salt = secrets.token_hex(16)
        c.execute("UPDATE users SET pw_hash=?, salt=? WHERE username=?", (hash_pw(nueva, salt), salt, u))
        # Cerrar las demas sesiones: si alguien tenia una cookie robada, deja de servir.
        ck = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        actual_token = ck["dash"].value if "dash" in ck else ""
        c.execute("DELETE FROM sessions WHERE username=? AND token<>?", (u, actual_token))
        c.commit(); c.close()
        self._send(200, {"ok": True})

    def dash_site_logs(self, q):
        u = self._user(); site_id = (q.get("site_id") or [""])[0]
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        c = db()
        counts = {}
        for r in c.execute("SELECT choice,COUNT(*) n FROM consent_logs WHERE site_id=? GROUP BY choice", (site_id,)):
            counts[r["choice"] or "?"] = r["n"]
        rows = [dict(r) for r in c.execute(
            "SELECT consent_id,choice,categories,language,version_texto,ts,ip FROM consent_logs "
            "WHERE site_id=? ORDER BY id DESC LIMIT 25", (site_id,))]
        total = c.execute("SELECT COUNT(*) n FROM consent_logs WHERE site_id=?", (site_id,)).fetchone()["n"]
        c.close()
        self._send(200, {"counts": counts, "total": total, "rows": rows})

    # ---- Deteccion de cookies -------------------------------------------
    # El bundle manda lo que ve en document.cookie en el sitio real. No es una
    # lista de consentimiento: es inventario, por eso se guarda aparte y solo
    # se acumula (primera vez, ultima vez, cuantas veces).
    def api_cookies(self):
        if not rate_ok("cookies", ip_cliente(self)):
            return self._send(429, {"error": "demasiadas peticiones"})
        data = self._body()
        site_id = data.get("site_id")
        key = self.headers.get("X-Api-Key")
        c = db()
        valid = c.execute("SELECT 1 FROM api_keys WHERE key=? AND site_id=? AND kind='public' AND active=1",
                          (key, site_id)).fetchone()
        if not valid:
            c.close(); return self._send(401, {"error": "invalid site_id or api key"})
        row = c.execute("SELECT domain FROM sites WHERE site_id=?", (site_id,)).fetchone()
        origen = host_de(self.headers.get("Origin") or self.headers.get("Referer"))
        propio = host_de("http://" + (self.headers.get("Host") or ""))
        if not origen_permitido(origen, propio, row["domain"] if row else ""):
            c.close(); return self._send(403, {"error": "origen no autorizado para este site_id"})

        vistas = data.get("cookies") or []
        if not isinstance(vistas, list):
            c.close(); return self._send(400, {"error": "cookies debe ser una lista"})
        # La cookie del propio banner no se inventaria: la ponemos nosotros, es
        # esencial por definicion y no hay nada que decidir sobre ella.
        propia = cookie_propia(c, site_id)
        fase = str(data.get("phase") or "")[:20]
        ts = now()
        nuevas = 0
        for item in vistas[:200]:                      # tope defensivo por peticion
            nombre = (item.get("name") if isinstance(item, dict) else item) or ""
            nombre = str(nombre).strip()[:120]
            if not nombre or (propia and nombre == propia):
                continue
            dominio = ""; kind = "cookie"; party = "first"; page = ""
            if isinstance(item, dict):
                dominio = str(item.get("domain") or "")[:120]
                kind = str(item.get("kind") or "cookie")[:20]
                party = "third" if str(item.get("party") or "") == "third" else "first"
                page = str(item.get("page") or "")[:200]
            if kind not in ("cookie", "localStorage", "sessionStorage", "host"):
                kind = "cookie"
            ya = c.execute("SELECT hits FROM cookies_found WHERE site_id=? AND name=?",
                           (site_id, nombre)).fetchone()
            if ya:
                c.execute("UPDATE cookies_found SET last_seen=?, hits=hits+1 WHERE site_id=? AND name=?",
                          (ts, site_id, nombre))
            else:
                c.execute("INSERT INTO cookies_found(site_id,name,first_seen,last_seen,hits,"
                          "sample_domain,phase,status,category,note,kind,party,page) "
                          "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          (site_id, nombre, ts, ts, 1, dominio, fase, "nueva", "", "",
                           kind, party, page))
                nuevas += 1
        c.commit(); c.close()
        self._send(200, {"ok": True, "nuevas": nuevas})

    def dash_site_cookies(self, q):
        u = self._user(); site_id = (q.get("site_id") or [""])[0]
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        c = db()
        # El nombre de la cookie propia depende del namespace del sitio, asi que
        # se calcula igual que lo hace el bundle en vez de adivinarlo por prefijo.
        propia = cookie_propia(c, site_id)
        filas = []
        for r in c.execute("SELECT name,first_seen,last_seen,hits,sample_domain,phase,status,"
                           "category,note,kind,party,page FROM cookies_found WHERE site_id=? ORDER BY "
                           "CASE status WHEN 'nueva' THEN 0 ELSE 1 END, name", (site_id,)):
            d = dict(r)
            if propia and d["name"] == propia:
                continue                      # es nuestra: ni se lista ni se pregunta
            sug, expl = clasificar_cookie(d["name"])
            d["sugerida"] = sug or ""
            d["explicacion"] = expl or ""
            # Quien la pone. Si hay proveedor conocido, es de un tercero aunque
            # la cookie viva en el dominio del cliente.
            prov, pdom = proveedor_de(d["name"])
            d["provider"] = prov or ""
            d["provider_domain"] = pdom or ""
            if prov and d.get("kind", "cookie") != "host":
                d["party"] = "third"
            filas.append(d)
        c.close()
        pend = len([f for f in filas if f["status"] == "nueva"])
        self._send(200, {"rows": filas, "total": len(filas), "pendientes": pend})

    def dash_cookies_classify(self):
        u = self._user(); d = self._body(); site_id = d.get("site_id")
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        cambios = d.get("items") or []
        if not isinstance(cambios, list):
            return self._send(400, {"error": "items debe ser una lista"})
        c = db()
        for it in cambios:
            if not isinstance(it, dict):
                continue
            nombre = str(it.get("name") or "").strip()
            if not nombre:
                continue
            categoria = str(it.get("category") or "")[:60]
            estado = str(it.get("status") or "")[:20]
            if estado not in ("nueva", "asignada", "ignorada"):
                estado = "asignada" if categoria else "nueva"
            c.execute("UPDATE cookies_found SET category=?, status=? WHERE site_id=? AND name=?",
                      (categoria, estado, site_id, nombre))
        c.commit(); c.close()
        self._send(200, {"ok": True, "actualizadas": len(cambios)})

    # Vuelca las cookies ya clasificadas a cookiePatterns de la config, creando
    # una version nueva. Las esenciales no se anaden: no se deben borrar nunca.
    def dash_cookies_apply(self):
        u = self._user(); d = self._body(); site_id = d.get("site_id")
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        c = db()
        fila = c.execute("SELECT version,json FROM site_config WHERE site_id=?", (site_id,)).fetchone()
        if not fila:
            c.close(); return self._send(404, {"error": "sitio sin config"})
        cfg = json.loads(fila["json"])
        ids_validos = set(x.get("id") for x in (cfg.get("categories") or []) if isinstance(x, dict))

        # Normalizamos la lista a objetos para poder completarla. El formato
        # antiguo era una cadena suelta ("_ga"), sin categoria, y esos patrones
        # solo se borraban si se denegaba la analitica.
        patrones = []
        for p in (cfg.get("cookiePatterns") or []):
            if isinstance(p, dict):
                patrones.append(dict(p))
            else:
                patrones.append({"match": str(p)})

        anadidas, completadas, cubiertas = [], [], []
        for r in c.execute("SELECT name,category FROM cookies_found WHERE site_id=? AND status='asignada'",
                           (site_id,)):
            nombre, categoria = r["name"], r["category"]
            # Sin categoria, marcada como esencial, o categoria que ya no existe: no se toca.
            if not categoria or categoria == "esencial" or categoria not in ids_validos:
                continue

            exacto = next((p for p in patrones if p.get("match") == nombre), None)
            if exacto is not None:
                # Existe pero le falta la categoria: la clasificacion la completa.
                # Si ya tiene una puesta a mano, se respeta.
                if not exacto.get("category"):
                    exacto["category"] = categoria
                    completadas.append(nombre)
                continue

            # Un patron mas corto que ya cubre este nombre ("__hs" cubre "__hstc").
            # Anadir el nombre completo no aportaria nada y alargaria la lista.
            prefijo = next((p for p in patrones
                            if p.get("match") and nombre.startswith(p["match"])), None)
            if prefijo is not None:
                if not prefijo.get("category"):
                    prefijo["category"] = categoria
                    completadas.append(prefijo["match"])
                cubiertas.append(nombre)
                continue

            patrones.append({"match": nombre, "category": categoria})
            anadidas.append(nombre)

        cfg["cookiePatterns"] = patrones
        ver = fila["version"] + 1
        c.execute("UPDATE site_config SET version=?, json=?, updated_at=? WHERE site_id=?",
                  (ver, json.dumps(cfg), now(), site_id))
        c.commit(); c.close()
        self._send(200, {"ok": True, "version": ver, "anadidas": anadidas,
                         "completadas": completadas, "cubiertas": cubiertas})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    init_db()
    print("Base de datos: %s" % DB)
    print("Backend Fase 3 en http://localhost:%d" % PORT)
    print("Dashboard: http://localhost:%d/dashboard" % PORT)
    print("Sitio demo: http://localhost:%d/sitio-demo.html" % PORT)
    print("Ctrl+C para parar.\n")
    ThreadingHTTPServer(("", PORT), H).serve_forever()

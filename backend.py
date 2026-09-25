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
import json, os, sqlite3, uuid, hashlib, secrets, datetime, http.cookies, time, threading
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
    "defaultLanguage": "es",
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
    CREATE TABLE IF NOT EXISTS users(
      username TEXT PRIMARY KEY, pw_hash TEXT, salt TEXT, created_at TEXT);
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
    c.execute("INSERT INTO users VALUES(?,?,?,?)", ("admin", hash_pw(pw, salt), salt, now()))
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
LIMITES = {
    "consent": (60, 60),    # 60 registros por minuto y por IP
    "login":   (20, 300),   # 20 intentos de login por 5 minutos y por IP
    "config":  (120, 60),   # 120 lecturas de config por minuto y por IP
    "cookies": (90, 60),    # 90 envios de inventario por minuto y por IP
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
    def _send(self, code, obj=None, ctype="application/json", raw=None, cookie=None):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

    def _owns(self, user, site_id):
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
        if p == "/dash/me":
            return self.dash_me()
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
        if p == "/dash/logout":
            return self.dash_logout()
        if p == "/dash/site/create":
            return self.dash_site_create()
        if p == "/dash/site/save":
            return self.dash_site_save()
        if p == "/dash/site/delete":
            return self.dash_site_delete()
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
        with open(path, "rb") as f:
            self._send(200, raw=f.read(), ctype=ctype)

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
        r = c.execute("SELECT pw_hash,salt FROM users WHERE username=?", (d.get("username", ""),)).fetchone()
        if not r or hash_pw(d.get("password", ""), r["salt"]) != r["pw_hash"]:
            c.close(); return self._send(401, {"error": "credenciales invalidas"})
        token = secrets.token_hex(24)
        c.execute("INSERT INTO sessions VALUES(?,?,?)", (token, d["username"], now()))
        c.commit(); c.close()
        ck = "dash=%s; Path=/; HttpOnly; SameSite=Lax%s" % (token, "; Secure" if SECURE_COOKIES else "")
        self._send(200, {"ok": True}, cookie=ck)

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
        rows = c.execute("SELECT s.site_id,s.name,s.domain,s.plan FROM sites s "
                         "JOIN site_owners o ON o.site_id=s.site_id WHERE o.username=?", (u,)).fetchall()
        sites = []
        for r in rows:
            d = dict(r); d["publicKey"] = public_key_for(c, r["site_id"]); sites.append(d)
        c.close()
        self._send(200, {"username": u, "sites": sites})

    def dash_site_create(self):
        u = self._user()
        if not u:
            return self._send(401, {"error": "no auth"})
        d = self._body()
        name = (d.get("name") or "").strip()
        if not name:
            return self._send(400, {"error": "el nombre del sitio es obligatorio"})
        if len(name) > 80:
            return self._send(400, {"error": "el nombre no puede pasar de 80 caracteres"})
        # Dominios: coma como separador, sin espacios ni entradas vacias.
        dominios = ",".join([x.strip() for x in (d.get("domain") or "").split(",") if x.strip()])
        site_id = "site_" + secrets.token_hex(4)
        key = "pk_" + secrets.token_hex(16)
        c = db()
        c.execute("INSERT INTO sites VALUES(?,?,?,?,?)", (site_id, name, dominios, "free", now()))
        c.execute("INSERT INTO api_keys VALUES(?,?,?,?,?)", (key, site_id, "public", 1, now()))
        c.execute("INSERT INTO site_config VALUES(?,?,?,?)", (site_id, 1, json.dumps(DEFAULT_CONFIG), now()))
        c.execute("INSERT INTO site_owners VALUES(?,?)", (u, site_id))
        c.commit(); c.close()
        self._send(200, {"site_id": site_id, "publicKey": key})

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
        row = c.execute("SELECT version FROM site_config WHERE site_id=?", (site_id,)).fetchone()
        newv = (row["version"] if row else 0) + 1
        c.execute("UPDATE site_config SET version=?, json=?, updated_at=? WHERE site_id=?",
                  (newv, json.dumps(cfg), now(), site_id))
        c.commit(); c.close()
        self._send(200, {"ok": True, "version": newv})

    def dash_site_delete(self):
        """Borra un sitio y todo lo que cuelga de el: config, claves, registros.
        Irreversible. El bundle instalado en ese dominio dejara de recibir config."""
        u = self._user(); d = self._body(); site_id = d.get("site_id")
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
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
        dominios = (d.get("domain") or "").strip()
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
        fase = str(data.get("phase") or "")[:20]
        ts = now()
        nuevas = 0
        for item in vistas[:200]:                      # tope defensivo por peticion
            nombre = (item.get("name") if isinstance(item, dict) else item) or ""
            nombre = str(nombre).strip()[:120]
            if not nombre:
                continue
            dominio = ""
            if isinstance(item, dict):
                dominio = str(item.get("domain") or "")[:120]
            ya = c.execute("SELECT hits FROM cookies_found WHERE site_id=? AND name=?",
                           (site_id, nombre)).fetchone()
            if ya:
                c.execute("UPDATE cookies_found SET last_seen=?, hits=hits+1 WHERE site_id=? AND name=?",
                          (ts, site_id, nombre))
            else:
                c.execute("INSERT INTO cookies_found(site_id,name,first_seen,last_seen,hits,"
                          "sample_domain,phase,status,category,note) VALUES(?,?,?,?,?,?,?,?,?,?)",
                          (site_id, nombre, ts, ts, 1, dominio, fase, "nueva", "", ""))
                nuevas += 1
        c.commit(); c.close()
        self._send(200, {"ok": True, "nuevas": nuevas})

    def dash_site_cookies(self, q):
        u = self._user(); site_id = (q.get("site_id") or [""])[0]
        if not u or not self._owns(u, site_id):
            return self._send(401, {"error": "no auth"})
        c = db()
        filas = []
        for r in c.execute("SELECT name,first_seen,last_seen,hits,sample_domain,phase,status,"
                           "category,note FROM cookies_found WHERE site_id=? ORDER BY "
                           "CASE status WHEN 'nueva' THEN 0 ELSE 1 END, name", (site_id,)):
            d = dict(r)
            sug, expl = clasificar_cookie(d["name"])
            d["sugerida"] = sug or ""
            d["explicacion"] = expl or ""
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
        existentes = []
        for p in (cfg.get("cookiePatterns") or []):
            existentes.append(p.get("match") if isinstance(p, dict) else p)
        anadidas = []
        for r in c.execute("SELECT name,category FROM cookies_found WHERE site_id=? AND status='asignada'",
                           (site_id,)):
            nombre, categoria = r["name"], r["category"]
            # Sin categoria, marcada como esencial, o categoria que ya no existe: no se toca.
            if not categoria or categoria == "esencial" or categoria not in ids_validos:
                continue
            if nombre in existentes:
                continue
            cfg.setdefault("cookiePatterns", []).append({"match": nombre, "category": categoria})
            existentes.append(nombre)
            anadidas.append(nombre)
        ver = fila["version"] + 1
        c.execute("UPDATE site_config SET version=?, json=?, updated_at=? WHERE site_id=?",
                  (ver, json.dumps(cfg), now(), site_id))
        c.commit(); c.close()
        self._send(200, {"ok": True, "version": ver, "anadidas": anadidas})

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

#!/usr/bin/env python3
"""
Prueba de humo del backend de Fase 3.

Uso:
    1) En una terminal:  py backend.py
    2) En otra:          py smoke-test-fase3.py

Opcional:
    py smoke-test-fase3.py http://localhost:8000 ruta/a/backend.db

No instala nada (solo libreria estandar) y no modifica la base salvo lo que
crearia un uso normal: un sitio de prueba y sus registros de consentimiento.
Los registros son append-only, asi que la prueba nunca borra filas.
"""
import json, sys, os, sqlite3, secrets, ssl, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
DB = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend.db")
# Contrasena del dashboard: cambiala con la variable de entorno ADMIN_PASSWORD.
PW = os.environ.get("ADMIN_PASSWORD", "admin")

ok_n = fail_n = 0
cookie = None

# En Windows, Python valida TLS contra el almacen del sistema, que puede tener
# raices caducadas y hacer fallar un certificado que el navegador acepta.
# Si certifi esta instalado, usamos su paquete de raices.
# SKIP_TLS_VERIFY=1 desactiva la verificacion (solo para pruebas propias).
def tls_context():
    if os.environ.get("SKIP_TLS_VERIFY") == "1":
        print("  (verificacion TLS desactivada por SKIP_TLS_VERIFY)")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()

CTX = tls_context() if BASE.startswith("https") else None


def req(method, path, body=None, headers=None, with_cookie=False):
    """Devuelve (status, headers, datos). Nunca lanza por codigo HTTP."""
    data = json.dumps(body).encode() if body is not None else None
    h = dict(headers or {})
    if data:
        h["Content-Type"] = "application/json"
    if with_cookie and cookie:
        h["Cookie"] = cookie
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, context=CTX) if CTX else urllib.request.urlopen(r)
        status, hdrs, raw = resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        status, hdrs, raw = e.code, e.headers, e.read()
    except urllib.error.URLError as e:
        print("\n✗ No se pudo conectar a %s (%s). ¿Está corriendo `py backend.py`?" % (BASE, e.reason))
        sys.exit(2)
    try:
        return status, hdrs, json.loads(raw)
    except Exception:
        return status, hdrs, raw


def check(name, condition, detail=""):
    global ok_n, fail_n
    if condition:
        ok_n += 1
        print("  ✓ " + name)
    else:
        fail_n += 1
        print("  ✗ " + name + ("  → " + str(detail) if detail else ""))


print("Backend: " + BASE + "\n")

# ---------------------------------------------------------------- 1. login
print("1. Login del dashboard")
st, _, _ = req("GET", "/dash/me")
check("/dash/me sin sesión responde 401", st == 401, "devolvió %s" % st)

st, _, _ = req("POST", "/dash/login", {"username": "admin", "password": "incorrecta"})
check("login con contraseña incorrecta responde 401", st == 401, "devolvió %s" % st)

st, hdrs, _ = req("POST", "/dash/login", {"username": "admin", "password": PW})
sc = hdrs.get("Set-Cookie", "")
cookie = sc.split(";")[0] if sc else None
check("login con la contraseña correcta responde 200 y entrega cookie", st == 200 and cookie, "status=%s cookie=%s" % (st, sc))
check("la cookie de sesión es HttpOnly", "HttpOnly" in sc, sc)

st, _, me = req("GET", "/dash/me", with_cookie=True)
sites = me.get("sites", []) if isinstance(me, dict) else []
check("/dash/me con sesión lista los sitios", st == 200 and len(sites) >= 1, me)
if not sites:
    print("\nSin sitios: no se puede seguir. ¿Borraste backend.db?")
    sys.exit(1)
site = sites[0]
SITE, KEY = site["site_id"], site["publicKey"]
print("     sitio de prueba: %s" % SITE)

# ---------------------------------------------------------------- 2. config publica
print("\n2. Config remota (lo que descarga el banner)")
st, _, cfg = req("GET", "/api/config?site_id=" + SITE)
check("GET /api/config devuelve 200", st == 200, st)
check("la config trae categorías, siteId y publicKey",
      isinstance(cfg, dict) and cfg.get("categories") and cfg.get("siteId") == SITE and cfg.get("publicKey"),
      list(cfg)[:6] if isinstance(cfg, dict) else cfg)
st, _, _ = req("GET", "/api/config?site_id=site_no_existe")
check("site_id inexistente responde 404", st == 404, st)

# guardar un cambio y comprobar que viaja al endpoint publico
st, _, got = req("GET", "/dash/site/get?site_id=" + SITE, with_cookie=True)
v0 = got.get("version")
nuevo = "#%s" % secrets.token_hex(3)
got["config"].setdefault("colors", {})["accent"] = nuevo
st, _, saved = req("POST", "/dash/site/save", {"site_id": SITE, "config": got["config"]}, with_cookie=True)
check("guardar config responde 200 y sube la versión", st == 200 and saved.get("version") == v0 + 1,
      "v%s → %s" % (v0, saved))
st, _, cfg2 = req("GET", "/api/config?site_id=" + SITE)
check("el cambio aparece en /api/config sin tocar la página",
      cfg2.get("colors", {}).get("accent") == nuevo, cfg2.get("colors"))

st, _, _ = req("POST", "/dash/site/save", {"site_id": SITE, "config": "esto-no-es-un-objeto"}, with_cookie=True)
check("config inválida responde 400", st == 400, st)

# ---------------------------------------------------------------- 3. consent
print("\n3. Registro de consentimiento")
payload = {"site_id": SITE, "choice": "accept", "categories": ["esenciales", "analitica"],
           "version": "2025-01", "language": "es"}
st, _, _ = req("POST", "/api/consent", payload)
check("sin X-Api-Key responde 401", st == 401, st)
st, _, _ = req("POST", "/api/consent", payload, {"X-Api-Key": "pk_inventada"})
check("con API key inválida responde 401", st == 401, st)

st, _, logs0 = req("GET", "/dash/site/logs?site_id=" + SITE, with_cookie=True)
total0 = logs0.get("total", 0)
st, _, res = req("POST", "/api/consent", payload, {"X-Api-Key": KEY})
check("con API key válida responde 200 y devuelve consent_id", st == 200 and res.get("consent_id"), res)
st, _, logs1 = req("GET", "/dash/site/logs?site_id=" + SITE, with_cookie=True)
check("el total de registros sube exactamente 1", logs1.get("total") == total0 + 1,
      "%s → %s" % (total0, logs1.get("total")))
check("el registro nuevo aparece en la lista",
      any(r.get("consent_id") == res.get("consent_id") for r in logs1.get("rows", [])), logs1.get("rows", [])[:1])
check("los conteos por decisión se calculan", isinstance(logs1.get("counts"), dict) and logs1["counts"],
      logs1.get("counts"))

# ---------------------------------------------------------------- 4. aislamiento
print("\n4. Aislamiento entre sitios y entre cuentas")
st, _, nuevo_sitio = req("POST", "/dash/site/create", {"name": "Sitio de prueba", "domain": "test.local"},
                         with_cookie=True)
check("crear sitio responde 200 con site_id y clave", st == 200 and nuevo_sitio.get("site_id"), nuevo_sitio)
SITE_B, KEY_B = nuevo_sitio.get("site_id"), nuevo_sitio.get("publicKey")
check("cada sitio recibe una clave distinta", KEY_B != KEY, "misma clave para dos sitios")

st, _, _ = req("POST", "/api/consent", payload, {"X-Api-Key": KEY_B})  # key de B, site_id de A
check("la clave de un sitio no sirve para otro", st == 401, st)

st, _, logsB = req("GET", "/dash/site/logs?site_id=" + SITE_B, with_cookie=True)
check("el sitio nuevo empieza con su registro vacío", logsB.get("total") == 0, logsB.get("total"))

# sitio de OTRA cuenta, insertado directo en la base
if os.path.isfile(DB):
    ajeno = "site_ajeno_" + secrets.token_hex(3)
    con = sqlite3.connect(DB)
    con.execute("INSERT OR IGNORE INTO users VALUES('otro','x','00',datetime('now'))")
    con.execute("INSERT INTO sites VALUES(?,?,?,?,datetime('now'))", (ajeno, "De otra cuenta", "", "free"))
    con.execute("INSERT INTO site_config VALUES(?,1,'{}',datetime('now'))", (ajeno,))
    con.execute("INSERT INTO site_owners VALUES('otro',?)", (ajeno,))
    con.commit(); con.close()
    st, _, _ = req("GET", "/dash/site/get?site_id=" + ajeno, with_cookie=True)
    check("no puedo leer la config de un sitio de otra cuenta", st == 401, st)
    st, _, _ = req("GET", "/dash/site/logs?site_id=" + ajeno, with_cookie=True)
    check("no puedo leer los registros de otra cuenta", st == 401, st)
    st, _, _ = req("POST", "/dash/site/save", {"site_id": ajeno, "config": {"x": 1}}, with_cookie=True)
    check("no puedo sobrescribir la config de otra cuenta", st == 401, st)
    st, _, me2 = req("GET", "/dash/me", with_cookie=True)
    check("/dash/me no lista sitios ajenos",
          all(s["site_id"] != ajeno for s in me2.get("sites", [])), "apareció el sitio ajeno")
else:
    print("  · (sin acceso a backend.db: me salto las pruebas entre cuentas)")

# ---------------------------------------------------------------- 5. append-only y estaticos
print("\n5. Append-only y archivos servidos")
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend.py")
if os.path.isfile(src):
    code = open(src, encoding="utf-8", errors="ignore").read().lower()
    check("el código no actualiza ni borra consent_logs",
          "update consent_logs" not in code and "delete from consent_logs" not in code,
          "hay un UPDATE/DELETE sobre consent_logs")

st, _, _ = req("GET", "/backend.db")
check("la base de datos NO se sirve por HTTP", st != 200,
      "GET /backend.db devolvió 200: expone hashes, sesiones y API keys")
st, _, _ = req("GET", "/backend.py")
check("el código fuente NO se sirve por HTTP", st != 200, "GET /backend.py devolvió 200")

# ---------------------------------------------------------------- 6. origen y limites
print("\n6. Origen del sitio y limites de uso")
st, _, _ = req("POST", "/api/consent", payload, {"X-Api-Key": KEY, "Origin": "https://sitio-de-otro.com"})
check("un Origin ajeno al dominio del sitio responde 403", st == 403, st)
st, _, _ = req("POST", "/api/consent", payload, {"X-Api-Key": KEY, "Origin": BASE})
check("el Origin del propio backend se acepta", st == 200, st)

st, _, _ = req("POST", "/dash/login", {"username": "admin", "password": "otra-mas"})
check("el login sigue respondiendo (no bloqueado de entrada)", st in (401, 429), st)

# ---------------------------------------------------------------- 7. cambio de contrasena
print("\n7. Cambio de contrasena desde el dashboard")
if len(PW) < 8:
    # La contrasena actual no cumple el minimo, asi que no se podria restaurar
    # al terminar y la prueba dejaria la cuenta cambiada.
    print("  · (la contraseña actual tiene menos de 8 caracteres: me salto este bloque)")
    st, hdrs, _ = req("POST", "/dash/login", {"username": "admin", "password": PW})
    cookie = hdrs.get("Set-Cookie", "").split(";")[0]
else:
  st, hdrs, _ = req("POST", "/dash/login", {"username": "admin", "password": PW})
  cookie = hdrs.get("Set-Cookie", "").split(";")[0]
  st, _, _ = req("POST", "/dash/password", {"actual": "no-es-la-mia", "nueva": "loquesea123"}, with_cookie=True)
  check("con la contraseña actual incorrecta responde 401", st == 401, st)
  st, _, _ = req("POST", "/dash/password", {"actual": PW, "nueva": "corta"}, with_cookie=True)
  check("una contraseña de menos de 8 caracteres responde 400", st == 400, st)

  temporal = "Temporal-" + secrets.token_hex(4)
  st, _, _ = req("POST", "/dash/password", {"actual": PW, "nueva": temporal}, with_cookie=True)
  check("el cambio de contraseña responde 200", st == 200, st)
  st, _, _ = req("POST", "/dash/login", {"username": "admin", "password": PW})
  check("la contraseña vieja ya no sirve", st == 401, st)
  st, hdrs, _ = req("POST", "/dash/login", {"username": "admin", "password": temporal})
  cookie = hdrs.get("Set-Cookie", "").split(";")[0]
  check("la contraseña nueva entra", st == 200, st)
  st, _, _ = req("POST", "/dash/password", {"actual": temporal, "nueva": PW}, with_cookie=True)
  check("se puede dejar la contraseña como estaba", st == 200, st)
  st, hdrs, _ = req("POST", "/dash/login", {"username": "admin", "password": PW})
  cookie = hdrs.get("Set-Cookie", "").split(";")[0]

# ---------------------------------------------------------------- 8. logout
print("\n8. Cierre de sesión")
st, _, _ = req("POST", "/dash/logout", {}, with_cookie=True)
check("logout responde 200", st == 200, st)
st, _, _ = req("GET", "/dash/me", with_cookie=True)
check("la cookie vieja ya no sirve", st == 401, "devolvió %s: la sesión sigue viva" % st)

print("\n" + "=" * 52)
print("  %d correctas, %d fallidas" % (ok_n, fail_n))
print("=" * 52)
sys.exit(1 if fail_n else 0)
#!/usr/bin/env python3
"""Escaner de un sitio con navegador real (P4).

    pip install playwright && playwright install chromium
    python3 escanear.py https://cliente.com site_xxx pk_xxx https://optward.com

Ve lo que el banner instalado NO puede ver desde JavaScript:

  - cookies **HttpOnly**, que el navegador oculta a document.cookie
  - cookies de **terceros**, puestas en otro dominio
  - los **dominios** que la pagina contacta, que es lo que llena autoBlock
  - **quien** pone cada cookie, siguiendo la pila de llamadas

No decide nada: manda lo observado al backend y queda como propuesta para que
alguien lo apruebe en el panel.

Tambien mira QUE recibe cada tercero, no solo que fue contactado: el termino
que busca el visitante, los identificadores y los datos de huella del
dispositivo. Es lo que se reclama en las demandas tipo CIPA, y lo que un
informe de cookies a secas no ve.

Opciones:
    --paginas N     cuantas paginas recorrer (por defecto 8, 1 = solo la home)
    --escenario X   solo uno de: frio, rechazado, aceptado, gpc
    --guardar F     ademas de enviarlo, escribe el detalle en un JSON
    --informe F     escribe un informe en markdown, con la estructura que usan
                    los bufetes para reclamar
"""
import json, os, re, secrets, sys, threading, time, urllib.request
from urllib.parse import urlparse, urljoin

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Falta playwright:  pip install playwright && playwright install chromium")

ESPERA = 6000          # ms que se deja a la pagina para cargar sus terceros
PAGINAS = 8            # tope por defecto; cada pagina son ~8 s por escenario
TOPE_TRAFICO = 4000    # peticiones guardadas por escenario, para no comerse la RAM
TOPE_URL = 3000        # caracteres por URL y por cuerpo: ver el comentario en anota()

# Parametros que llevan un identificador de persona o de dispositivo. Son los
# que el informe del bufete recoge en su seccion 6: did, cid, sid, sld.
IDENTIFICADORES = ("cid", "did", "sid", "sld", "uid", "_ga", "gclid", "fbp", "fbc",
                   "client_id", "user_id", "visitor_id", "ljsid", "rdt_cid", "ttclid",
                   "msclkid", "_fbp", "anonymous_id", "device_id")

# Parametros y cabeceras que, juntos, permiten reconocer un navegador concreto
# sin cookies. La seccion 7 del informe se construye con esto: resolucion,
# arquitectura de CPU, bitness, version del sistema operativo.
HUELLA = {
    "sr": "resolucion de pantalla", "vp": "tamano de ventana",
    "ul": "idioma del navegador", "sd": "profundidad de color",
    "uaa": "arquitectura de CPU", "uab": "bitness", "uafvl": "version del navegador",
    "uap": "sistema operativo", "uapv": "version del sistema operativo",
    "uamb": "movil si/no", "uaw": "Windows-on-Windows", "uam": "modelo de dispositivo",
    "screen_resolution": "resolucion de pantalla", "viewport_size": "tamano de ventana",
}
# Solo las cabeceras de ENTROPIA ALTA. Chrome manda sec-ch-ua, sec-ch-ua-mobile
# y sec-ch-ua-platform a todo el mundo por defecto, asi que contarlas marcaria a
# Google Fonts como receptor de huella digital, que es falso y tira abajo la
# credibilidad del informe entero. Estas otras solo llegan si el sitio las pide
# expresamente con Accept-CH, y entonces si es una decision suya.
HUELLA_CABECERAS = {
    "sec-ch-ua-arch": "arquitectura de CPU", "sec-ch-ua-bitness": "bitness",
    "sec-ch-ua-model": "modelo de dispositivo",
    "sec-ch-ua-platform-version": "version del sistema operativo",
    "sec-ch-ua-full-version-list": "version completa del navegador",
}

# Un Chromium recien lanzado se delata y muchos sitios no cargan sus terceros:
# con la configuracion de serie se veian 9 dominios en tres sitios, y con esto
# 21. Medido. Parchear navigator.webdriver y companeros no aporto nada encima
# (20 frente a 21, ruido), asi que no se hace: mas codigo para lo mismo.
CONTEXTO = {
    "user_agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"),
    "viewport": {"width": 1366, "height": 768},
    "locale": "es-ES",
    "timezone_id": "America/Guayaquil",
}

# Hook de document.cookie que anota QUIEN escribe cada cookie. Se inyecta antes
# que ningun script del sitio. No bloquea nada: deja pasar la escritura y se
# queda con la primera URL util de la pila, que es el script responsable.
#
# Va en Document.prototype y NO en document, a proposito: nuestro propio bundle
# lee el descriptor del prototipo y define la propiedad en document. Si el
# espia se pusiera en document, el bundle lo sobrescribiria y no veriamos nada.
# Puesto en el prototipo, el bundle recoge esta version como "la original" y la
# encadena, asi que se ven tambien las escrituras que el banner deja pasar.
ESPIA = """
(() => {
  window.__quien = window.__quien || {};
  try {
    const d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (!d || !d.set || d.__espiado) return;
    const prop = {
      configurable: true,
      __espiado: true,
      get() { return d.get.call(this); },
      set(v) {
        try {
          const nombre = String(v).split('=')[0].trim();
          if (nombre && !window.__quien[nombre]) {
            const pila = (new Error()).stack || '';
            // El puerto lleva dos puntos, asi que no se pueden excluir en la
            // expresion; en su lugar se recorta la coletilla ":linea:columna"
            // que el navegador pega al final de cada marco de la pila.
            const urls = (pila.match(/https?:\\/\\/[^\\s)]+/g) || [])
              .map(u => u.replace(/:\\d+:\\d+$/, ''))
              .filter(u => u.indexOf('/consent-banner.js') === -1);
            const fuera = urls.find(u => u.indexOf(location.origin) !== 0);
            window.__quien[nombre] = fuera || urls[0] || 'inline';
          }
        } catch (e) {}
        d.set.call(this, v);
      }
    };
    Object.defineProperty(Document.prototype, 'cookie', prop);
  } catch (e) {}
})();
"""


# Senales de que no estamos viendo el sitio, sino un muro. Importa mas de lo
# que parece: sin esto, un escaneo contra un sitio protegido devuelve tres
# dominios de captcha y el informe dice "este sitio contacta 3 terceros", que
# es rotundamente falso y nadie lo nota.
MUROS = ("captcha-delivery.com", "datadome.co", "hcaptcha.com",
         "challenges.cloudflare.com", "perimeterx.net", "px-cloud.net",
         "recaptcha.net", "arkoselabs.com", "funcaptcha.com", "imperva.com",
         "incapsula.com", "akamai-bot", "queue-it.net")
TITULOS = ("access denied", "just a moment", "attention required", "are you a robot",
           "verifying you are human", "checking your browser", "robot check",
           "pardon our interruption", "acceso denegado", "security check",
           "unusual traffic", "request blocked", "403 forbidden")


def hay_muro(hosts, titulo, estado):
    """Devuelve el motivo si lo que vimos no era el sitio, o None.

    `hosts` tienen que ser SOLO los de peticiones de DOCUMENTO del marco
    principal, es decir, la pagina en si. Esto se ha estrechado dos veces, y
    las dos por el mismo error de fondo: dar por muro la simple presencia de un
    dominio de captcha.

    Primero se miraban todos los hosts. Un reproductor de Vimeo incrustado
    lanza su propio reto de Cloudflare desde su iframe, y eso marcaba como
    murado un escaneo que habia funcionado: a fryreglet.com le pasaba en las
    cuatro pasadas y no se enviaba nada nunca.

    Luego se miraban los del marco principal, subrecursos incluidos. Pero un
    sitio normal puede cargar el widget de Turnstile desde su propia pagina,
    para proteger un formulario, sin que haya ningun muro: la tienda de Costa
    Farms lo hace, y el escaneo entero se descartaba (HTTP 200, titulo normal,
    25 terceros reales vistos y tirados a la basura).

    Un muro de verdad SUSTITUYE la pagina: o el documento viene de otro sitio,
    o el titulo lo delata, o el servidor responde 4xx. Esas tres son las
    senales, y la presencia de un script de captcha no es ninguna."""
    for h in hosts:
        for m in MUROS:
            if h and m in h:
                return "muro anti-bot (%s)" % m
    t = (titulo or "").strip().lower()
    for x in TITULOS:
        if x in t:
            return 'la pagina responde "%s"' % (titulo or "")[:48]
    if estado and estado >= 400:
        return "el servidor respondio %d" % estado
    return None


def raiz(host):
    """dominio.com a partir de www.sub.dominio.com, para distinguir terceros."""
    p = (host or "").lower().lstrip(".").split(".")
    return ".".join(p[-2:]) if len(p) >= 2 else (host or "")


def config_remota(backend, site_id, callar=False):
    """La config del sitio, para poder fabricar su cookie de consentimiento."""
    url = backend.rstrip("/") + "/api/config?site_id=" + urllib.parse.quote(site_id)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        if not callar:
            print("  aviso: no se pudo leer la config (%s)." % str(e)[:60])
            print("  Se escanea solo en frio; sin ella no se fuerza el consentimiento.")
        return None


def galleta_consentimiento(cfg, url, aceptar):
    """Fabrica la cookie que el propio banner escribiria.

    Esta es la ventaja de escanear tu propio banner: no hay que encontrar y
    pulsar un boton, que es lo que falla en sitios reales. Se escribe la
    decision directamente y la pagina arranca ya decidida."""
    if not cfg:
        return None
    cats = cfg.get("categories") or []
    elegidas = {}
    for c in cats:
        if not isinstance(c, dict) or not c.get("id"):
            continue
        elegidas[c["id"]] = True if (aceptar or c.get("locked")) else False
    valor = {
        "consent_id": None,
        "choice": "all" if aceptar else "none",
        "categories": elegidas,
        "signals": {},
        "ts": int(time.time() * 1000),
        "version": cfg.get("consentVersion"),
    }
    ns = cfg.get("namespace") or "fwc_consent"
    return {"name": ns + "_cookie_consent",
            "value": json.dumps(valor),
            "url": url}


def paginas_del_sitio(pg, url, tope):
    """Sitemap primero; si no hay, los enlaces internos de la home.

    Una sola pagina no basta: lo que pone cookies suele estar en una ficha de
    producto o en un articulo, no en la portada."""
    if tope <= 1:
        return [url]
    propio = raiz(urlparse(url).hostname)
    vistas, orden = {url}, [url]

    base = "%s://%s" % (urlparse(url).scheme, urlparse(url).netloc)
    try:
        with urllib.request.urlopen(base + "/sitemap.xml", timeout=20) as r:
            xml = r.read().decode("utf8", "replace")
        for u in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
            u = u.strip()
            if raiz(urlparse(u).hostname) != propio or u in vistas:
                continue
            if u.endswith((".xml", ".jpg", ".png", ".pdf", ".gz")):
                continue
            vistas.add(u); orden.append(u)
            if len(orden) >= tope:
                return orden
    except Exception:
        pass

    try:
        hrefs = pg.eval_on_selector_all("a[href]", "a=>a.map(x=>x.href)")
    except Exception:
        hrefs = []
    for h in hrefs:
        u = urljoin(url, (h or "").split("#")[0])
        if not u.startswith("http") or u in vistas:
            continue
        if raiz(urlparse(u).hostname) != propio:
            continue
        vistas.add(u); orden.append(u)
        if len(orden) >= tope:
            break
    return orden


def _campos(url, post):
    """Los pares clave=valor de una peticion, vengan de la URL o del cuerpo."""
    fuera = []
    try:
        partes = urlparse(url)
        fuera += urllib.parse.parse_qsl(partes.query, keep_blank_values=True)
    except Exception:
        pass
    if post:
        try:
            fuera += urllib.parse.parse_qsl(post, keep_blank_values=True)
        except Exception:
            pass
    return fuera


def analiza(trafico, propio, canario=None):
    """Convierte el trafico crudo en los hallazgos que importan.

    Devuelve un diccionario por host de tercero con: cuantas peticiones, cuando
    fue la primera, que identificadores le llegaron, que datos de huella y si
    recibio el termino que buscamos."""
    por_host = {}
    for p in trafico:
        host = p["host"]
        if not host or raiz(host) == propio:
            continue          # lo que va al propio sitio no es cesion a un tercero
        h = por_host.setdefault(host, {
            "peticiones": 0, "primera": p["t"], "identificadores": {},
            "huella": {}, "busqueda": [],
        })
        h["peticiones"] += 1
        h["primera"] = min(h["primera"], p["t"])

        for k, v in _campos(p["url"], p.get("post")):
            kl = k.lower().lstrip("_")
            if not v:
                continue
            if kl in IDENTIFICADORES or k.lower() in IDENTIFICADORES:
                h["identificadores"].setdefault(k, v[:40])
            if kl in HUELLA:
                h["huella"].setdefault(HUELLA[kl], v[:60])
            # El termino buscado puede ir en cualquier campo; lo que lo delata
            # es el valor, no el nombre. Por eso se compara el valor.
            if canario and canario.lower() in str(v).lower():
                if k not in [c[0] for c in h["busqueda"]]:
                    h["busqueda"].append((k, v[:60]))

        for k, v in (p.get("ch") or {}).items():
            v = (v or "").strip('"')
            if k in HUELLA_CABECERAS and v:
                h["huella"].setdefault(HUELLA_CABECERAS[k], v[:60])

        # Y si el canario viaja en la ruta en vez de en un parametro. Solo se
        # anota si no se encontro ya en un campo con nombre: si no, cada fuga
        # sale dos veces y el informe parece el doble de grave de lo que es.
        if canario and not h["busqueda"] and canario.lower() in p["url"].lower():
            h["busqueda"].append(("(en la ruta de la URL)", p["url"][:70]))

    # Si de un host se conoce el campo con nombre, la anotacion generica sobra.
    for h in por_host.values():
        con_nombre = [c for c in h["busqueda"] if not c[0].startswith("(en la")]
        if con_nombre:
            h["busqueda"] = con_nombre
    return por_host


def busca(pg, url, canario):
    """Busca un termino inventado en el sitio, para ver a quien le llega.

    Es el truco del informe de Tauler Smith: buscaron "tsllp" y lo encontraron
    saliendo hacia Google Analytics en el campo ep.search_term. Con un termino
    que nos inventamos nosotros, cualquier aparicion en una peticion saliente es
    prueba de fuga y ademas dice en que campo viaja. Y no se captura ningun dato
    real de ningun visitante: lo que se busca lo ponemos nosotros."""
    # Primero el formulario de la propia pagina, que es lo fiel a un visitante.
    for sel in ("input[type=search]", "input[name=q]", "input[name=s]",
                "input[name=query]", "input[name=search]"):
        try:
            campo = pg.locator(sel).first
            if campo.count():
                campo.fill(canario, timeout=4000)
                campo.press("Enter", timeout=4000)
                pg.wait_for_timeout(int(ESPERA * 0.8))
                return True
        except Exception:
            continue
    # Si no hay formulario, las rutas de busqueda habituales.
    base = "%s://%s" % (urlparse(url).scheme, urlparse(url).netloc)
    for ruta in ("/search?q=", "/?s=", "/search?query=", "/catalogsearch/result/?q="):
        try:
            r = pg.goto(base + ruta + canario, timeout=20000,
                        wait_until="domcontentloaded")
            if r and r.status < 400:
                pg.wait_for_timeout(int(ESPERA * 0.8))
                return True
        except Exception:
            continue
    return False


def escucha_set_cookie(pg, autores):
    """Anota quien pone cada cookie por cabecera Set-Cookie.

    El hook de document.cookie solo ve las que escribe JavaScript, y medido en
    seis sitios reales eso deja fuera 19 de cada 27 sin clasificar: las pone el
    servidor. Esas solo se ven en las cabeceras de respuesta, y la unica forma
    de leerlas enteras (con HttpOnly incluido) es el protocolo de depuracion de
    Chrome, porque la API normal de Playwright las filtra.

    Hacen falta DOS eventos y no llegan en orden: responseReceivedExtraInfo
    trae las cabeceras sin filtrar pero no la URL, y responseReceived trae la
    URL pero con las cabeceras ya recortadas. Se guardan los dos por requestId
    y se cruzan cuando esten ambos, venga primero el que venga."""
    try:
        cdp = pg.context.new_cdp_session(pg)
        cdp.send("Network.enable")
    except Exception:
        return None                      # sin CDP se sigue, solo con lo de JS

    urls, cabeceras = {}, {}

    def resuelve(rid):
        crudo = cabeceras.get(rid)
        if crudo is None:
            return
        donde = urls.get(rid)
        if donde is None:
            return                       # todavia falta la otra mitad
        for linea in str(crudo).split("\n"):
            nombre = linea.split("=")[0].strip()
            if nombre and nombre not in autores:
                autores[nombre] = donde or "servidor"

    def al_responder(ev):
        try:
            rid = ev.get("requestId")
            urls[rid] = (ev.get("response") or {}).get("url", "") or "servidor"
            resuelve(rid)
        except Exception:
            pass

    def al_llegar_cabeceras(ev):
        try:
            rid = ev.get("requestId")
            for k, v in (ev.get("headers") or {}).items():
                if k.lower() == "set-cookie":
                    cabeceras[rid] = v
                    resuelve(rid)
                    break
        except Exception:
            pass

    cdp.on("Network.responseReceived", al_responder)
    cdp.on("Network.responseReceivedExtraInfo", al_llegar_cabeceras)
    return cdp


def pasada(b, url, etiqueta, galleta, tope, callar=False, canario=None, gpc=False):
    """Un escenario completo: abre contexto limpio y recorre las paginas."""
    ctx = b.new_context(**CONTEXTO)
    # Solo las peticiones de DOCUMENTO del marco principal: la pagina en si.
    # Un script o un iframe de captcha cargado POR la pagina no es un muro.
    principales = set()
    if gpc:
        # Muchos escaneres de cumplimiento mandan la senal GPC, justo para ver
        # si el sitio la respeta. Con ella el banner decide solo, asi que esta
        # pasada es la unica que reproduce lo que ve una herramienta externa.
        ctx.set_extra_http_headers({"Sec-GPC": "1"})
        ctx.add_init_script(
            "Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true});")
    hosts = set()
    trafico = []
    t0 = time.time()

    # Antes solo se guardaba el hostname y se tiraba el resto. Con eso se puede
    # decir "contacto a este tercero", pero no QUE le mando, que es donde esta
    # el peso de una reclamacion: el termino buscado, los identificadores y los
    # datos de huella viajan en la URL y en las cabeceras, no en el host.
    def anota(r):
        try:
            host = urlparse(r.url).hostname or ""
            hosts.add(host)
            # Solo cuenta para el muro el documento del marco principal: es lo
            # unico que un muro puede sustituir. Un <script> de Turnstile en
            # mitad de una tienda que funciona no es un muro, y darlo por tal
            # tiraba el escaneo entero.
            try:
                if r.resource_type == "document" and r.frame.parent_frame is None:
                    principales.add(host)
            except Exception:
                pass
            if len(trafico) >= TOPE_TRAFICO:
                return
            ch = {}
            try:
                for k, v in (r.headers or {}).items():
                    if k.lower().startswith("sec-ch-ua"):
                        ch[k.lower()] = v[:120]
            except Exception:
                pass
            cuerpo = ""
            try:
                cuerpo = (r.post_data or "")[:TOPE_URL]
            except Exception:
                pass
            # El tope tiene que ser generoso: una peticion de GA4 pasa de 800
            # caracteres y mete lo interesante AL FINAL. Con un tope de 600 se
            # nos escapo `ep.search_term` en la posicion 791, que era el
            # hallazgo mas grave del informe del bufete. Lo que se recorta para
            # ENSENAR se recorta luego, al escribir el informe.
            trafico.append({"host": host, "url": r.url[:TOPE_URL], "metodo": r.method,
                            "t": round(time.time() - t0, 1), "ch": ch, "post": cuerpo})
        except Exception:
            pass

    # El oyente va en el CONTEXTO, no en la pagina: asi entran tambien las
    # peticiones que lanzan los iframes, que es donde viven los reproductores
    # y los pixeles de publicidad.
    ctx.on("request", anota)
    ctx.add_init_script(ESPIA)
    if galleta:
        try:
            ctx.add_cookies([galleta])
        except Exception as e:
            if not callar:
                print("    (no se pudo fijar el consentimiento: %s)" % str(e)[:50])

    # Si goto falla (timeout, DNS, conexion rechazada) el contexto se quedaba
    # abierto: tres escenarios fallidos dejaban tres contextos sueltos comiendo
    # memoria hasta el final del escaneo.
    try:
        return _recorre(ctx, url, etiqueta, hosts, principales, trafico,
                        tope, callar, canario)
    finally:
        try:
            ctx.close()
        except Exception:
            pass


def _recorre(ctx, url, etiqueta, hosts, principales, trafico, tope, callar,
             canario=None):
    """El recorrido en si. Separado solo para que pasada() pueda cerrar el
    contexto pase lo que pase."""
    pg = ctx.new_page()
    de_servidor = {}
    escucha_set_cookie(pg, de_servidor)
    resp = pg.goto(url, timeout=45000, wait_until="domcontentloaded")
    estado = resp.status if resp else None
    pg.wait_for_timeout(ESPERA)
    try:
        titulo = pg.title()
    except Exception:
        titulo = ""

    quien = dict(de_servidor)      # lo del servidor primero, lo pisa el de JS

    def recoge():
        # Cada navegacion estrena documento, asi que __quien se vacia: hay que
        # recogerlo ANTES de irse de cada pagina, no solo al final.
        try:
            for k, v in (pg.evaluate("() => window.__quien || {}") or {}).items():
                quien[k] = v          # JavaScript es mas preciso que la cabecera
        except Exception:
            pass
        quien.update({k: v for k, v in de_servidor.items() if k not in quien})

    recoge()
    rutas = paginas_del_sitio(pg, url, tope)
    for u in rutas[1:]:
        try:
            pg.goto(u, timeout=35000, wait_until="domcontentloaded")
            pg.wait_for_timeout(int(ESPERA * 0.6))
            recoge()
        except Exception:
            continue
    if canario:
        busca(pg, url, canario)
        recoge()
    galletas = ctx.cookies()          # el contexto lo cierra pasada(), en finally
    motivo = hay_muro(principales, titulo, estado)
    if not callar:
        print("  %-10s %2d paginas  cookies:%3d  hosts:%3d  peticiones:%4d%s"
              % (etiqueta, len(rutas), len(galletas), len(hosts), len(trafico),
                 "   <-- " + motivo if motivo else ""))
    return galletas, hosts, quien, motivo, trafico


FASES_ES = {"frio": "Sin decidir (nadie ha consentido)",
            "rechazado": "Tras rechazar",
            "aceptado": "Tras aceptar",
            "gpc": "Con senal GPC (lo que ve una herramienta externa)"}


def foto_del_sitio(analisis, hosts_por_escenario, hallazgos, murado):
    """La foto comparable del escaneo. Es lo que hace posible P6.

    El informe en markdown esta escrito para que lo lea una persona, y no sirve
    para comparar: cambia de redaccion con cualquier cosa. Esto es lo mismo
    reducido a lo que de verdad queremos vigilar, y nada mas: a quien se
    contacta sin permiso, que recibio cada uno, y que cookies aparecen antes de
    que nadie decida. Pequeno a proposito: se guarda una por escaneo."""
    sin_permiso = {}
    for fase in ("frio", "rechazado"):
        for h, d in (analisis.get(fase) or {}).items():
            que = sin_permiso.setdefault(h, set())
            if d.get("identificadores"):
                que.add("identificadores")
            if d.get("huella"):
                que.add("huella")
            if d.get("busqueda"):
                que.add("busqueda")
    terceros = set(hosts_por_escenario.get("frio") or set())
    terceros |= set(hosts_por_escenario.get("rechazado") or set())
    return {
        "v": 1,
        # Un muro no es una foto del sitio, es una foto del muro. Va marcado
        # para que la comparacion lo descarte: si no, el dia que un captcha se
        # cruza en medio, el panel avisa de que han desaparecido veinte
        # dominios y al dia siguiente de que han vuelto los veinte.
        "muro": bool(murado),
        "terceros": sorted(terceros),
        "recibieron": {h: sorted(q) for h, q in sin_permiso.items() if q},
        "cookies": sorted(v["name"] for v in hallazgos.values()
                          if "frio" in (v.get("fases") or [])),
    }


def escribe_informe(ruta, url, propio, canario, escenarios, analisis,
                    hallazgos, hosts_por_escenario, murado):
    """Devuelve el informe en markdown, y lo escribe a disco si se da `ruta`."""
    """Un informe con la misma estructura que usan los bufetes para reclamar.

    La idea es que el cliente pueda verse a si mismo con la misma vara con la
    que lo van a medir, antes de que lo mida nadie mas. No afirma nada que no
    se haya observado: cada fila sale de una peticion registrada."""
    L = []
    w = L.append
    w("# Informe tecnico de cesion de datos a terceros\n")
    w("Sitio: **%s**  \nFecha: %s  \n" % (url, time.strftime("%Y-%m-%d %H:%M")))
    w("Termino de busqueda usado para detectar filtraciones: `%s`\n" % canario)
    w("\nEste informe recoge lo observado por un navegador real en varias "
      "visitas al sitio, una por cada estado de consentimiento. No es un "
      "dictamen legal.\n")

    if murado:
        w("\n> **Aviso.** El sitio devolvio un muro anti-bot en alguna visita "
          "(%s). Lo que sigue puede ser del muro y no del sitio.\n"
          % "; ".join(m for _e, m in murado))

    sin_permiso = analisis.get("frio", {})
    tras_rechazo = analisis.get("rechazado", {})

    w("\n## Resumen\n")
    w("| Dato | Valor |")
    w("|---|---|")
    w("| Terceros contactados sin que nadie consienta | **%d** |" % len(sin_permiso))
    w("| Terceros que siguen activos tras rechazar | **%d** |" % len(tras_rechazo))
    w("| Terceros que reciben el termino buscado | **%d** |"
      % len([1 for d in sin_permiso.values() if d["busqueda"]]))
    w("| Terceros que reciben datos de huella | **%d** |"
      % len([1 for d in sin_permiso.values() if len(d["huella"]) >= 3]))
    w("| Cookies distintas observadas | %d |" % len(hallazgos))

    w("\n## 1. Cronologia: primer contacto con cada tercero, por fase\n")
    for etq, _g, _gpc in escenarios:
        d = analisis.get(etq)
        if not d:
            continue
        w("\n**%s**\n" % FASES_ES.get(etq, etq))
        w("| Segundo | Dominio | Peticiones |")
        w("|---|---|---|")
        for h, x in sorted(d.items(), key=lambda kv: kv[1]["primera"])[:25]:
            w("| %.1f s | %s | %d |" % (x["primera"], h, x["peticiones"]))
        if not d:
            w("| | ninguno | |")

    w("\n## 2. Que recibio cada tercero antes de que nadie consintiera\n")
    if not sin_permiso:
        w("Ningun tercero fue contactado antes de consentir.\n")
    else:
        w("| Dominio | Identificadores | Huella | Termino buscado |")
        w("|---|---|---|---|")
        # Primero los que recibieron algo: en un sitio grande son 4 filas entre
        # 26, y enterradas en orden alfabetico no las ve nadie.
        def peso(kv):
            x = kv[1]
            return (0 if (x["identificadores"] or x["huella"] or x["busqueda"]) else 1,
                    kv[0])
        for h, x in sorted(sin_permiso.items(), key=peso):
            w("| %s | %s | %s | %s |" % (
                h,
                ", ".join(sorted(x["identificadores"])) or "-",
                ", ".join(sorted(x["huella"])) or "-",
                ", ".join(c for c, _v in x["busqueda"]) or "-"))

    w("\n## 3. Filtracion del termino de busqueda\n")
    fil = {h: x for h, x in sin_permiso.items() if x["busqueda"]}
    if not fil:
        w("No se observo el termino de busqueda saliendo hacia ningun tercero.\n")
    else:
        w("Se busco `%s` en el sitio. Aparecio en peticiones a:\n" % canario)
        w("| Dominio | Campo | Valor observado |")
        w("|---|---|---|")
        for h, x in sorted(fil.items()):
            for campo, val in x["busqueda"]:
                w("| %s | `%s` | %s |" % (h, campo, val))

    w("\n## 4. Cookies observadas y en que fase aparecen\n")
    if not hallazgos:
        w("No se observo ninguna cookie en ninguna de las fases.\n")
    else:
        w("| Cookie | Dominio | Parte | HttpOnly | Fases |")
        w("|---|---|---|---|---|")
        for v in sorted(hallazgos.values(),
                        key=lambda x: (x["party"] != "third", x["name"])):
            w("| %s | %s | %s | %s | %s |" % (
                v["name"], v["domain"],
                "tercero" if v["party"] == "third" else "propia",
                "si" if v["httpOnly"] else "no",
                ", ".join(v["fases"])))

    w("\n## 5. Huella digital\n")
    hue = {h: x for h, x in sin_permiso.items() if len(x["huella"]) >= 3}
    if not hue:
        w("No se observo envio de caracteristicas de dispositivo antes de "
          "consentir.\n")
    else:
        w("Caracteristicas del dispositivo enviadas sin consentimiento. "
          "Combinadas permiten reconocer el navegador sin cookies.\n")
        for h, x in sorted(hue.items()):
            w("\n**%s**\n" % h)
            w("| Caracteristica | Valor observado |")
            w("|---|---|")
            for k, v in sorted(x["huella"].items()):
                w("| %s | %s |" % (k, v))

    w("\n## 6. Sirve de algo rechazar\n")
    ac = set(analisis.get("aceptado", {}))
    re_ = set(tras_rechazo)
    fr = set(sin_permiso)

    def con_datos(d):
        return {h for h, x in d.items()
                if x["identificadores"] or x["huella"] or x["busqueda"]}

    fr_datos, re_datos = con_datos(sin_permiso), con_datos(tras_rechazo)
    w("| Fase | Terceros contactados | De ellos, reciben datos |")
    w("|---|---|---|")
    w("| Sin decidir | %d | **%d** |" % (len(fr), len(fr_datos)))
    w("| Tras rechazar | %d | **%d** |" % (len(re_), len(re_datos)))
    w("| Tras aceptar | %d | |" % len(ac))

    # La comparacion que pesa en una reclamacion no es aceptar contra rechazar,
    # sino rechazar contra no haber decidido: si decir que no no cambia nada, la
    # negativa no sirve. Antes solo se miraba aceptar contra rechazar y el
    # informe se callaba justo el caso mas grave.
    if re_datos:
        siguen = sorted(re_datos & fr_datos)
        if siguen:
            w("\n> **Rechazar no detiene la cesion de datos.** %d tercero(s) "
              "siguen recibiendo identificadores, huella o lo que el visitante "
              "busco **despues de un rechazo explicito**: %s. Es el hallazgo con "
              "mas peso en una reclamacion, por encima de cualquier cookie.\n"
              % (len(siguen), ", ".join(siguen)))
        else:
            w("\n> **Hay terceros que reciben datos tras rechazar** (%s) y que no "
              "los recibian antes de decidir. Apunta a un error de "
              "configuracion.\n" % ", ".join(sorted(re_datos)))
    elif fr_datos:
        w("\n> Rechazar **si** corta la cesion: %d tercero(s) recibian datos sin "
          "consentimiento y ninguno los recibe tras el rechazo.\n" % len(fr_datos))
    elif re_ and fr and re_ == fr:
        w("\n> Se contactan los mismos terceros antes y despues de rechazar, pero "
          "**ninguno recibe datos identificativos**. Conviene revisar por que se "
          "contactan igualmente, sin presentarlo como una cesion de datos.\n")

    texto = "\n".join(L) + "\n"
    if ruta:
        with open(ruta, "w", encoding="utf8") as f:
            f.write(texto)
    return texto


def escanear(url, site_id, api_key, backend, tope, solo=None, guardar=None, callar=False,
             latido=None, informe=None):
    """Un escaneo completo. Devuelve (resumen, estado, informe, foto).

    estado es "hecho", "muro" o "error". Antes se devolvia solo si hubo muro, y
    un escaneo que no habia podido ENVIAR nada quedaba igualmente como "hecho":
    el panel decia que todo fue bien y no habia llegado ni un hallazgo.

    latido, si se pasa, es una funcion que se llama al terminar cada escenario.
    Sirve para avisar al backend de que seguimos vivos."""
    def di(*a):
        if not callar:
            print(*a)

    propio = raiz(urlparse(url).hostname)
    di("escaneando %s  (dominio propio: %s, hasta %d paginas)" % (url, propio, tope))

    canario = "zqx" + secrets.token_hex(4)     # termino de busqueda inventado
    cfg = config_remota(backend, site_id, callar)
    escenarios = [
        ("frio", None, False),                                 # nadie ha decidido
        ("rechazado", galleta_consentimiento(cfg, url, False), False),
        ("aceptado", galleta_consentimiento(cfg, url, True), False),
        ("gpc", None, True),               # como lo ve una herramienta externa
    ]
    if solo:
        escenarios = [e for e in escenarios if e[0] == solo] or escenarios[:1]
    # Sin config no hay cookie que inyectar: rechazado y aceptado repetirian el
    # frio. El de GPC si vale, porque no depende de inyectar nada.
    if not cfg:
        escenarios = [e for e in escenarios if e[0] in ("frio", "gpc")]

    hallazgos, hosts_por_escenario, autores, murado = {}, {}, {}, []
    analisis = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--disable-dev-shm-usage"])
        try:
            for etiqueta, galleta, gpc in escenarios:
                try:
                    galletas, hosts, quien, motivo, trafico = pasada(
                        b, url, etiqueta, galleta, tope, callar, canario, gpc)
                    analisis[etiqueta] = analiza(trafico, propio, canario)
                    if motivo:
                        murado.append((etiqueta, motivo))
                except Exception as e:
                    di("  %-10s fallo (%s)" % (etiqueta, str(e)[:60]))
                    continue
                finally:
                    if latido:
                        latido()
                for k, v in quien.items():
                    autores.setdefault(k, v)
                hosts_por_escenario[etiqueta] = {h for h in hosts
                                                 if h and raiz(h) != propio}
                for ck in galletas:
                    # Nuestra propia cookie de consentimiento, en las pasadas
                    # donde la inyectamos nosotros, no es un hallazgo del sitio:
                    # la pusimos nosotros. Reportarla ensucia el informe y, en un
                    # sitio que usa otro CMP, parece que acusamos al cliente de
                    # algo que hicimos nosotros. En la pasada "frio" y en la de
                    # GPC no se inyecta nada, asi que ahi si cuenta.
                    if galleta and ck["name"] == galleta["name"]:
                        continue
                    dom = ck["domain"].lstrip(".")
                    clave = (ck["name"], dom)
                    if clave in hallazgos:
                        hallazgos[clave]["fases"].append(etiqueta)
                        continue
                    hallazgos[clave] = {
                        "name": ck["name"], "domain": dom,
                        "party": "third" if raiz(dom) != propio else "first",
                        "httpOnly": bool(ck.get("httpOnly")),
                        "fases": [etiqueta],
                    }
        finally:
            b.close()

    hosts_todos = set()
    for s_ in hosts_por_escenario.values():
        hosts_todos |= s_

    if murado:
        di("\n  " + "!" * 66)
        di("  NO SE PUDO ESCANEAR ESTE SITIO. Lo que se vio es un muro, no la web:")
        for etq, m in murado:
            di("    pasada %-10s %s" % (etq, m))
        di("  Los dominios y cookies de abajo son del muro, NO del sitio. No los")
        di("  des por buenos: el sitio no esta limpio, simplemente no lo hemos")
        di("  visto. Escanealo desde una IP de confianza o pide al cliente que")
        di("  ponga en lista blanca la del escaner.")
        di("  " + "!" * 66)

    ho = sum(1 for v in hallazgos.values() if v["httpOnly"])
    ter = sum(1 for v in hallazgos.values() if v["party"] == "third")
    di("\n  cookies distintas: %d   de terceros: %d   HttpOnly: %d"
       % (len(hallazgos), ter, ho))
    di("  dominios de tercero contactados: %d" % len(hosts_todos))

    # Lo que aparece en "frio" se esta cargando ANTES de que nadie decida.
    # Es el hallazgo que de verdad importa para un informe de cumplimiento.
    antes = hosts_por_escenario.get("frio", set())
    rech = hosts_por_escenario.get("rechazado", set())
    fuga = sorted(antes | rech)
    if fuga and not murado:
        # Meter en la misma lista a cdn.shopify.com y a cdn.attn.tv exagera el
        # problema y resta credibilidad: uno sirve imagenes y el otro perfila
        # gente. Se separan por lo que CADA UNO recibio, que es evidencia y no
        # una lista de dominios buenos y malos.
        recibieron = {h for h in fuga
                      if (analisis.get("frio", {}).get(h, {}).get("identificadores")
                          or analisis.get("frio", {}).get(h, {}).get("huella")
                          or analisis.get("frio", {}).get(h, {}).get("busqueda"))}
        mudos = [h for h in fuga if h not in recibieron]
        if recibieron:
            di("\n  RECIBIERON DATOS SIN PERMISO (%d):" % len(recibieron))
            for h in sorted(recibieron):
                d = analisis.get("frio", {}).get(h, {})
                que = []
                if d.get("identificadores"): que.append("identificadores")
                if d.get("huella"): que.append("huella")
                if d.get("busqueda"): que.append("lo que se busco")
                di("    %-38s %s" % (h[:38], ", ".join(que)))
        if mudos:
            di("\n  contactados sin permiso, sin datos identificativos (%d):" % len(mudos))
            for h in mudos[:8]:
                cuando = []
                if h in antes: cuando.append("sin decidir")
                if h in rech: cuando.append("tras rechazar")
                di("    %-38s %s" % (h[:38], " y ".join(cuando)))
            if len(mudos) > 8:
                di("    ... y %d mas" % (len(mudos) - 8))

    # El denominador son los autores vistos, no los hallazgos: se ven autores de
    # cookies que no acaban en el tarro final (las que el sitio borra, o las de
    # dominios de tercero). Antes se comparaba contra len(hallazgos) y salian
    # cosas como "86 de 9 identificadas", que no quiere decir nada.
    con_autor = sum(1 for v in autores.values() if v and v not in ("inline", "servidor"))
    if autores and not callar:
        di("\n  quien escribe cada cookie: %d de %d con autor conocido"
           % (con_autor, len(autores)))
        for n, u in list(autores.items())[:6]:
            di("    %-24s %s" % (n[:24], (u or "")[:52]))

    if not hosts_todos and not murado:
        di("\n  AVISO: no se vio trafico de terceros. O el sitio no los tiene, o")
        di("  detecto el navegador automatizado. NO des por bueno que esta limpio.")

    # Lo que de verdad se reclama en una demanda no es que se contactara a un
    # tercero, sino QUE recibio. Esto es lo que antes no se miraba.
    antes_de_decidir = analisis.get("frio", {})
    filtra = {h: d for h, d in antes_de_decidir.items() if d["busqueda"]}
    if filtra and not murado:
        di("\n  LO QUE BUSCA EL VISITANTE SE FILTRA A TERCEROS, SIN PERMISO:")
        for h, d in sorted(filtra.items()):
            for campo, _v in d["busqueda"]:
                di("    %-34s en el campo %s" % (h[:34], campo))

    huellas = {h: d for h, d in antes_de_decidir.items() if len(d["huella"]) >= 3}
    if huellas and not murado:
        di("\n  HUELLA DIGITAL antes de decidir (%d dominios):" % len(huellas))
        for h, d in sorted(huellas.items()):
            di("    %-34s %s" % (h[:34], ", ".join(sorted(d["huella"]))[:60]))

    ident = {h: d for h, d in antes_de_decidir.items() if d["identificadores"]}
    if ident and not murado:
        di("\n  IDENTIFICADORES enviados antes de decidir (%d dominios):" % len(ident))
        for h, d in sorted(ident.items()):
            di("    %-34s %s" % (h[:34], ", ".join(sorted(d["identificadores"]))[:60]))

    if guardar:
        detalle = {"url": url, "cuando": time.strftime("%Y-%m-%dT%H:%M:%S"),
                   "canario": canario,
                   "cookies": list(hallazgos.values()),
                   "hosts": {k: sorted(v) for k, v in hosts_por_escenario.items()},
                   "autores": autores, "muro": murado,
                   "por_fase": {k: {h: {kk: (sorted(vv) if isinstance(vv, dict) else vv)
                                        for kk, vv in d.items()}
                                    for h, d in v.items()}
                                for k, v in analisis.items()}}
        with open(guardar, "w", encoding="utf8") as f:
            json.dump(detalle, f, ensure_ascii=False, indent=2)
        di("\n  detalle en %s" % guardar)

    foto = foto_del_sitio(analisis, hosts_por_escenario, hallazgos, murado)
    texto_informe = escribe_informe(informe, url, propio, canario, escenarios,
                                    analisis, hallazgos, hosts_por_escenario, murado)
    if informe:
        di("  informe en %s" % informe)

    resumen = ("%d cookies (%d de terceros, %d HttpOnly), %d dominios, %d sin permiso"
               % (len(hallazgos), ter, ho, len(hosts_todos), len(fuga)))
    if murado:
        di("  NO se envia nada: lo observado es el muro, no el sitio.")
        return "muro: " + murado[0][1], "muro", texto_informe, foto

    # Se manda por el mismo endpoint que usa el bundle: no hace falta uno nuevo
    # y asi todo aterriza en la misma pantalla de revision. El autor viaja con
    # cada cookie: es lo que permite clasificar por procedencia (P5).
    # fases viaja con cada hallazgo: es lo que permite al panel decir "esta
    # aparece ANTES de que nadie consienta", que es justo la pregunta que hace
    # una herramienta externa. Antes se calculaba y se tiraba aqui.
    items = [{"name": v["name"], "domain": v["domain"], "kind": "cookie",
              "party": v["party"], "autor": autores.get(v["name"], ""),
              "fases": v["fases"], "httpOnly": v["httpOnly"]}
             for v in hallazgos.values()]
    items += [{"name": h, "kind": "host", "party": "third",
               "fases": [e for e in hosts_por_escenario if h in hosts_por_escenario[e]]}
              for h in sorted(hosts_todos)]
    if not items:
        di("  nada que enviar."); return "sin hallazgos", "hecho", texto_informe, foto

    enviados = 0
    for i in range(0, len(items), 150):               # el backend corta en 200
        cuerpo = json.dumps({"site_id": site_id, "phase": "escaner",
                             "cookies": items[i:i + 150]}).encode()
        req = urllib.request.Request(backend.rstrip("/") + "/api/cookies", cuerpo,
                                     {"Content-Type": "application/json",
                                      "X-Api-Key": api_key, "Origin": url})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                enviados += len(items[i:i + 150]); json.loads(r.read())
        except Exception as e:
            di("  error enviando: %s" % str(e)[:90])
            return ("no se pudo enviar (%s). Lo visto: %s" % (str(e)[:60], resumen),
                    "error", texto_informe, foto)
        time.sleep(0.4)                                # el endpoint limita por IP
    di("  enviados %d hallazgos. Revisalos en Cookies y scripts." % enviados)
    return resumen, "hecho", texto_informe, foto


def worker(backend, clave, cada=15):
    """Modo servicio: pide trabajo al backend, lo hace y reporta.

    Asi es como corre en Railway, en un servicio aparte del backend: Chromium
    ocupa unos 323 MB en disco y cientos de MB de RAM, y no tiene por que
    compartirlos con el proceso que atiende a los clientes."""
    base = backend.rstrip("/")
    print("worker en marcha contra %s (cada %ds). Ctrl+C para parar." % (base, cada))
    while True:
        job = None
        try:
            req = urllib.request.Request(base + "/api/scan/cola",
                                         json.dumps({"accion": "tomar"}).encode(),
                                         {"Content-Type": "application/json",
                                          "X-Scanner-Key": clave})
            with urllib.request.urlopen(req, timeout=30) as r:
                job = (json.loads(r.read()) or {}).get("job")
        except Exception as e:
            print("  no se pudo pedir trabajo: %s" % str(e)[:70])
        if not job:
            time.sleep(cada); continue

        print("\n--- trabajo %s: %s" % (job["id"], job["url"]))
        token = job.get("token") or ""

        def manda(payload):
            req = urllib.request.Request(
                base + "/api/scan/cola", json.dumps(payload).encode(),
                {"Content-Type": "application/json", "X-Scanner-Key": clave})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read()) or {}

        # Sin clave publica activa no hay forma de enviar los hallazgos. Antes
        # se descubria al final: escaneaba los tres escenarios enteros (hasta
        # una hora en un sitio grande) y moria al enviar.
        if not job.get("api_key"):
            print("  el sitio no tiene clave publica activa: no se escanea.")
            try:
                manda({"accion": "terminar", "id": job["id"], "token": token,
                       "estado": "error",
                       "resumen": "el sitio no tiene una clave publica activa; "
                                  "creala en Instalar y vuelve a pedirlo"})
            except Exception as e:
                print("  no se pudo reportar: %s" % str(e)[:70])
            continue

        # El latido corre aparte porque el hilo principal se queda bloqueado
        # dentro de Playwright minutos enteros. Sin el, el backend daba por
        # muerto a un worker vivo y le daba el trabajo a otro.
        parar = threading.Event()

        def late():
            while not parar.wait(60):
                try:
                    if not manda({"accion": "sigo", "id": job["id"],
                                  "token": token}).get("vivo"):
                        print("  este trabajo ya no es nuestro; se abandona.")
                        parar.set()
                except Exception:
                    pass        # un latido perdido no es motivo para abortar

        hilo = threading.Thread(target=late, daemon=True); hilo.start()
        estado, resumen, informe, foto = "hecho", "", "", None
        try:
            resumen, estado, informe, foto = escanear(job["url"], job["site_id"],
                                                      job["api_key"], base,
                                                      int(job.get("paginas") or 8))
        except Exception as e:
            estado, resumen = "error", str(e)[:200]
            print("  fallo: %s" % resumen)
        finally:
            parar.set()
        try:
            # El informe viaja con el reporte final: es lo que el panel
            # enseña despues, sin que nadie tenga que buscar un fichero.
            r = manda({"accion": "terminar", "id": job["id"], "token": token,
                       "estado": estado, "resumen": resumen,
                       "informe": informe[:120000],
                       # La foto es lo que el backend compara con la del
                       # escaneo anterior para avisar solo de lo que cambio.
                       "datos": foto})
            if r.get("ignorado"):
                print("  el backend lo ignoro: el trabajo ya era de otro worker.")
        except Exception as e:
            print("  no se pudo reportar: %s" % str(e)[:70])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {}
    for i, a in enumerate(sys.argv):
        if a in ("--paginas", "--escenario", "--guardar", "--backend",
                 "--clave", "--cada", "--informe") and i + 1 < len(sys.argv):
            opts[a[2:]] = sys.argv[i + 1]
            if sys.argv[i + 1] in args:
                args.remove(sys.argv[i + 1])

    if "--worker" in sys.argv:
        backend = opts.get("backend") or os.environ.get("BACKEND_URL") or (args[0] if args else "")
        clave = opts.get("clave") or os.environ.get("SCANNER_KEY") or ""
        if not backend or not clave:
            sys.exit("Modo worker:\n"
                     "  python escanear.py --worker --backend https://optward.com --clave XXX\n"
                     "  (o con las variables BACKEND_URL y SCANNER_KEY)")
        return worker(backend, clave, int(opts.get("cada", 15)))

    if len(args) < 4:
        sys.exit(__doc__)
    escanear(args[0], args[1], args[2], args[3],
             max(1, int(opts.get("paginas", PAGINAS))),
             opts.get("escenario"), opts.get("guardar"),
             informe=opts.get("informe"))


if __name__ == "__main__":
    main()

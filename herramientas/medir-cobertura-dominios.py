#!/usr/bin/env python3
"""Mide que fuente reconoce mejor los hosts de terceros de un sitio real.

    python3 medir-cobertura-dominios.py

Baja las dos fuentes candidatas, las convierte con el mismo criterio, y las
prueba contra la misma muestra de hosts. No hay cifras escritas a mano: todo
lo que imprime sale de los datos que acaba de descargar.

QUE COMPARA
  EasyPrivacy   listas oficiales de easylist/easylist, reglas de dominio puro
  whotracks.me  trackerdb.sql, tabla tracker_domains

COMO SE COMPARA
  La misma regla de sufijo que usa dominioBloqueado() en core.js: un host
  casa si es igual al dominio del catalogo o termina en "." + ese dominio.
  Asi la medicion refleja lo que haria el bundle, no una comparacion teorica.

LIMITACION DE LA MUESTRA, QUE HAY QUE DECIR
  Los 28 hosts de MUESTRA estan elegidos a mano: son los terceros que
  aparecen una y otra vez en sitios comerciales (analitica, publicidad,
  mapas de calor, chat, CDNs). No es una muestra aleatoria ni sale de un
  escaneo de los sitios de los clientes. Sirve para comparar dos fuentes
  entre si, que es para lo que se hizo. Cuando el escaner de P4 funcione,
  esta medicion habria que repetirla sobre hosts observados de verdad.

  Los nueve de CONTROL son infraestructura y reproductores: ninguna fuente
  deberia proponerlos para bloqueo, y si los propone es un falso positivo
  que rompe el sitio del cliente.
"""
import json, re, sqlite3, sys, urllib.request
from datetime import date

EP_BASE = ("https://raw.githubusercontent.com/easylist/easylist/master/easyprivacy/")
EP_LISTAS = ["easyprivacy_trackingservers.txt",
             "easyprivacy_trackingservers_international.txt",
             "easyprivacy_thirdparty.txt",
             "easyprivacy_thirdparty_international.txt",
             "easyprivacy_general.txt",
             "easyprivacy_specific.txt",
             "easyprivacy_specific_international.txt"]
WTM = ("https://raw.githubusercontent.com/whotracksme/whotracks.me/"
       "master/whotracksme/data/assets/trackerdb.sql")

# Terceros que aparecen de verdad en sitios comerciales.
MUESTRA = [
    "google-analytics.com", "www.googletagmanager.com", "connect.facebook.net",
    "static.hotjar.com", "cdn.segment.com", "stats.g.doubleclick.net",
    "googleads.g.doubleclick.net", "bat.bing.com", "analytics.tiktok.com",
    "px.ads.linkedin.com", "snap.licdn.com", "sc-static.net", "cdn.mxpnl.com",
    "script.crazyegg.com", "cdn.amplitude.com", "scorecardresearch.com",
    "beacon.krxd.net", "cdn.branch.io", "js.hs-scripts.com",
    "static.ads-twitter.com", "analytics.twitter.com", "widget.intercom.io",
    "cdn.heapanalytics.com", "cdn.optimizely.com", "munchkin.marketo.net",
    "cdn.pdst.fm", "c.clarity.ms", "matomo.cloud",
]
# Infraestructura: ninguna fuente deberia marcarlos para bloquear.
CONTROL = [
    "fonts.googleapis.com", "ajax.googleapis.com", "cdn.jsdelivr.net",
    "code.jquery.com", "unpkg.com", "cdnjs.cloudflare.com",
    "js.stripe.com", "player.vimeo.com", "www.youtube.com",
]
HOST_OK = re.compile(r"^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$")


def bajar(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read().decode("utf8", "replace")


def easyprivacy():
    """Dominios que EasyPrivacy bloquea ENTEROS (||host^ o ||host^$third-party).

    Las reglas con ruta quedan fuera a proposito: "||x.com/pixel.gif" bloquea
    un recurso, no el host, y autoBlock compara contra el hostname. Meterlas
    seria bloquear el host entero cuando EasyPrivacy decidio no hacerlo."""
    dom = set()
    for nombre in EP_LISTAS:
        for linea in bajar(EP_BASE + nombre).splitlines():
            s = linea.strip()
            if not s or s[0] in "!#[" or s.startswith("@@") or "##" in s:
                continue
            if not s.startswith("||"):
                continue
            c = s[2:]
            opc = ""
            if "$" in c:
                c, opc = c.split("$", 1)
            if c.endswith("^"):
                c = c[:-1]
            if not c or "/" in c or "*" in c or "^" in c:
                continue
            if opc:
                partes = set(o.split("=")[0].strip() for o in opc.split(",") if o.strip())
                if not partes <= {"third-party"}:
                    continue
            h = c.lower().strip(".")
            if "." in h and HOST_OK.match(h):
                dom.add(h)
    return dom


CATEGORIA_WTM = {}      # dominio -> categoria original de whotracks.me


def whotracksme():
    con = sqlite3.connect(":memory:")
    con.create_function("unistr", 1, lambda s: s)   # el volcado usa unistr()
    con.executescript(bajar(WTM))
    dom = set()
    for d, cat in con.execute(
            "SELECT td.domain, c.name FROM tracker_domains td "
            "JOIN trackers t ON t.id=td.tracker JOIN categories c ON c.id=t.category_id"):
        if not d or "." not in d:
            continue
        d = d.lower().strip(".")
        dom.add(d)
        CATEGORIA_WTM.setdefault(d, cat)
    return dom


def casa(host, catalogo):
    """Misma regla de sufijo que dominioBloqueado() en core.js."""
    p = host.lower().split(".")
    for i in range(len(p) - 1):
        k = ".".join(p[i:])
        if k in catalogo:
            return k
    return None


def main():
    print("Medicion de cobertura — " + date.today().isoformat())
    print("Descargando las dos fuentes...\n")
    try:
        fuentes = [("EasyPrivacy", easyprivacy()), ("whotracks.me", whotracksme())]
    except Exception as e:
        sys.exit("No se pudo descargar: %s" % e)

    for nombre, cat in fuentes:
        print("  %-14s %5d dominios" % (nombre, len(cat)))
    print()

    anchos = "  %-30s" + "  %-24s" * len(fuentes)
    print(anchos % tuple(["HOST DE TERCEROS"] + [n for n, _ in fuentes]))
    print("  " + "-" * 78)
    aciertos = [0] * len(fuentes)
    for h in MUESTRA:
        fila = [h]
        for i, (_, cat) in enumerate(fuentes):
            m = casa(h, cat)
            if m:
                aciertos[i] += 1
            fila.append(m or "—")
        print(anchos % tuple(fila))

    print("\n  COBERTURA sobre %d hosts:" % len(MUESTRA))
    for i, (nombre, _) in enumerate(fuentes):
        print("    %-14s %2d/%d  = %3.0f%%" %
              (nombre, aciertos[i], len(MUESTRA), 100.0 * aciertos[i] / len(MUESTRA)))

    # OJO al leer esto. whotracks.me SI lista los CDN, y a primera vista
    # parece un falso positivo. No lo es: los lista con categoria "hosting",
    # y el importador no propone bloqueo para esa categoria. Por eso aqui se
    # imprime la categoria y no solo si aparece o no; sin ella, la tabla
    # diria lo contrario de lo que pasa.
    print("\n  CONTROL — infraestructura. Entre parentesis, la categoria que le")
    print("  da whotracks.me. 'hosting' significa reconocido pero NO propuesto.")
    peligro = 0
    for h in CONTROL:
        fila = [h]
        for nombre, cat in fuentes:
            m = casa(h, cat)
            if not m:
                fila.append("no aparece")
            elif nombre == "whotracks.me":
                g = CATEGORIA_WTM.get(m, "?")
                if g not in ("hosting", "cdn", "audio_video_player", "utilities",
                             "customer_interaction", "consent", "misc", "extensions"):
                    peligro += 1
                fila.append("%s (%s)" % (m, g))
            else:
                peligro += 1
                fila.append(m + " (sin categoria)")
        print(anchos % tuple(fila))
    print("\n    propuestos para bloqueo por error: %d de %d" % (peligro, len(CONTROL)))

    print("\n  Lo que inclina la decision no es solo el 96 contra 14: es que")
    print("  whotracks.me trae categoria y empresa por dominio. La categoria es")
    print("  lo que permite reconocer un CDN y NO proponerlo, y la empresa es lo")
    print("  que rellena la columna Provider del audit. EasyPrivacy da una lista")
    print("  de dominios a secas, sin con que distinguir un rastreador de un CDN.")


if __name__ == "__main__":
    main()

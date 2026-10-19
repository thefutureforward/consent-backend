#!/usr/bin/env python3
"""Construye el catalogo de dominios de rastreo que lee backend.py.

    python3 generar-dominios-rastreo.py

Baja la base de whotracks.me, la convierte y escribe dominios-rastreo.json
JUNTO a backend.py. Si el archivo falta, el sistema arranca igual: no propone
dominios, lo avisa por consola y sigue.

Solo libreria estandar, como el resto del backend.

POR QUE ESTA FUENTE Y NO EASYPRIVACY
Se midio. Sobre 28 hosts de terceros que aparecen de verdad en sitios de
clientes, EasyPrivacy reconocia 4 (14%) y esta reconoce 27 (96%). El motivo
es que EasyPrivacy casi nunca bloquea un host entero: para Google Analytics,
Hotjar o Segment usa reglas de ruta, porque es un bloqueador de navegacion
general y tumbar el host completo rompe sitios. Justo los nombres que mas
importan aqui son los que deja fuera. Ademas esta trae categoria y empresa,
que es lo que rellena la columna Provider del audit.

LICENCIA. Los datos de whotracks.me son Creative Commons Attribution 4.0:
atribucion y nada mas. Sin compartir igual y sin restriccion comercial, el
mismo trato que la Open Cookie Database. Conserva LICENSE-whotracksme.txt al
lado. (El codigo del proyecto va aparte bajo MIT; aqui solo usamos los datos.)
"""
import json, os, sqlite3, sys, urllib.request
from collections import Counter
from datetime import date

FUENTE = ("https://raw.githubusercontent.com/whotracksme/whotracks.me/"
          "master/whotracksme/data/assets/trackerdb.sql")
CACHE = "trackerdb.sql"
SALIDA = "dominios-rastreo.json"

# Las 11 categorias de whotracks.me, traducidas a lo que este producto decide.
#
#   "marketing" / "analitica"  -> se PROPONE bloquear, con esa categoria
#   None                       -> se identifica pero NO se propone bloquear
#
# El criterio es el del plan: permisivo por defecto. Bloquear un chat de
# soporte o un reproductor de video se ve al instante y el cliente pierde algo
# que queria; no bloquear un rastreador se arregla en la siguiente revision.
# "hosting" es la categoria critica: ahi viven jsDelivr, jQuery, unpkg,
# Cloudflare y Google Fonts. Bloquear eso tumba el sitio entero.
MAPA = {
    "advertising":          "marketing",
    "pornvertising":        "marketing",
    "social_media":         "marketing",
    "site_analytics":       "analitica",
    "customer_interaction": None,   # chats y soporte: romperlos se nota
    "audio_video_player":   None,   # video: lo resuelve el marcador de P7
    "hosting":              None,   # INFRAESTRUCTURA. Nunca.
    "cdn":                  None,   # idem
    "consent":              None,   # otros banners de consentimiento
    "utilities":            None,
    "extensions":           None,
    "misc":                 None,
}


def bajar():
    if os.path.exists(CACHE):
        return open(CACHE, encoding="utf8", errors="replace").read()
    print("  bajando trackerdb.sql ...")
    with urllib.request.urlopen(FUENTE, timeout=120) as r:
        txt = r.read().decode("utf8", "replace")
    open(CACHE, "w", encoding="utf8").write(txt)
    return txt


def cargar(sql):
    con = sqlite3.connect(":memory:")
    # El volcado usa unistr() para los acentos, que es de PostgreSQL y SQLite no
    # tiene. Como solo leemos nombres, devolver el texto tal cual basta.
    con.create_function("unistr", 1, lambda s: s)
    con.executescript(sql)
    return con


def main():
    print("whotracks.me -> " + SALIDA)
    try:
        con = cargar(bajar())
    except Exception as e:
        sys.exit("No se pudo preparar la base: %s" % e)

    filas = con.execute(
        "SELECT td.domain, cat.name, COALESCE(co.name, t.name) "
        "FROM tracker_domains td "
        "JOIN trackers t    ON t.id  = td.tracker "
        "JOIN categories cat ON cat.id = t.category_id "
        "LEFT JOIN companies co ON co.id = t.company_id").fetchall()

    dominios = {}
    sin_mapear = Counter()
    for dom, grupo, empresa in filas:
        d = (dom or "").strip().lower().strip(".")
        if not d or "." not in d or d in dominios:
            continue
        if grupo not in MAPA:
            sin_mapear[grupo] += 1
            continue
        # [categoria_sugerida o "", empresa, grupo_original]
        dominios[d] = [MAPA[grupo] or "", (empresa or "").strip()[:60], grupo]

    # De mas corto a mas largo, para que "doubleclick.net" entre antes que
    # "stats.g.doubleclick.net" y el redundante se pueda descartar: el bundle
    # compara por sufijo, asi que el corto ya cubre al largo.
    ordenados = sorted(dominios, key=lambda x: (x.count("."), len(x)))
    final, redundantes = {}, 0
    for d in ordenados:
        partes = d.split(".")
        padre = next((".".join(partes[i:]) for i in range(1, len(partes) - 1)
                      if ".".join(partes[i:]) in final), None)
        # Solo se descarta si el padre dice exactamente lo mismo. Si difieren
        # (p.ej. el padre es hosting y el hijo analitica), se conservan los dos.
        if padre and final[padre][0] == dominios[d][0]:
            redundantes += 1
            continue
        final[d] = dominios[d]

    salida = {
        "fuente": "whotracks.me (https://whotracks.me/)",
        "licencia": "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
        "atribucion": "Data from whotracks.me, by Ghostery / Cliqz contributors",
        "generado": date.today().isoformat(),
        "dominios": dict(sorted(final.items())),
    }
    with open(SALIDA, "w", encoding="utf8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))

    prop = Counter(v[0] or "(no se propone)" for v in final.values())
    print("  filas en la base:     %6d" % len(filas))
    print("  fuera por redundante: %6d" % redundantes)
    print("  FINALES:              %6d" % len(final))
    print("  reparto:", prop.most_common())
    if sin_mapear:
        print("  AVISO, categorias nuevas sin mapear:", sin_mapear.most_common())
        print("  (se quedaron fuera; anadelas a MAPA)")
    print("  escrito %s (%d KB)" % (SALIDA, os.path.getsize(SALIDA) / 1024))
    print("\n  Va junto a backend.py. No entra en el bundle.")


if __name__ == "__main__":
    main()

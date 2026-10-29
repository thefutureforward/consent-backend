#!/usr/bin/env python3
"""Convierte la Open Cookie Database al catalogo que lee backend.py.

    curl -sS -O https://raw.githubusercontent.com/jkwakman/Open-Cookie-Database/master/open-cookie-database.csv
    python3 generar-catalogo-odb.py

Genera cookies-odb.json, que va JUNTO a backend.py. Si falta, el sistema
arranca igual con las 75 entradas curadas y lo avisa por consola.
"""
import csv, json, collections, os, sys

CSV = "open-cookie-database.csv"
SALIDA = "cookies-odb.json"

# Mapeo conservador: solo lo imprescindible queda como "esencial", porque esa
# categoria no se puede denegar y una cookie mal puesta ahi no se borraria
# nunca. "Functional" NO se traduce a esencial aunque el nombre lo sugiera.
MAPA = {"Necessary": "esencial", "Security": "esencial",
        "Analytics": "analitica", "Marketing": "marketing",
        "Functional": "funcional", "Personalization": "funcional"}

def main():
    if not os.path.exists(CSV):
        sys.exit("Falta %s. Descargalo primero (ver cabecera de este script)." % CSV)
    filas = list(csv.DictReader(open(CSV, encoding="utf8")))
    exactas, prefijos, saltadas = {}, [], 0
    for x in filas:
        nom = (x["Cookie / Data Key name"] or "").strip()
        cat = MAPA.get((x["Category"] or "").strip())
        if not nom or not cat:
            saltadas += 1
            continue
        desc = (x["Description"] or "").strip().rstrip(".")
        plat = (x["Platform"] or "").strip()
        texto = (plat + ": " if plat else "") + (desc or "sin descripcion")
        if len(texto) > 160:
            texto = texto[:157] + "..."
        if x["Wildcard match"] == "1":
            prefijos.append([nom.rstrip("*").lower(), cat, texto])
        else:
            exactas.setdefault(nom.lower(), [cat, texto])

    # De mas largo a mas corto: "_gat_" debe ganar a "_ga".
    prefijos.sort(key=lambda p: -len(p[0]))
    json.dump({"fuente": "Open Cookie Database (Apache-2.0)",
               "exactas": exactas, "prefijos": prefijos},
              open(SALIDA, "w", encoding="utf8"),
              ensure_ascii=False, separators=(",", ":"))

    print("exactas: %d | comodines: %d | total: %d | saltadas: %d"
          % (len(exactas), len(prefijos), len(exactas) + len(prefijos), saltadas))
    print("por categoria:", collections.Counter(v[0] for v in exactas.values()).most_common())
    print("escrito %s (%d KB)" % (SALIDA, os.path.getsize(SALIDA) / 1024))

if __name__ == "__main__":
    main()

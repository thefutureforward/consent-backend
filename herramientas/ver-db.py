#!/usr/bin/env python3
"""Mirar la base de datos sin tocarla. Solo lectura, sin dependencias.

    python3 herramientas/ver-db.py                 # donde esta y que hay dentro
    python3 herramientas/ver-db.py consent_logs    # ultimas filas de una tabla
    python3 herramientas/ver-db.py sites --n 50    # cuantas filas quieres
    python3 herramientas/ver-db.py --sql "SELECT site_id, COUNT(*) FROM consent_logs GROUP BY 1"

Abre el fichero en modo solo lectura: nada de lo que hagas aqui puede
estropear la base. Busca la base en el mismo sitio que backend.py, asi que
tambien funciona dentro de Railway con el volumen montado.
"""
import os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(HERE)
DATA_DIR = (os.environ.get("DATA_DIR")
            or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
            or RAIZ)
DB = os.path.join(DATA_DIR, "backend.db")


def abre():
    if not os.path.exists(DB):
        sys.exit("No hay base de datos en:\n  %s\n\n"
                 "Si esperabas encontrarla ahi, el backend todavia no ha\n"
                 "arrancado nunca con esta configuracion, o DATA_DIR apunta a\n"
                 "otro sitio. Arranca backend.py y mira la linea que imprime." % DB)
    # mode=ro: aunque te equivoques escribiendo una consulta, no puede escribir.
    c = sqlite3.connect("file:%s?mode=ro" % DB, uri=True)
    c.row_factory = sqlite3.Row
    return c


def tabla(filas, cols, ancho=38):
    """Imprime filas en columnas, recortando lo que no cabe."""
    if not filas:
        print("   (ninguna fila)")
        return
    anchos = []
    for i, col in enumerate(cols):
        largo = max([len(str(col))] + [len(str(f[i])) for f in filas])
        anchos.append(min(largo, ancho))
    print("   " + "  ".join(str(c)[:a].ljust(a) for c, a in zip(cols, anchos)))
    print("   " + "  ".join("-" * a for a in anchos))
    for f in filas:
        print("   " + "  ".join(
            str("" if v is None else v).replace("\n", " ")[:a].ljust(a)
            for v, a in zip(f, anchos)))


def resumen(c):
    tam = os.path.getsize(DB)
    print("Base de datos")
    print("   fichero: %s" % DB)
    print("   tamano:  %s" % (
        "%.1f MB" % (tam / 1048576.0) if tam > 1048576 else "%.0f KB" % (tam / 1024.0)))
    if os.environ.get("RAILWAY_VOLUME_MOUNT_PATH"):
        print("   volumen: SI, montado en %s" % os.environ["RAILWAY_VOLUME_MOUNT_PATH"])
    elif os.environ.get("RAILWAY_ENVIRONMENT"):
        print("   volumen: NO HAY. La base se borra en cada despliegue.")
    print()
    print("Tablas")
    nombres = [r[0] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    for n in nombres:
        cuantas = c.execute("SELECT COUNT(*) FROM \"%s\"" % n).fetchone()[0]
        print("   %-22s %6d" % (n, cuantas))
    print()
    print("Para ver una:  python3 herramientas/ver-db.py %s" % (nombres[0] if nombres else "tabla"))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    n = 20
    if "--n" in sys.argv:
        n = int(sys.argv[sys.argv.index("--n") + 1])
        if str(n) in args:
            args.remove(str(n))

    c = abre()

    if "--sql" in sys.argv:
        q = sys.argv[sys.argv.index("--sql") + 1]
        if not q.lstrip().lower().startswith(("select", "with", "pragma")):
            sys.exit("Esta herramienta solo hace consultas de lectura.")
        cur = c.execute(q)
        tabla(cur.fetchall(), [d[0] for d in cur.description])
        return

    if not args:
        return resumen(c)

    t = args[0]
    existe = c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                       (t,)).fetchone()
    if not existe:
        sys.exit("No existe la tabla '%s'. Lanza sin argumentos para ver cuales hay." % t)

    cuantas = c.execute("SELECT COUNT(*) FROM \"%s\"" % t).fetchone()[0]
    # Por id si la tabla lo tiene (asi salen las ultimas, que es lo que se mira).
    cols = [r[1] for r in c.execute("PRAGMA table_info(\"%s\")" % t)]
    orden = " ORDER BY id DESC" if "id" in cols else ""
    cur = c.execute("SELECT * FROM \"%s\"%s LIMIT %d" % (t, orden, n))
    filas = cur.fetchall()
    print("%s: %d filas en total, aqui van %d%s\n"
          % (t, cuantas, len(filas), " (las ultimas)" if orden else ""))
    tabla(filas, [d[0] for d in cur.description])


if __name__ == "__main__":
    main()

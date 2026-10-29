# Worker del escaner (P4). Va en un SERVICIO APARTE del backend.
#
# La imagen oficial de Playwright ya trae Chromium y las librerias del
# sistema que necesita, que es la parte que suele fallar al montarlo a mano
# sobre python:slim. Pesa, pero evita una tarde de dependencias de X11.
FROM mcr.microsoft.com/playwright/python:v1.56.0-noble

WORKDIR /app

# Solo Chromium: los tres navegadores son ~1,2 GB y aqui con uno basta.
RUN python -m playwright install chromium --with-deps

# Ruta relativa al CONTEXTO de construccion, que con "Root Directory: escaner"
# en Railway ya ES esta carpeta. Escrito como "escaner/escanear.py" la
# construccion falla buscando escaner/escaner/escanear.py.
COPY escanear.py /app/escanear.py

# BACKEND_URL y SCANNER_KEY se definen como variables del servicio en Railway.
# SCANNER_KEY tiene que ser la misma que la del backend: es lo unico que
# autoriza a pedir trabajo.
ENV PYTHONUNBUFFERED=1
CMD ["python", "escanear.py", "--worker"]

# Worker del escaner (P4). Va en un SERVICIO APARTE del backend.
#
# La imagen oficial de Playwright ya trae Chromium y las librerias del
# sistema que necesita, que es la parte que suele fallar al montarlo a mano
# sobre python:slim. Pesa, pero evita una tarde de dependencias de X11.
FROM mcr.microsoft.com/playwright/python:v1.56.0-noble

WORKDIR /app

# La imagen trae los NAVEGADORES, no el paquete de Python: en ella
# "python -m playwright" responde "No module named playwright". Sin este
# pip install, la construccion se cae en la primera linea que lo invoque y,
# aunque no se cayera, "python escanear.py" moriria con un ImportError al
# arrancar. La version va clavada en requirements.txt a la misma que trae la
# imagen (1.56.0): si no coinciden, el paquete no encuentra los navegadores.
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt

# Red de seguridad, barata: si la imagen ya trae Chromium donde apunta
# PLAYWRIGHT_BROWSERS_PATH, esto no descarga nada y termina en un segundo.
# Sin --with-deps a proposito: las librerias de sistema ya estan en la imagen
# y esa opcion lanza un apt-get que aqui solo alarga la construccion.
RUN python -m playwright install chromium

# Ruta relativa al CONTEXTO de construccion, que con "Root Directory: escaner"
# en Railway ya ES esta carpeta. Escrito como "escaner/escanear.py" la
# construccion falla buscando escaner/escaner/escanear.py.
COPY escanear.py /app/escanear.py

# BACKEND_URL y SCANNER_KEY se definen como variables del servicio en Railway.
# SCANNER_KEY tiene que ser la misma que la del backend: es lo unico que
# autoriza a pedir trabajo.
ENV PYTHONUNBUFFERED=1
CMD ["python", "escanear.py", "--worker"]

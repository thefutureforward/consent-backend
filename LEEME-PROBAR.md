# Probar P4 y P5 en local, en diez minutos

Version corta para la pagina de pruebas. El detalle completo, con los casos
raros y el despliegue en Railway, esta en `docs/COMO-PROBAR-P4-P5.md`.

---

## 0. El tropiezo garantizado: cambia el siteId

`sitio-demo.html` trae un identificador escrito a mano que **no es el tuyo**:

```js
window.__consentConfig = {
  siteId:  "site_712fee55",      // <-- cambialo por el tuyo
  apiBase: "http://localhost:8000"
};
```

Si no lo cambias, el banner no carga su configuracion, la cookie de
consentimiento que el escaner fabrica no la lee nadie, y **las cuatro fases
daran lo mismo**. Parecera que P4 no funciona cuando el problema es este.

El `site_id` y la clave los imprime el backend la primera vez que arranca con
base nueva:

```
Sitio demo:
  site_id : site_4e0ee66e
  API key : pk_4c335ca17b3e475c2f38616ce7177db1
```

Si ya tienes base, estan en el panel (Instalar) o con:

```bash
python3 herramientas/ver-db.py sites      # Windows: python herramientas\ver-db.py sites
```

---

## 1. Instalar el escaner (una sola vez)

En Windows, donde pongo `python3` escribe `python` (o `py`).

El backend **no** necesita nada: es libreria estandar a proposito. El escaner si,
porque lleva Chromium, y por eso vive aparte.

```bash
cd escaner
pip install -r requirements.txt
playwright install chromium        # ~350 MB, un par de minutos
cd ..
```

---

## 2. Dos terminales

**Linux y macOS:**

```bash
SCANNER_KEY=prueba python3 backend.py
```

**Windows (PowerShell).** La sintaxis `VARIABLE=valor comando` es de bash y no
funciona aqui: la variable se pone en su propia linea, y el ejecutable suele
llamarse `python`, no `python3`.

```powershell
$env:SCANNER_KEY = "prueba"
python backend.py
```

Las variables de `$env:` duran lo que dure esa ventana de PowerShell. Si abres
otra terminal, hay que volver a ponerlas.

### Terminal B: el escaneo

```bash
# Linux y macOS
cd escaner
python3 escanear.py http://localhost:8000/sitio-demo.html site_TUYO pk_TUYA \
  http://localhost:8000 --paginas 4 --informe /tmp/informe.md
```

**Windows (PowerShell).** En una sola linea, y sin `/tmp/`, que ahi no existe:

```powershell
cd escaner
python escanear.py http://localhost:8000/sitio-demo.html site_TUYO pk_TUYA http://localhost:8000 --paginas 4 --informe informe.md
```

---

## 3. Que tiene que salir

**Cuatro lineas con numeros distintos.** Los valores exactos cambian segun tu
red; lo que importa es que **aceptado sea mayor que frio**:

```
  frio        4 paginas  cookies:  5  hosts: 11
  rechazado   4 paginas  cookies:  6  hosts: 11
  aceptado    4 paginas  cookies:  7  hosts: 12
  gpc         4 paginas  cookies:  6  hosts: 11
```

Si los cuatro dan lo mismo, vuelve al punto 0.

**Y despues tres bloques:**

```
LO QUE BUSCA EL VISITANTE SE FILTRA A TERCEROS, SIN PERMISO:
  static.ads-twitter.com             en el campo term
  www.google-analytics.com           en el campo ep.search_term

HUELLA DIGITAL antes de decidir (1 dominios):
  www.google-analytics.com           idioma, resolucion de pantalla, ...

IDENTIFICADORES enviados antes de decidir:
  www.google-analytics.com           cid, sid
```

**Lo que NO debe salir:** `fonts.googleapis.com` ni los CDN de Vimeo marcados
como receptores de huella o de identificadores. Si aparecen ahi, hay un falso
positivo y el informe no se le puede ensenar a un cliente.

---

## 4. Que mirar en el panel (P5)

Entra en **Cookies detectadas**:

- **`demo_sesion_servidor`** tiene que decir que *la pone el servidor en una
  cabecera y el banner no puede bloquearla*. Es HttpOnly, asi que mirando
  `document.cookie` a mano no la verias: esa es justo la gracia.
- **`demo_solo_si_acepta`** **no** debe llevar la insignia roja *"aparece sin
  permiso"*. Las demas si.
- **Ninguna** cookie sin clasificar puede salir con la explicacion vacia.
- Las sugerencias deducidas salen en ambar con *"deducido, confirmalo"*.

---

## 5. Lo mismo desde el panel, con worker

En vez de lanzarlo a mano:

```bash
# Terminal B, Linux y macOS
cd escaner
python3 escanear.py --worker --backend http://localhost:8000 --clave prueba
```

```powershell
# Terminal B, Windows
cd escaner
python escanear.py --worker --backend http://localhost:8000 --clave prueba
```

Y pulsa **Escanear el sitio** en Cookies detectadas. El estado se refresca solo
cada 4 segundos.

Sin `SCANNER_KEY` en el backend, el panel avisa de que no hay worker en vez de
dejarte esperando. Eso es lo correcto, no un fallo.

---

## 6. En Railway

Son **dos servicios**:

- **El tuyo de ahora**: anade la variable `SCANNER_KEY`.
- **Uno nuevo**: root `escaner`, con `BACKEND_URL` y **la misma** `SCANNER_KEY`.
  Sin dominio publico y con una sola replica.

Si el panel sigue diciendo *"No worker listening"*, las claves no coinciden. Es
el fallo mas comun y el unico que da ese mensaje exacto.

**Antes de probar en Railway**, comprueba que la base esta en un volumen: el
backend imprime su ruta al arrancar. Si no lo esta, se borra en cada despliegue
y con ella los registros de consentimiento.

---

## Aviso sobre la pagina de pruebas

`sitio-demo.html` **filtra datos a proposito**, imitando las fugas de un caso
real, para que el escaner tenga algo que encontrar. No la copies como ejemplo de
implementacion.

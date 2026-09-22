# Fase 3. Esqueleto de servicio (backend multi-tenant)

Convierte el banner de "script que instalas" en un servicio: un backend con base de datos que sirve la configuracion de cada sitio y guarda la prueba de cada consentimiento, mas un dashboard para gestionarlo. Es un esqueleto desplegable, listo para probar en local y para endurecer luego de cara a produccion.

## Decisiones tomadas por defecto (cambiables)

- **Stack:** Python de la libreria estandar. Corre con `py backend.py` sin instalar nada.
- **Base de datos:** SQLite (archivo `backend.db`). Migrable a Postgres al crecer.
- **Auth del dashboard:** login propio con contrasena hasheada (pbkdf2) y cookie de sesion.

Si prefieres otro stack (Node, FastAPI) o Postgres, la forma de los endpoints y de la base sigue igual; solo cambia la implementacion.

## Como ejecutarlo

```
py backend.py
```

Al primer arranque crea la base, un usuario y un sitio demo, e imprime las credenciales. Luego:

- Dashboard: `http://localhost:8000/dashboard`  (usuario `admin`, contrasena `admin`)
- Sitio demo: abre desde el dashboard, pestana Instalar, boton "Abrir sitio demo".

## Que probar

1. **Dashboard.** Entra con admin/admin. Veras el sitio demo. En la pestana Config esta su configuracion en JSON; cambiala (por ejemplo el color `accent`) y pulsa Guardar. En Instalar tienes el snippet listo para pegar. En Registros ves los consentimientos con sus conteos.
2. **Config remota.** Abre el sitio demo (pestana Instalar, "Abrir sitio demo"). Esa pagina NO lleva colores ni textos: solo el `site_id` y el `apiBase`. El banner descarga su config del backend. Si cambiaste el color en el paso 1 y recargas, lo veras aplicado sin tocar la pagina.
3. **Consent logging.** Acepta o rechaza en el sitio demo y vuelve a Registros en el dashboard: aparece una fila nueva. El registro es append-only.

## Endpoints

Publico (con CORS, para el banner en cualquier sitio):

- `GET /api/config?site_id=...` devuelve la config de ese sitio (mas su clave publica).
- `POST /api/consent` registra un consentimiento. Requiere la cabecera `X-Api-Key` con la clave publica del sitio. Sin clave valida responde 401.

Dashboard (requiere login):

- `POST /dash/login`, `POST /dash/logout`, `GET /dash/me`
- `POST /dash/site/create`
- `GET /dash/site/get?site_id=...`, `POST /dash/site/save`
- `GET /dash/site/logs?site_id=...`

## La base de datos

- `sites`: cada sitio o cliente (site_id, nombre, dominio, plan).
- `api_keys`: claves publicas que autentican las llamadas de consent de cada sitio.
- `site_config`: la configuracion editable de cada sitio, con version.
- `consent_logs`: un registro por decision. **Append-only:** solo se inserta, nunca se modifica ni se borra. Es la prueba legal (art. 7 del RGPD; precedente Criteo).
- `users`, `sessions`, `site_owners`: login del dashboard y a que cuenta pertenece cada sitio (aislamiento multi-tenant).

Todas las consultas se filtran por `site_id`, y las de dashboard por la cuenta, de modo que un cliente nunca ve datos de otro.

## Que falta para produccion (esto es un esqueleto)

- HTTPS y secretos fuera del codigo.
- Endurecer el login (rotacion de sesiones, limite de intentos) o usar un proveedor (Auth0, Clerk).
- Mover `consent_logs` a una base con retencion y copias de seguridad; considerar Postgres.
- Rate limiting en los endpoints publicos.
- Servir el bundle desde el CDN definitivo (aqui se sirve local para la demo).
- White-label: hoy la marca va en la config de cada sitio; falta el dominio propio por cliente.

## Como encaja con lo anterior

Es la evolucion del `consent-server.py` de la Fase 1.5: misma forma de payload y respuesta de consentimiento, pero ahora con base de datos, config por sitio y validacion por `site_id` + clave. El bundle ya viene preparado: si su config lleva `siteId` y `apiBase`, descarga la config remota y envia el consentimiento a este backend.

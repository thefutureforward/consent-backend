# forward-consent

Banner de consentimiento universal y embebible. Google Consent Mode v2 denegado por defecto, borrado activo de cookies al rechazar, aislado en Shadow DOM, sin dependencias. Funciona en cualquier web y cualquier alojamiento, con o sin Google Tag Manager.

> El nombre del paquete (`forward-consent`) y el `namespace` por defecto (`consent`) son provisionales. Cambialos por tu marca antes de publicar.

## Que trae el build

| Archivo | Formato | Uso |
|---|---|---|
| `dist/consent-banner.esm.js` | ESM, sin efectos secundarios | bundlers y frameworks (import) |
| `dist/consent-banner.umd.js` | IIFE, `window.ConsentBanner`, auto-init | etiqueta script |
| `dist/consent-banner.min.js` | IIFE minificado | CDN (unpkg / jsDelivr) |
| `dist/react.esm.js` | ESM, `react` como peer | wrapper de React |
| `dist/consent-banner.d.ts` | tipos | TypeScript |

El build escapa `</script>` en todas las salidas, para que el bundle se pueda incrustar inline dentro de un `<script>` sin cerrar la etiqueta antes de tiempo.

El unico origen del codigo es `src/core.js`. El backend de la Fase 3 no tiene su propia copia: sirve el bundle minificado que sale de aqui. Para copiarlo al backend en el mismo build:

```bash
BACKEND_DIR=../consent-backend npm run build
```

Eso deja `dist/consent-banner.min.js` tambien como `consent-banner.js` del backend. Ese archivo es generado: no se edita a mano.

## Uso 0: config remota (servicio de la Fase 3)

Si la config lleva `siteId` y `apiBase`, el banner pide su configuracion al backend y envia ahi el consentimiento. La pagina del cliente no lleva colores ni textos:

```html
<script>window.__consentConfig = { siteId: "site_xxxx", apiBase: "https://tu-backend" };</script>
<script async src="https://tu-backend/consent-banner.js"></script>
```

Cambiar la config en el dashboard se ve en el sitio al recargar, sin tocar su HTML. Sin `siteId` y `apiBase`, el banner funciona igual con la config local de siempre.

## Uso 1: etiqueta script (cualquier web, con o sin GTM)

Modelo de dos partes. El stub va en el `<head>` (fija Consent Mode denegado y evita el parpadeo); el bundle se carga async.

```html
<head>
  <!-- Parte A: stub inline. Antes de GTM. -->
  <script>
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied",
      ad_personalization: "denied", functionality_storage: "denied",
      personalization_storage: "denied", wait_for_update: 500
    });
    try {
      var m = document.cookie.match(/(?:^|; )consent_cookie_consent=([^;]+)/);
      if (m) gtag("consent", "update", JSON.parse(decodeURIComponent(m[1])).signals);
    } catch (e) {}
    // aqui cargaria GTM
  </script>

  <!-- Parte B: config + bundle -->
  <script>
    window.__consentConfig = {
      namespace: "consent",
      gtmId: "GTM-XXXXXXX",          // vacio = modo sin GTM
      endpoint: "/api/cookie-consent", // vacio = sin auditoria
      consentVersion: "2025-01",
      defaultLanguage: "es",
      cookie: { lifetimeMonths: 6 },
      colors: { ink: "#14243D", accent: "#2E7D74", text: "#E7ECF3" }
    };
  </script>
  <script async src="https://cdn.jsdelivr.net/npm/forward-consent"></script>
</head>
```

## Uso 2: npm + bundler (Vue, Angular, vanilla)

```js
import { start, open } from "forward-consent";

start({
  gtmId: "GTM-XXXXXXX",
  endpoint: "/api/cookie-consent",
  defaultLanguage: "es",
  onConsentChange: (c) => console.log("consent:", c.choice)
});

// reabrir preferencias desde un boton del footer:
document.querySelector("#cookie-prefs").addEventListener("click", open);
```

En Vue llama `start(config)` en `onMounted`; en Angular, en `ngOnInit`.

## Uso 3: React

```jsx
import ConsentBanner, { open } from "forward-consent/react";

export default function App() {
  return (
    <>
      <ConsentBanner config={{ gtmId: "GTM-XXXXXXX", defaultLanguage: "es" }} />
      <footer><button onClick={open}>Configurar cookies</button></footer>
    </>
  );
}
```

## Configuracion

Todas las opciones de `window.__consentConfig` o del argumento de `start()`:

| Opcion | Por defecto | Que hace |
|---|---|---|
| `namespace` | `"consent"` | prefijo de cookie y de eventos dataLayer |
| `gtmId` | `""` | id de GTM; vacio = modo sin GTM |
| `endpoint` | `""` | URL de auditoria; vacio = sin backend |
| `sessionId` | `null` | id de sesion que se envia en la auditoria |
| `consentVersion` | `"2025-01"` | al cambiar, se vuelve a preguntar |
| `defaultLanguage` | `"es"` | `"es"` o `"en"` |
| `cookie.lifetimeMonths` | `6` | duracion del consentimiento |
| `colors` | ink/accent/text | branding |
| `activeDeletion` | `true` | borrar cookies de analitica al rechazar |
| `categories` | necessary/statistics/marketing | categorias y su mapeo a senales |
| `onConsentChange` | `null` | callback al decidir |

API: `start(config)`, `open()`, `reset()`, `setLanguage(lang)`.

## Desarrollo

```
npm install
npm run build     # genera dist/ con esbuild y escapa </script>
```

## Bloqueo manual de scripts (sitios sin GTM)

Para sitios sin GTM, el banner puede bloquear scripts de terceros hasta el consentimiento. Marca cada script en tu HTML asi:

```html
<!-- no se ejecuta hasta que se concede 'statistics' -->
<script type="text/plain" data-consent-category="statistics"
        data-src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>

<!-- tambien vale script inline -->
<script type="text/plain" data-consent-category="marketing">
  fbq('init', '000000000000');
</script>
```

Y activa la opcion:

```js
start({ manageScripts: true, defaultLanguage: "es" });
```

Al conceder una categoria, el banner convierte sus scripts `text/plain` en scripts ejecutables (por `data-src` o por contenido inline). Nota: un script ya ejecutado no se puede "desejecutar"; si el usuario rechaza despues de aceptar, se aplica el borrado activo de cookies y conviene recargar. La categoria `necessary` (locked) se activa siempre.

## Plantilla de Google Tag Manager

En `gtm/consent-banner.tpl` hay una plantilla de tag para GTM. Importala en Plantillas, crea un tag con ella y dispáralo en el trigger **Consent Initialization - All Pages**. La plantilla fija Consent Mode denegado por defecto, reaplica la decision previa desde la cookie y carga el bundle. Es la alternativa "GTM-native" al snippet de dos partes; usa una u otra, no las dos.

## Antes de publicar en npm

Cambia el nombre del paquete y el `namespace` por defecto (ahora `forward-consent` y `consent`), y decide el registro (npm publico, privado, o un CDN propio).

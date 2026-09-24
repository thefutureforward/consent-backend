___TERMS_OF_SERVICE___

By creating or editing this template you agree to the Google Tag Manager Community Template Gallery Developer Terms of Service.

___INFO___

{
  "type": "TAG",
  "id": "cvt_consent_banner",
  "version": 1,
  "securityGroups": [],
  "displayName": "Consent Banner (CMP)",
  "brand": {
    "id": "your-org",
    "displayName": "Your Org"
  },
  "description": "Banner de consentimiento universal. Fija Google Consent Mode v2 denegado por defecto, reaplica la decision previa guardada en la cookie de primera parte y carga el bundle del banner. Dispararlo en el trigger Consent Initialization - All Pages.",
  "categories": ["UTILITY", "TAG_MANAGEMENT"],
  "containerContexts": ["WEB"]
}

___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "bundleUrl",
    "displayName": "URL del bundle (CDN)",
    "simpleValueType": true,
    "defaultValue": "https://cdn.jsdelivr.net/npm/@your-org/consent-banner",
    "valueValidators": [{ "type": "NON_EMPTY" }]
  },
  {
    "type": "TEXT",
    "name": "namespace",
    "displayName": "Namespace (prefijo de cookie y eventos)",
    "simpleValueType": true,
    "defaultValue": "fwc_consent"
  },
  {
    "type": "TEXT",
    "name": "waitForUpdate",
    "displayName": "wait_for_update (ms)",
    "simpleValueType": true,
    "defaultValue": "500"
  },
  {
    "type": "TEXT",
    "name": "region",
    "displayName": "Regiones (opcional, ISO separadas por coma, ej. ES,FR)",
    "simpleValueType": true,
    "defaultValue": ""
  },
  {
    "type": "TEXT",
    "name": "endpoint",
    "displayName": "Endpoint de auditoria (opcional)",
    "simpleValueType": true,
    "defaultValue": ""
  },
  {
    "type": "SELECT",
    "name": "defaultLanguage",
    "displayName": "Idioma por defecto",
    "macrosInSelect": false,
    "selectItems": [
      { "value": "es", "displayValue": "Espanol" },
      { "value": "en", "displayValue": "English" }
    ],
    "simpleValueType": true,
    "defaultValue": "es"
  },
  {
    "type": "TEXT",
    "name": "consentVersion",
    "displayName": "Version del texto de consentimiento",
    "simpleValueType": true,
    "defaultValue": "2025-01"
  },
  {
    "type": "TEXT",
    "name": "siteId",
    "displayName": "site_id (servicio gestionado, opcional)",
    "help": "Con site_id y apiBase, el banner descarga su configuracion del backend y envia ahi el consentimiento. Vacio = config local de este tag.",
    "simpleValueType": true,
    "defaultValue": ""
  },
  {
    "type": "TEXT",
    "name": "apiBase",
    "displayName": "apiBase del servicio (opcional)",
    "help": "URL del backend, sin barra final. Ej: https://consent.tudominio.com",
    "simpleValueType": true,
    "defaultValue": ""
  }
]

___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const setDefaultConsentState = require('setDefaultConsentState');
const updateConsentState = require('updateConsentState');
const getCookieValues = require('getCookieValues');
const decodeUriComponent = require('decodeUriComponent');
const injectScript = require('injectScript');
const setInWindow = require('setInWindow');
const JSON = require('JSON');
const makeInteger = require('makeInteger');

const ns = data.namespace || 'consent';
const cookieName = ns + '_cookie_consent';

// 1. Consent Mode v2: todo denegado por defecto, antes que cualquier tag.
const def = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
  wait_for_update: makeInteger(data.waitForUpdate || 500)
};
if (data.region) {
  def.region = data.region.split(',');
}
setDefaultConsentState(def);

// 2. Reaplicar la decision previa guardada en la cookie (sin parpadeo).
const vals = getCookieValues(cookieName);
if (vals && vals.length > 0) {
  const prev = JSON.parse(decodeUriComponent(vals[0]));
  if (prev && prev.signals) {
    updateConsentState(prev.signals);
  }
}

// 3. Pasar config al bundle y cargarlo.
const cfg = {
  namespace: ns,
  endpoint: data.endpoint || '',
  defaultLanguage: data.defaultLanguage || 'es',
  consentVersion: data.consentVersion || '2025-01'
};
// Servicio gestionado (Fase 3): el banner pide su config al backend.
if (data.siteId && data.apiBase) {
  cfg.siteId = data.siteId;
  cfg.apiBase = data.apiBase;
}
setInWindow('__consentConfig', cfg, true);

injectScript(data.bundleUrl, data.gtmOnSuccess, data.gtmOnFailure, 'consent-banner');

___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": { "publicId": "access_consent", "versionId": "1" },
      "param": [
        {
          "key": "consentTypes",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"ad_storage"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"ad_user_data"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"ad_personalization"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"analytics_storage"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"functionality_storage"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"personalization_storage"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"consentType"}, {"type":1,"string":"read"}, {"type":1,"string":"write"} ], "mapValue": [ {"type":1,"string":"security_storage"}, {"type":8,"boolean":false}, {"type":8,"boolean":true} ] }
            ]
          }
        }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "get_cookies", "versionId": "1" },
      "param": [
        { "key": "cookieAccess", "value": { "type": 1, "string": "any" } }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "inject_script", "versionId": "1" },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 1, "string": "https://cdn.jsdelivr.net/*" },
              { "type": 1, "string": "https://unpkg.com/*" }
            ]
          }
        }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "access_globals", "versionId": "1" },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 3, "mapKey": [ {"type":1,"string":"key"}, {"type":1,"string":"read"}, {"type":1,"string":"write"}, {"type":1,"string":"execute"} ], "mapValue": [ {"type":1,"string":"__consentConfig"}, {"type":8,"boolean":true}, {"type":8,"boolean":true}, {"type":8,"boolean":false} ] },
              { "type": 3, "mapKey": [ {"type":1,"string":"key"}, {"type":1,"string":"read"}, {"type":1,"string":"write"}, {"type":1,"string":"execute"} ], "mapValue": [ {"type":1,"string":"dataLayer"}, {"type":8,"boolean":true}, {"type":8,"boolean":true}, {"type":8,"boolean":false} ] }
            ]
          }
        }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  }
]

___TESTS___

scenarios:
- name: Fija Consent Mode denegado por defecto y carga el bundle
  code: |-
    const mockData = {
      bundleUrl: 'https://cdn.jsdelivr.net/npm/forward-consent',
      namespace: 'fwc_consent',
      waitForUpdate: '500',
      defaultLanguage: 'es',
      consentVersion: '2025-01'
    };
    let estado;
    mock('setDefaultConsentState', (s) => { estado = s; });
    mock('injectScript', (url, onSuccess) => { onSuccess(); });

    runCode(mockData);

    assertThat(estado.ad_storage).isEqualTo('denied');
    assertThat(estado.analytics_storage).isEqualTo('denied');
    assertThat(estado.ad_user_data).isEqualTo('denied');
    assertThat(estado.ad_personalization).isEqualTo('denied');
    assertThat(estado.security_storage).isEqualTo('granted');
    assertThat(estado.wait_for_update).isEqualTo(500);
    assertApi('gtmOnSuccess').wasCalled();

- name: Reaplica la decision guardada en la cookie
  code: |-
    const mockData = {
      bundleUrl: 'https://cdn.jsdelivr.net/npm/forward-consent',
      namespace: 'fwc_consent',
      waitForUpdate: '500'
    };
    mock('getCookieValues', () => {
      return ['%7B%22signals%22%3A%7B%22analytics_storage%22%3A%22granted%22%2C%22ad_storage%22%3A%22denied%22%7D%7D'];
    });
    let actualizado;
    mock('updateConsentState', (s) => { actualizado = s; });
    mock('injectScript', (url, onSuccess) => { onSuccess(); });

    runCode(mockData);

    assertThat(actualizado.analytics_storage).isEqualTo('granted');
    assertThat(actualizado.ad_storage).isEqualTo('denied');

- name: Con site_id y apiBase pasa la config remota al bundle
  code: |-
    const mockData = {
      bundleUrl: 'https://consent.ejemplo.com/consent-banner.js',
      namespace: 'fwc_consent',
      waitForUpdate: '500',
      siteId: 'site_abc123',
      apiBase: 'https://consent.ejemplo.com'
    };
    let escrito;
    mock('setInWindow', (key, value) => { escrito = value; });
    mock('injectScript', (url, onSuccess) => { onSuccess(); });

    runCode(mockData);

    assertThat(escrito.siteId).isEqualTo('site_abc123');
    assertThat(escrito.apiBase).isEqualTo('https://consent.ejemplo.com');

___NOTES___

Como usar:
1. En GTM: Plantillas -> Nueva -> importar este archivo .tpl.
2. Crear un tag con esta plantilla y dispararlo en el trigger "Consent Initialization - All Pages".
3. Rellenar la URL del bundle (CDN) y el namespace (que debe coincidir con el de la cookie del banner).
4. En cada tag de Analytics/Ads, activar Consent Settings con la senal correspondiente.

Servicio gestionado (Fase 3): rellenar site_id y apiBase. El banner pedira su
configuracion a ese backend, y los cambios del dashboard se veran en el sitio sin
volver a publicar el contenedor.

PERMISOS. Al importar, GTM pedira aprobarlos. Dos cosas que revisar en la pestana
Permissions antes de guardar:
- Inject script: la lista trae jsdelivr y unpkg. Si el bundle se sirve desde el
  propio backend (lo normal con el servicio gestionado), hay que anadir ese
  dominio o injectScript lo bloqueara en silencio.
- Globals: __consentConfig necesita read Y write. setInWindow con sobrescritura
  comprueba "readwrite"; con solo write, el tag falla en ejecucion.
- Cookies: hoy pide acceso "any". Restringirlo al nombre real de la cookie
  (fwc_consent_cookie_consent (namespace por defecto: fwc_consent)) es lo minimo necesario y lo que espera la revision
  de la galeria de plantillas.

TESTS. Los tres escenarios de la seccion ___TESTS___ se ejecutan desde el propio
editor de plantillas (boton Run Tests). Cubren el default denegado, la reaplicacion
de la cookie previa y el paso de la config remota.

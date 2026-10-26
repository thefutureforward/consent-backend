# Informe tecnico de cesion de datos a terceros

Sitio: **http://localhost:8000/sitio-demo.html**  
Fecha: 2026-10-21 14:39  

Termino de busqueda usado para detectar filtraciones: `zqx9d6b8bf9`


Este informe recoge lo observado por un navegador real en varias visitas al sitio, una por cada estado de consentimiento. No es un dictamen legal.


## Resumen

| Dato | Valor |
|---|---|
| Terceros contactados sin que nadie consienta | **5** |
| Terceros que siguen activos tras rechazar | **5** |
| Terceros que reciben el termino buscado | **2** |
| Terceros que reciben datos de huella | **1** |
| Cookies distintas observadas | 7 |

## 1. Cronologia: primer contacto con cada tercero, por fase


**Sin decidir (nadie ha consentido)**

| Segundo | Dominio | Peticiones |
|---|---|---|
| 0.8 s | player.vimeo.com | 5 |
| 1.1 s | www.google-analytics.com | 11 |
| 1.2 s | fonts.googleapis.com | 5 |
| 3.9 s | fonts.gstatic.com | 10 |
| 22.3 s | static.ads-twitter.com | 1 |

**Tras rechazar**

| Segundo | Dominio | Peticiones |
|---|---|---|
| 0.5 s | player.vimeo.com | 5 |
| 0.8 s | www.google-analytics.com | 11 |
| 0.9 s | fonts.googleapis.com | 5 |
| 1.2 s | fonts.gstatic.com | 5 |
| 22.2 s | static.ads-twitter.com | 1 |

**Tras aceptar**

| Segundo | Dominio | Peticiones |
|---|---|---|
| 0.5 s | player.vimeo.com | 21 |
| 0.7 s | www.google-analytics.com | 11 |
| 0.8 s | fonts.googleapis.com | 5 |
| 1.1 s | fonts.gstatic.com | 5 |
| 1.4 s | f.vimeocdn.com | 25 |
| 1.4 s | i.vimeocdn.com | 10 |
| 1.6 s | connect.facebook.net | 5 |
| 2.2 s | vimeo.com | 2 |
| 2.5 s | vod-adaptive-ak.vimeocdn.com | 5 |
| 2.5 s | arclight.vimeo.com | 10 |
| 22.0 s | static.ads-twitter.com | 1 |

**Con senal GPC (lo que ve una herramienta externa)**

| Segundo | Dominio | Peticiones |
|---|---|---|
| 0.5 s | player.vimeo.com | 5 |
| 0.7 s | www.google-analytics.com | 11 |
| 0.8 s | fonts.googleapis.com | 5 |
| 1.2 s | fonts.gstatic.com | 5 |
| 22.2 s | static.ads-twitter.com | 1 |

## 2. Que recibio cada tercero antes de que nadie consintiera

| Dominio | Identificadores | Huella | Termino buscado |
|---|---|---|---|
| static.ads-twitter.com | - | - | term |
| www.google-analytics.com | cid, sid | idioma del navegador, resolucion de pantalla, sistema operativo | ep.search_term, dl |
| fonts.googleapis.com | - | - | - |
| fonts.gstatic.com | - | - | - |
| player.vimeo.com | - | - | - |

## 3. Filtracion del termino de busqueda

Se busco `zqx9d6b8bf9` en el sitio. Aparecio en peticiones a:

| Dominio | Campo | Valor observado |
|---|---|---|
| static.ads-twitter.com | `term` | zqx9d6b8bf9 |
| www.google-analytics.com | `ep.search_term` | zqx9d6b8bf9 |
| www.google-analytics.com | `dl` | http://localhost:8000/sitio-demo.html?q=zqx9d6b8bf9 |

## 4. Cookies observadas y en que fase aparecen

| Cookie | Dominio | Parte | HttpOnly | Fases |
|---|---|---|---|---|
| __cf_bm | vimeo.com | tercero | si | aceptado |
| __cf_ob | player.vimeo.com | tercero | no | aceptado |
| cf_clearance | vimeo.com | tercero | si | aceptado |
| vuid | vimeo.com | tercero | no | aceptado |
| demo_sesion_servidor | localhost | propia | si | frio, rechazado, aceptado, gpc |
| demo_solo_si_acepta | localhost | propia | no | aceptado |
| fwc_consent_cookie_consent | localhost | propia | no | gpc |

## 5. Huella digital

Caracteristicas del dispositivo enviadas sin consentimiento. Combinadas permiten reconocer el navegador sin cookies.


**www.google-analytics.com**

| Caracteristica | Valor observado |
|---|---|
| idioma del navegador | es-ES |
| resolucion de pantalla | 1366x768 |
| sistema operativo | Win32 |

## 6. Diferencia entre aceptar y rechazar

| Fase | Terceros |
|---|---|
| Sin decidir | 5 |
| Tras rechazar | 5 |
| Tras aceptar | 11 |

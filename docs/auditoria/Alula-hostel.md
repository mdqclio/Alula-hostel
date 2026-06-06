# Auditoría de readiness para producción — Alula-hostel

- **Repo:** `Alula-hostel` (github.com/mdqclio/Alula-hostel)
- **Fecha:** 2026-06-06
- **Stack:** App web SPA estática (HTML + JS ES modules vanilla, sin framework ni
  build) servida sobre Firebase. Backend: Firebase Realtime Database (RTDB),
  Firebase Auth (email/password) y **una** Cloud Function v2 HTTP (`cotizar`,
  Node 20). Single-tenant (`alula`). Chatbot/OCR contra la API de Groq.

**Leyenda:** 🟢 ok · 🟡 mejorable · 🔴 bloqueante.

> Alcance: SOLO diagnóstico. No se modificó código de la app ni se hicieron commits.

---

## 1. Front comprimido, sin source maps, sin secretos en cliente — 🔴

**No hay pipeline de build.** No existe minificación, bundling ni source maps
(no hay terser/webpack/rollup/esbuild en `package.json`, no hay `dist/`, ni
`*.map`); el JS se sirve crudo desde `js/*.js`. La `apiKey` de Firebase en
`js/firebase-config.js` es **pública por diseño** y no cuenta como secreto.

**El problema real es un secreto de terceros que termina en el cliente:** la
**API key de Groq** se guarda en RTDB (`alula/secrets/groqApiKey`), el front la
descarga y la usa directamente desde el navegador:
- `js/chatbot.js` la lee, la cachea en `localStorage` (`alula_groq_key`) y la
  manda en `Authorization: Bearer` a `api.groq.com` desde el browser.
- `js/huespedes.js:243` (OCR) hace lo mismo.

Cualquiera con sesión (o que inspeccione la red / `localStorage`) obtiene la key
de Groq en texto plano.

**Riesgo:** robo de la API key de Groq → uso/gasto a cargo del hostel, abuso del
modelo. Front sin minificar es menor; el secreto en cliente es bloqueante.

---

## 2. Base con RLS: cada usuario solo sus datos — 🔴

**No hay aislamiento por usuario.** Las reglas RTDB **desplegadas** son
efectivamente modo abierto-autenticado (ver `firebase.rules.current.json` en la
rama `chore/firebase-rules`):

```json
{ "rules": { ".read": "auth != null", ".write": "auth != null" } }
```

Cualquier usuario autenticado (los ~4 del staff) lee y escribe **todo** el árbol
`alula`: huéspedes con PII, reservas, caja/contabilidad, `usuarios`, y
`secrets` (la key de Groq). No existe el concepto de "cada usuario solo sus
datos"; es un único tenant compartido. Los roles (admin/recepción/ventas/
limpieza) se aplican **solo en la UI** (mostrar/ocultar con CSS), no en reglas
→ vía consola/REST cualquier autenticado salta los permisos.

Existe una propuesta endurecida (`firebase.rules.proposed.json`, rama
`chore/firebase-rules`) con nodos `secrets`/`admins` solo-admin y validación,
pero: (a) **no está en `main`**, (b) **no está desplegada**, (c) trae un bloque
`__notas` que la hace no desplegable tal cual, y (d) depende de 12 follow-ups de
migración aún pendientes (índice por uid, `preRegistros`, etc.).

**Riesgo:** exposición total de PII y secretos a cualquier cuenta comprometida;
sin segmentación real. Bloqueante.

---

## 3. Git sin secretos en historial — 🟢

Revisado `git log -p --all` (83 commits). **No se encontró ningún secreto de
terceros con su valor** en el historial: no hay `gsk_…` real, ni `sk-…`, ni
tokens Twilio (`AC…`), ni JSON de service-account, ni claves privadas. Las
únicas menciones a `groqApiKey` describen **dónde vive** (en RTDB) y cómo
migrarla, no el valor. La `apiKey` de Firebase presente es pública.

`.gitignore` cubre `.env`, `*.key`, `secrets.json`, `.firebaserc`,
`firebase-debug.log`. `functions/.gitignore` ignora `.env`.

**Riesgo:** bajo. (El secreto vive en RTDB, no en git — eso se trata en #1/#2.)

---

## 4. APIs (Cloud Functions) con auth, permisos y validación — 🟡

Solo hay una API server-side: la Cloud Function `cotizar`
(`functions/index.js`).

**Bien:**
- Auth por header `x-api-key` comparado contra un secreto de **GCP Secret
  Manager** (`COTIZADOR_API_KEY`, vía `defineSecret`) — no hardcodeado.
- Rechaza métodos ≠ POST (405) y tenant fuera de la whitelist (`ALLOWED_TENANTS`).
- La lógica pura (`cotizador.service.js`) **valida entradas**: formato ISO de
  fechas, salida > entrada, no fechas pasadas, `cantidadCamas` vs disponibles.
- No filtra stack traces (500 genérico).

**Flojo:**
- La comparación de la api-key es `!==` directo (no constant-time) — fuga por
  timing teórica.
- `invoker: 'public'` + sin CORS explícito ni App Check.
- Sin rate limiting (ver #7).
- La validación del **cliente** es desigual: el form público de huéspedes
  (`submitPublicRegistration`) solo chequea 4 campos no-vacíos y empuja el
  objeto a RTDB sin sanitizar longitudes/tipos (la validación por reglas que lo
  acotaría está en la propuesta no desplegada).

**Riesgo:** medio. El endpoint de cotización está razonablemente protegido; el
hueco está en el path de escritura del cliente sin reglas de validación.

---

## 5. Hosting/despliegue, entornos separados, variables de entorno — 🔴

- **`firebase.json` solo declara `functions`** — no hay bloque `hosting` ni
  `database`/`storage` rules referenciadas. El hosting del front no está
  versionado/definido en el repo (se sirve por fuera o a mano).
- **Las reglas de RTDB no están cableadas en `firebase.json`** → no se despliegan
  reglas de forma reproducible; viven como archivos sueltos en una rama.
- **Un solo proyecto, sin separación de entornos.** No hay `staging`/`prod`, ni
  `.firebaserc` versionado, ni `NODE_ENV`/`process.env` en el código. Se trabaja
  directo sobre el proyecto productivo `alula-hostel`.
- Variables de entorno: solo el secreto de la Function vive en Secret Manager
  (bien). El resto de "config" sensible (key de Groq) vive en la DB de prod.

**Riesgo:** alto. Cualquier prueba impacta producción; los despliegues no son
reproducibles ni revisables.

---

## 6. Seguridad: login, sesiones, vulns comunes (XSS, authz real) — 🔴

**Login/sesiones — aceptable:** usa Firebase Auth (`signInWithEmailAndPassword`),
sesión persistida y restaurada (`onAuthStateChanged`), cambio de contraseña con
re-autenticación. `too-many-requests` manejado por Firebase. Históricamente se
guardaban contraseñas en texto plano en `alula/usuarios[].pass`; el código que
las persistía fue removido en una rama, pero **el dato viejo solo se limpia
manualmente** (no verificado en prod) y la rama no está en `main`.

**Authz — falsa:** los permisos por rol son **solo cosméticos** (CSS/UI en
`applyRoleUI`). Sin enforcement en reglas ni Custom Claims, cualquier
autenticado escribe cualquier nodo (ver #2).

**XSS — riesgo presente:** 73 usos de `innerHTML` con template literals. Hay un
helper `escapeHtml` aplicado en varios módulos (knowledge, huespedes, listanegra,
reservas, caja, contabilidad, auditoria), lo cual es bueno, **pero**:
- El `escapeHtml` de `js/chatbot.js` solo escapa `& < >` (no comillas), y el
  chatbot renderiza salida del LLM con `innerHTML` tras un formateo markdown
  → contenido no totalmente confiable inyectado como HTML.
- Quedan datos de usuario dentro de atributos `onclick="…"` (p. ej.
  `js/huespedes.js`, `js/reservas.js`) donde el escape de entidades HTML no es el
  correcto para un string en contexto JS → vector de inyección.

**Riesgo:** alto. Authz inexistente a nivel de datos + XSS plausible vía
salida del LLM y atributos inline.

---

## 7. Rate limiting en endpoints caros — 🔴

- La Cloud Function `cotizar` (lee 3 nodos de RTDB por request) **no tiene rate
  limiting** ni App Check; es `invoker: 'public'` protegida solo por la api-key
  compartida.
- Las llamadas a **Groq** (chatbot + OCR) salen **desde el cliente** con la key
  compartida: no hay throttling server-side, solo un debounce de 800 ms en el
  front (`sendMessage`), trivialmente evitable. Quien tenga la key puede agotar
  la cuota.
- El form público de huéspedes puede ser spameado (push masivo) — sin App Check
  ni límites.

**Riesgo:** alto en costo. Endpoints caros (LLM, lecturas RTDB) sin contención.

---

## 8. Caché donde haga falta — 🟡

- El front tiene una **caché en memoria** (`cache`/`DB` en `firebase-config.js`):
  carga el árbol entero una vez y lee de memoria. Funciona para una SPA chica.
- La key de Groq se cachea en `localStorage` (problema de seguridad, no de perf).
- **No hay caché server-side** en la Function: cada cotización re-lee
  reservas/camasConfig/config de RTDB sin TTL ni memoización.
- Sin headers de caché/CDN definidos (no hay config de hosting).

**Riesgo:** bajo a escala actual; mejorable si crece el tráfico de cotización.

---

## 9. Escalabilidad — 🟡

- **Modelo de datos no escala:** `loadAllData()` lee el nodo `alula` **completo**
  en cada arranque/login; las escrituras reescriben **arrays enteros**
  (`DB.set('huespedes', arrayCompleto)`, ídem `reservas`, `usuarios`). Esto crece
  linealmente y genera condiciones de carrera (último en escribir gana).
- **Fotos de documentos en base64 dentro de RTDB** (campo `foto`) inflan el árbol
  y encarecen toda lectura — deberían ir a Cloud Storage + URL.
- La Function es stateless y autoescala (bien), pero relee todo el set de
  reservas por request.
- Single-tenant hardcodeado (`ALLOWED_TENANTS = {'alula'}`).

**Riesgo:** medio. Aguanta el tamaño de un hostel; no aguanta crecimiento de
datos/usuarios ni concurrencia real.

---

## 10. Monitoreo de errores/rendimiento/gasto con alertas — 🔴

- **Sin monitoreo de errores en el front:** no hay Sentry/Crashlytics ni
  reporting; los errores van a `console.error` y se pierden.
- **Sin analytics/RUM** de rendimiento.
- **Sin alertas de gasto/cuota:** ni en Firebase (budget alerts), ni en Groq, ni
  en la Function. Dado que la key de Groq está expuesta y sin rate limit (#1, #7),
  un abuso no dispararía ninguna alerta.
- La Function solo usa `console.error` → Cloud Logging por defecto, sin alertas
  configuradas en el repo.
- Existe un audit log **funcional propio** (`logAuditoria` → nodo `auditoria`),
  útil para trazabilidad de acciones, pero **no** es monitoreo de errores ni de
  rendimiento ni de costo.

**Riesgo:** alto. Un incidente (fuga de key, pico de gasto, caída) pasaría
inadvertido hasta ver la factura.

---

## Tabla resumen

| # | Punto | Estado |
|---|-------|--------|
| 1 | Front comprimido, sin source maps, sin secretos en cliente | 🔴 |
| 2 | Base con RLS (cada usuario solo sus datos) | 🔴 |
| 3 | Git sin secretos en historial | 🟢 |
| 4 | APIs/Cloud Functions con auth, permisos y validación | 🟡 |
| 5 | Hosting/despliegue, entornos separados, variables de entorno | 🔴 |
| 6 | Seguridad: login, sesiones, XSS, authz real | 🔴 |
| 7 | Rate limiting en endpoints caros | 🔴 |
| 8 | Caché donde haga falta | 🟡 |
| 9 | Escalabilidad | 🟡 |
| 10 | Monitoreo de errores/rendimiento/gasto con alertas | 🔴 |

**Conteo:** 🟢 1 · 🟡 3 · 🔴 6.

---

## Los 3 arreglos más urgentes

1. **Sacar la API key de Groq del cliente.** Hoy el chatbot y el OCR descargan la
   key de Groq desde RTDB y la usan desde el browser (queda en `localStorage` y
   en la red). Mover esas llamadas a una Cloud Function (como ya se hizo con
   `cotizar`), con la key en Secret Manager; el front nunca debe ver la key.
   Rotar la key actual porque ya estuvo expuesta.

2. **Desplegar reglas RTDB reales y cablearlas en `firebase.json`.** Las reglas
   en producción son `auth != null` para todo el árbol: cualquier cuenta lee/
   escribe PII, caja y `secrets`. Mergear la propuesta endurecida (quitando el
   bloque `__notas`), referenciarla en `firebase.json` (`"database": {"rules":
   …}`) y completar los follow-ups mínimos (nodo `admins`, `secrets` solo-admin,
   `preRegistros` para el form público). Sin esto no hay authz real.

3. **Separar entornos + monitoreo/alertas de gasto.** Crear un proyecto
   `staging` y dejar de operar contra prod a mano; versionar `.firebaserc`/
   despliegues. En paralelo, activar Sentry (o equivalente) para errores del
   front, budget alerts de Firebase y límites/alertas de cuota en Groq, y rate
   limiting + App Check en la Function y el form público — hoy un abuso de costo
   pasaría totalmente inadvertido.

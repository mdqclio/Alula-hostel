# Remediación — Alula-hostel

Acompaña a `docs/auditoria/Alula-hostel.md`. Sólo se aplicaron **arreglos
seguros y reversibles en código**. No se rotaron keys, no se desplegó nada, no
se tocó el historial de git ni datos en Firebase.

**Leyenda:** ✅ hecho en este commit · 📄 documentado / parcial (acción del
dueño) · ⏳ pendiente (acción del dueño).

---

## ✅ Hecho en código (este commit)

### 1. API key de Groq fuera del cliente — ✅ (código) · ⏳ rotar + backend (dueño)

Antes el chatbot y el OCR **bajaban la key de Groq desde RTDB
(`alula/secrets/groqApiKey`)**, la cacheaban en `localStorage`
(`alula_groq_key`) y la mandaban en `Authorization: Bearer` directo a
`api.groq.com` **desde el browser**. Cualquiera con sesión o que inspeccionara
la red/localStorage obtenía la key.

Cambios (`js/chatbot.js`, `js/huespedes.js`):

- `loadApiKeyFromFirebase()` → **stub vacío**. Ya no lee `alula/secrets` ni
  escribe `localStorage`. Se conserva la firma para no romper llamadores
  (`js/app.js`).
- `saveApiKey()` → **deshabilitada**. Ya no escribe la key en RTDB ni en
  `localStorage`; muestra un aviso de que la key va por backend.
- `chatApiKey` arranca **vacío** (ya no se hidrata desde `localStorage`).
- `sendMessage()` (chat) y `runOCR()` (OCR) → la **llamada directa a
  `api.groq.com` con la key fue removida del path de ejecución**. Quedan como
  bloques comentados, listos para reapuntar a una Cloud Function (sin la key en
  el cliente). Mientras tanto muestran un aviso de "fuera de servicio / completá
  a mano". **El chat y el OCR client-side quedan desactivados a propósito** —
  preferimos perder la función temporalmente antes que seguir exponiendo el
  secreto.

> El input `#chatApiKeyInput` / botón `saveApiKey` siguen en `index.html` pero
> ya no persisten nada (la función sólo avisa). Se puede quitar la UI en un
> pase de limpieza aparte.

**Acción del dueño:**
- ⏳ **Rotar la key de Groq actual** (estuvo expuesta en RTDB/localStorage).
- ⏳ **Mover la llamada a Groq a una Cloud Function** (igual que `cotizar`), con
  la key en **Secret Manager** (`defineSecret`), y reapuntar los `fetch`
  comentados a ese endpoint. El cliente nunca debe ver la key.
- ⏳ Borrar el dato viejo `alula/secrets/groqApiKey` (y `alula/config/groqApiKey`
  si quedara) de RTDB. Ver `docs/migrate-groq-key-instructions.md`.

### 2. Reglas RTDB endurecidas + cableadas — ✅ (código) · ⏳ deploy (dueño)

- Se creó **`database.rules.json`** mergeando la propuesta endurecida de la rama
  `chore/firebase-rules` (`firebase.rules.proposed.json`), **quitando el bloque
  `__notas`** no-desplegable (RTDB sólo acepta la clave `rules`).
- Se **cableó en `firebase.json`** (`"database": { "rules": "database.rules.json" }`).
- Endurecimiento vs. el estado previo (`{".read":"auth!=null",".write":"auth!=null"}`
  para todo el árbol):
  - `alula` es **deny-by-default** (`.read/.write = false`); cada nodo opta por
    permisos explícitos.
  - **`secrets` ya NO es legible por cualquier autenticado**: lectura/escritura
    sólo-admin (`root.child('alula/admins/'+auth.uid).val() === true`).
  - `admins` sólo-admin (cada uid puede leer su propia flag).
  - `usuarios`/`roles`/`config`: lectura autenticada, **escritura sólo-admin**.
  - `preRegistros`: escritura pública **acotada por esquema** (form público),
    lectura sólo autenticada.
- También se creó **`storage.rules`** (auth-only, deny-by-default) y se cableó en
  `firebase.json`. Hoy la app no usa Cloud Storage, pero el bucket existe; esto
  evita que quede abierto.

**Acción del dueño (NO desplegar a ciegas):**
- ⏳ Antes del deploy de reglas hay que completar los **follow-ups de migración
  del front** que las reglas asumen (estaban en `__notas`):
  - Reescribir `loadAllData()` para leer **por-nodo** (hoy lee `alula` entero,
    que pasa a `.read:false`).
  - Form público → `push()` a `alula/preRegistros` (no `DB.set('huespedes', …)`).
  - Vista pública de lista negra → leer `alula/listanegraPublica` (no filtrar
    `huespedes`).
  - Poblar `alula/admins/{uid}: true` para cada admin y derivar "soy admin" de
    ahí.
  - Quitar `pass` en texto plano de `alula/usuarios` (redundante con Auth).
- ⏳ Migrar la key de Groq (paso 1) **antes** de deployar (o el chat/OCR queda
  sin key igual que ya están desactivados).
- ⏳ `firebase deploy --only database,storage` (revisado, en staging primero).

### 3. Validación de entradas en la Cloud Function `cotizar` — ✅

`functions/index.js`: se agregó validación barata en el borde HTTP **sin tocar
la lógica de cálculo** (`cotizador.service.js` queda igual):

- `req.body` debe ser objeto.
- `tenant` debe ser string (además de estar en la whitelist).
- `entrada`/`salida` deben ser strings (antes podían llegar `undefined`/no-string
  hasta la lógica pura).
- `cantidadCamas`, si viene, debe ser **entero entre 1 y 1000** (evita
  `Number(...)` con basura o pedidos absurdos). Devuelve 400 con código claro.

### 4. `.gitignore` — ✅ (ya existía)

Ya cubría `.env`, `*.key`, `secrets.json`, `node_modules/`, `.firebaserc`,
`dist/`, etc. **No requirió cambios.**

---

## Verificación

- `node --check js/chatbot.js` → OK
- `node --check js/huespedes.js` → OK
- `node --check functions/index.js` → OK
- `firebase.json` → JSON válido
- `database.rules.json` → JSON válido (sin los comentarios `//` de encabezado,
  que el Firebase CLI sí tolera)
- `grep` confirma que **no quedan lecturas/escrituras de la key de Groq** ni
  llamadas directas a `api.groq.com` en el path de ejecución (sólo comentarios).

---

## ⏳ Pendiente — dueño (no es código seguro/reversible; requiere consola/deploy)

| Tarea | Owner | Pasos |
|---|---|---|
| **Rotar key de Groq** | dueño | Regenerar en el panel de Groq → guardar el nuevo valor en Secret Manager (no en RTDB) → invalidar el viejo. |
| **Desplegar reglas RTDB/Storage** | dueño | Completar follow-ups del front (ver punto 2) → probar en staging → `firebase deploy --only database,storage`. |
| **Mover Groq a Cloud Function + Secret Manager** | dueño | Crear Function `chatGroq`/`ocrGroq` (patrón de `cotizar`) con `defineSecret('GROQ_API_KEY')` → reapuntar los `fetch` comentados en `chatbot.js`/`huespedes.js` a la Function → quitar la UI de input de key. |
| **App Check** | dueño | Registrar la app (reCAPTCHA v3 / Enterprise) → exigir App Check en la Function `cotizar`, en el form público y en las llamadas a la Function de Groq → bloquea abuso anónimo. |
| **Rate limiting** | dueño | En las Functions (Groq y `cotizar`): límite por IP/sesión (p. ej. Firestore/RTDB contador con TTL, o API Gateway / Cloud Armor). Hoy sólo hay un debounce client-side trivialmente evitable. |
| **Monitoreo + budget alerts** | dueño | Sentry/Crashlytics para errores del front; alertas de presupuesto en GCP/Firebase; alertas de cuota/gasto en Groq; alertas sobre logs de error de las Functions. |
| **Separar staging/prod** | dueño | Crear proyecto `alula-hostel-staging` → versionar `.firebaserc` con alias → dejar de operar a mano contra prod → CI de deploy revisable. |

---

## Notas

- Comparación de api-key en `cotizar` sigue siendo `!==` (no constant-time):
  fuga por timing teórica, no se cambió por estar fuera del alcance "seguro/
  reversible" pedido; queda anotada.
- `invoker: 'public'` + sin CORS explícito en `cotizar`: depende de App Check /
  rate limiting (arriba).

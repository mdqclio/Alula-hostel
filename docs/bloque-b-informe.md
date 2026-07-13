# Bloque B — Informe de migración del front para reglas endurecidas

**Branch:** `feat/rules-migration` (creada desde `main` @ `2fb6e5e`).
**Estado:** 5 commits + 1 merge, pusheada a `origin`. **No** mergeada a `main`.
**Tests:** `npx vitest run` → **47/47** en verde tras cada tarea.

## Commits

| Commit | Tarea |
|--------|-------|
| `c62d1d1` | Merge de `origin/feat/rules-frontend-prep` (T1) |
| `c51b04b` | T2 — eliminar vista pública de lista negra |
| `961e2a6` | T3 — `ultimoAcceso` a nodo propio por-uid |
| `9a3cd48` | T4 — revisión de pre-registros públicos |

(Este informe se agrega en un commit posterior de documentación.)

---

## 1. Resolución de los 2 conflictos del merge

Saltaron exactamente los 2 conflictos anticipados (ningún tercero).

### `js/huespedes.js` — `submitPublicRegistration`

- **Resolución:** se conservó la lógica **nueva de la branch** — `push()` a
  `alula/preRegistros` con el payload de 12 campos.
- Se descartó el lado `HEAD` (`huespedes.push(...)` + `DB.set('huespedes')` +
  `logAuditoria`) porque es el path **anónimo sin auth**: bajo las reglas
  endurecidas no puede reescribir `huespedes` completo ni escribir `auditoria`.
- El `escapeHtml(h.foto)` del Bloque A **no estaba en conflicto** (línea ~86,
  auto-mergeada limpia). Verificado que sigue presente en el archivo final.
- Ambas intenciones preservadas: lógica de `preRegistros` (branch) + todos los
  `escapeHtml` que `main` había agregado en ese archivo.

### `js/listanegra.js` — imports + render público (2 markers)

- **Resolución del merge:** conservar **ambas intenciones** — `escapeHtml` de
  `main` aplicado sobre los campos del nodo público de la branch
  (`nombre/apellido/motivo/nivel`), e import de `escapeHtml` preservado. Se
  dropeó `loadAllData` del import (no se usaba).
- Resuelto **de forma consistente con la Tarea 2**: en T2 el archivo se
  reescribió a solo `renderListaNegra()` (vista interna) y se eliminaron
  `showListaNegraPublica()`, `copyListaNegraLink()` y `checkListaNegraMode()`.

---

## 2. Decisiones tomadas

### T2 — Lista negra solo interna (decisión de producto)

- `js/listanegra.js`: eliminadas `checkListaNegraMode()`,
  `showListaNegraPublica()`, `copyListaNegraLink()` (modo `?listanegra=1`).
  `renderListaNegra()` intacto. Imports de `loadAllData`/`showNotif` (ya no
  usados) removidos.
- `js/app.js`: quitada la llamada de arranque `checkListaNegraMode()` y las
  exposiciones a `window` de las funciones eliminadas.
- `sections/listanegra.html`: quitado el botón "Copiar link público" y la nota
  que describía el link público.
- `database.rules.json`: eliminado el nodo `listanegraPublica` (sin consumidor).
- El modo `?publicform=1` (pre-registro) **no** se tocó: sigue público.
- No apareció código de sync hacia `listanegraPublica` en el merge (el
  follow-up 3b nunca se implementó), así que no hubo nada extra que borrar.

### T3 — `ultimoAcceso` fuera del array `usuarios`

**Contradicción detectada y consultada antes de improvisar:** `ultimoAcceso`
debe ir keyed por `auth.uid` (la regla es `auth.uid === $uid`), pero los
registros de `usuarios` **no guardaban ningún uid** — el login matchea por
`email` y el uid que devuelve `createUserWithEmailAndPassword` se descartaba.
Sin uid en la fila, la tabla de usuarios no puede mapear fila → timestamp.

**Decisión elegida (consultada): "capturar uid en la creación".**

- `js/auth.js`: el login escribe `alula/ultimoAcceso/<uid>` (best-effort, un
  fallo de permisos no aborta el login) en vez de `DB.set('usuarios', ...)`.
  Ya no reescribe el array completo.
- `js/usuarios.js`: `saveUsuario` guarda `cred.user.uid` al crear el usuario.
  `renderUsuarios` lee de `alula/ultimoAcceso` mapeando por uid, con fallback
  al campo legacy y a `'—'`.
- `js/firebase-config.js`: `ultimoAcceso` agregado a `KNOWN_NODES` (loadAllData).
- `database.rules.json`: nodo `ultimoAcceso` (read `auth != null`, write solo
  el dueño `auth.uid === $uid`).

**Limitación aceptada:** sin migración de datos históricos, los usuarios
pre-existentes (sin uid) muestran `'—'` hasta ser recreados. La
reestructuración de `usuarios` por uid queda para otro bloque (follow-ups 6/7).

### T4 — Revisión de pre-registros (UI mínima)

- Bloque "Pre-registros pendientes (N)" arriba de la tabla de Huéspedes,
  visible solo si N > 0. Muestra nombre, apellido, dni y fecha de nacimiento
  (único campo de fecha disponible en el payload; las reglas rechazan campos
  extra vía `$other: {validate:false}`, así que no hay timestamp de envío).
- **Aprobar:** crea el huésped en `huespedes` (mismo shape que `saveHuesped`,
  con `estadias: 0`) y elimina el pre-registro con `remove()` del child.
- **Rechazar:** elimina el pre-registro.
- Ambas acciones loguean con `logAuditoria`.
- **Todo** dato de pre-registro se renderiza con `escapeHtml` — es el input
  público hostil del sistema.
- El cache local se sincroniza mutando la referencia viva que devuelve
  `DB.get` (no se puede `DB.set` el nodo completo: `alula/preRegistros` es
  `.write:false` a nivel padre; solo `$pid` permite escritura).
- `preRegistros` agregado a `KNOWN_NODES` (loadAllData).

---

## 3. Verificación final (T5)

- `npx vitest run` → **47/47** verde.
- `grep -rn "get(ref(db, 'alula'))" js/` → **cero** (ninguna lectura del árbol
  entero).
- `grep -rn "listanegra=1\|listanegraPublica\|showListaNegraPublica" js/ index.html sections/`
  → **cero**.
- `database.rules.json` valida como JSON parseable (comentarios `//` quitados
  para el parseo; se dejan en el archivo, la CLI de Firebase los acepta).
  `database:rules:canary` **no** es comando en firebase-tools 15.19.1, así que
  se usó el fallback de JSON parseable que la tarea permite.

---

## 4. Checklist ordenada de pasos manuales de deploy

> **Prerrequisito:** las reglas siguen SIN deployar. El front nuevo (lectura
> nodo-por-nodo) debe estar en producción **antes** que las reglas, o el front
> viejo rompe con las reglas endurecidas. Es decir: mergear/deployar esta
> branch a hosting primero (decisión del dueño — no se hizo acá).

1. **Bootstrap de admins ANTES de deployar las reglas**
   (`docs/migrate-admins-instructions.md`, Opción A — problema huevo/gallina):
   con las reglas actuales (`auth != null`), que **cada usuario admin inicie
   sesión una vez** en la app ya deployada → `syncAdminFlag` siembra
   `alula/admins/<uid> = true` solo.

2. **Verificar la siembra:**
   ```bash
   firebase database:get "/alula/admins"
   ```
   Debe mostrar `{ "<uid1>": true, "<uid2>": true, ... }` con **todos** los
   admins. (Opción B: sembrar a mano con
   `firebase database:set "/alula/admins/<UID>" true`, cruzando
   `firebase auth:export` para mapear email → uid.)

3. **Deploy de las reglas endurecidas:**
   ```bash
   firebase deploy --only database
   ```
   Recién con todos los admins marcados. Los comentarios `//` quedan; la CLI
   los acepta.

4. **Smoke test del formulario público** (`?publicform=1`):
   - Enviar un registro → confirmar que escribe en `alula/preRegistros`
     (write anónimo permitido por esquema).
   - Login como admin → aparece en "Pre-registros pendientes (N)" en Huéspedes.
   - **Aprobar** → crea el huésped y hace `remove()` del child.
   - **Rechazar** → solo borra el pre-registro.
   - Ambas acciones deben quedar registradas en auditoría.

---

## 5. Migraciones pendientes (fuera de este bloque)

Del doc de status, no abordadas acá:

- `groqApiKey → alula/secrets` (migrar el dato).
- Limpieza de `pass` en texto plano en `usuarios`.
- Reestructuración de `usuarios` por uid (follow-ups 6/7) — sin esto, endurecer
  `usuarios` a write solo-admin rompería el login de no-admins; por eso las
  reglas dejan `usuarios` con `read: auth != null` por ahora.
- App Check / rate-limit para spam en `preRegistros` (follow-up 9).
- Fotos base64 → Cloud Storage (follow-up 10).

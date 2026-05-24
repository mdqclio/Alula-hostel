# Auditoría de reglas de seguridad — Realtime Database (alula-hostel)

**Fecha:** 2026-05-24
**Instancia:** `alula-hostel-default-rtdb`
**Archivos relacionados:**
- `firebase.rules.current.json` — reglas vigentes (capturadas de producción).
- `firebase.rules.proposed.json` — reglas endurecidas propuestas (borrador, **no desplegado**).

---

## 1. Reglas vigentes hoy

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

Una sola regla en la raíz: **cualquier usuario autenticado puede leer y escribir TODO el árbol.** No hay granularidad por nodo, por rol, ni validación de datos.

### Quién puede leer/escribir cada nodo hoy

Todos los nodos cuelgan de `alula/`. Con la regla vigente:

| Nodo (`alula/…`) | Contenido | Lectura hoy | Escritura hoy |
|---|---|---|---|
| `usuarios` | Staff: nombre, email, rol, estado **y `pass` en texto plano** | Cualquier autenticado | Cualquier autenticado |
| `roles` | Permisos por rol | Cualquier autenticado | Cualquier autenticado |
| `config` | Configuración **+ `groqApiKey` (clave de API)** | Cualquier autenticado | Cualquier autenticado |
| `huespedes` | PII de huéspedes + `score` + `obs` + `foto` (base64) | Cualquier autenticado | Cualquier autenticado |
| `reservas` | Reservas | Cualquier autenticado | Cualquier autenticado |
| `precios` | Tarifas | Cualquier autenticado | Cualquier autenticado |
| `camasConfig`, `beds` | Camas | Cualquier autenticado | Cualquier autenticado |
| `movimientos`, `cierres` | Caja / contabilidad | Cualquier autenticado | Cualquier autenticado |
| `auditoria` | Log de auditoría | Cualquier autenticado | Cualquier autenticado |
| `aluKnowledge` | Base de conocimiento del chatbot | Cualquier autenticado | Cualquier autenticado |

> "Cualquier autenticado" = los 4 roles (admin, recepción, ventas, limpieza). Las restricciones de rol que se ven en la UI (`applyRoleUI`, permisos `r`/`rw`/`none`) son **solo cosméticas**: no las impone la base. Desde la consola del navegador, un usuario de limpieza puede sobrescribir caja, borrar huéspedes o cambiar roles.

### Huecos detectados

1. **Contraseñas en texto plano legibles por todo el staff.** `alula/usuarios[].pass` se guarda en claro (`auth.js`) y lo lee cualquier usuario logueado. También queda expuesta la **API key de Groq** en `alula/config.groqApiKey`.
2. **Sin granularidad de escritura.** Cualquier autenticado puede sobrescribir o vaciar colecciones enteras (`huespedes`, `usuarios`, `reservas`, `movimientos`…), porque todas las escrituras son `set()` del array completo.
3. **Permisos por rol no se aplican.** La separación admin/recepción/ventas/limpieza es decorativa; la base no la respeta.
4. **Flujos públicos rotos o peligrosos.** El form de registro (`?registro=1`) y la lista negra pública (`?listanegra=1`) corren **sin autenticación**, pero la regla exige `auth != null`:
   - Si las reglas se mantienen como están → esos flujos **fallan** (acceso denegado).
   - Si alguien aflojó las reglas para que funcionen (p.ej. `true/true`) → **cualquier anónimo de Internet** puede leer todo (PII, contraseñas, API key) y sobrescribir cualquier nodo. Ambos flujos hoy hacen `loadAllData()`, que descarga **todo `alula`**.
5. **Sin validación de esquema ni de tamaño.** Se puede guardar cualquier estructura y blobs arbitrariamente grandes (las fotos en base64 ya inflan el árbol).
6. **Acciones de admin indistinguibles** de las normales a nivel de reglas (gestión de usuarios/roles sin control).

---

## 2. Reglas propuestas (endurecidas)

Ver `firebase.rules.proposed.json`. Principios aplicados:

- **Default deny:** `alula` tiene `.read:false`/`.write:false`; cada nodo concede acceso explícitamente. No hay lectura del árbol completo.
- **Admin vía `alula/admins/{uid}`:** se chequea `root.child('alula/admins/'+auth.uid).val() === true`. No se recorre el array `usuarios` (las reglas no pueden iterar arrays). Cada usuario puede leer su **propia** flag (`admins/{uid}` con `auth.uid === $uid`).
- **Alta pública aislada en `alula/preRegistros`:** escritura anónima **solo de creación** (push), con `.validate` estricto del esquema real y `$other:false` (rechaza campos no listados). Lectura solo para staff autenticado. El público **no** lee ni reescribe `huespedes`.
- **Lista negra pública en `alula/listanegraPublica`:** `.read` público, `.write` solo admin, con solo campos seguros (`nombre`, `apellido`, `motivo`, `nivel`). Nunca expone `score`/`obs` crudos.
- **Nodos sensibles restringidos:** `usuarios`/`roles`/`config` → escritura solo admin (lectura autenticada por ahora; ver follow-ups).
- **Resto operativo:** lectura/escritura para autenticados.
- **Límites de tamaño** en los campos validados.

### Esquema validado de `alula/preRegistros/$pid`

Campos permitidos (cualquier otro se rechaza con `$other:false`):

| Campo | Tipo | Regla |
|---|---|---|
| `nombre` * | string | 1–80 |
| `apellido` * | string | 1–80 |
| `dni` * | string | 1–30 |
| `nac` * | string | 1–60 |
| `tel` | string | ≤30 |
| `email` | string | ≤120, formato válido o vacío |
| `ciudad` | string | ≤80 |
| `provincia` | string | ≤80 |
| `fechaNacimiento` | string | ≤10 (YYYY-MM-DD) |
| `genero` | string | ≤30 |
| `foto` | string (base64 único) | ≤2.000.000 |
| `pendiente` * | boolean | debe ser `true` |

(*) requeridos. **Excluidos a propósito:** `docFrente`, `docDorso`, `score`, `obs`, `estadias`, `id` (la key del push es el id).

---

## 3. Diff en lenguaje natural (vigente → propuesto)

- **Antes:** una regla `auth != null` para todo. **Después:** default-deny en `alula` + permisos por nodo.
- **Lectura del árbol completo:** antes permitida a cualquier autenticado; **ahora bloqueada** (`alula/.read:false`). Hay que leer por-nodo.
- **`usuarios`/`roles`/`config`:** antes cualquiera escribía; **ahora solo admin** (lectura sigue autenticada mientras no se migre el login y se quite `pass`).
- **Registro público:** antes escribía a `huespedes` (tras leer todo el árbol, sin auth); **ahora** push validado y aislado a `preRegistros`, sin lectura de datos existentes.
- **Lista negra pública:** antes leía todo `alula` y filtraba `huespedes` (expone PII); **ahora** lee solo `listanegraPublica` con campos seguros.
- **Admin:** antes implícito (rol en array `usuarios`); **ahora** explícito vía `admins/{uid}`.
- **Validación:** antes ninguna; **ahora** esquema + tamaños en `preRegistros` y `listanegraPublica`.

---

## 4. Cambios necesarios en el front (para operar con las reglas nuevas)

Estos cambios son **bloqueantes**: sin ellos, la app deja de funcionar bajo las reglas propuestas.

1. **`loadAllData()` (`js/firebase-config.js`)** — Dejar de hacer `get(ref(db,'alula'))`. Leer por-nodo solo lo que el rol necesita (`reservas`, `huespedes`, `precios`, `roles`, `config`, etc.). Con `alula/.read:false`, la lectura masiva falla.

2. **Form público — `submitPublicRegistration()` (`js/huespedes.js`)** — En vez de `loadAllData()` + `DB.set('huespedes', arrayCompleto)`, hacer un `push(ref(db,'alula/preRegistros'), {…})` **anónimo** con exactamente los 12 campos del esquema (`pendiente:true`, sin `score`/`obs`/`estadias`, sin `docFrente`/`docDorso`). No leer ni reescribir `huespedes`.

3. **Bandeja de pre-registros (nuevo, admin/recepción)** — Pantalla que lista `alula/preRegistros`, permite revisar y **promover** cada uno a `huespedes` (creando el registro completo con `score`/`obs`/`estadias`) y luego borrar el pre-registro.

4. **Lista negra pública — `showListaNegraPublica()` (`js/listanegra.js`)** — Leer solo `alula/listanegraPublica` (no `loadAllData()`). El admin mantiene/sincroniza ese nodo con campos seguros (`nombre`, `apellido`, `motivo`, `nivel`). Nunca publicar `score`/`obs` internos.

5. **Flag de admin — `applyRoleUI()` / login (`js/auth.js`)** — Determinar "soy admin" leyendo `alula/admins/{uid}` (cada usuario lee su propia flag). Poblar `alula/admins/{uid}: true` para cada administrador (uid de Firebase Auth) desde un panel admin o seeding.

6. **Quitar `pass` en texto plano (`js/auth.js`)** — Eliminar el guardado de `pass` en `alula/usuarios`. Firebase Auth ya gestiona credenciales; `updatePassword` basta.

7. **`ultimoAcceso` y escritura de `usuarios`** — El login escribe el array completo de `usuarios` para bumpear `ultimoAcceso`. Con `usuarios` write solo-admin esto rompe para no-admins. Migrar `usuarios` a indexado por uid (`alula/usuarios/{uid}`) para que cada uno escriba su propio `ultimoAcceso`, o mover `ultimoAcceso` a un nodo aparte.

8. **Lectura de `usuarios` en login** — El login busca al usuario en el array `usuarios` para validar `estado`/`rol`. Por eso `usuarios` queda con **lectura autenticada** por ahora. Para pasarla a solo-admin, crear un directorio `alula/usuariosPublic/{uid}` (nombre, rol, estado) legible por su dueño y leer de ahí en el login.

9. **Seeding (`initData`)** — Roles/config se siembran en el primer login con `DB.set`. Con esos nodos write solo-admin, sembrar estando autenticado como admin (o abrir reglas temporalmente la primera vez).

---

## 5. Cómo desplegar (cuando se apruebe)

> ⚠️ `firebase.rules.proposed.json` incluye un bloque `__notas` que **RTDB no acepta**. Antes de desplegar, quitar `__notas` (o pasar las notas a comentarios `//` en un `database.rules.json`, que la CLI sí tolera).

```bash
# 1. Generar el archivo desplegable sin __notas, p.ej. database.rules.json
# 2. Referenciarlo en firebase.json:  "database": { "rules": "database.rules.json" }
# 3. Desplegar SOLO las reglas de la base:
firebase deploy --only database
```

**Recomendado:** probar antes en el emulador o con el simulador de reglas, y hacer los cambios de front (sección 4) en la misma tanda para no romper producción.

---

## 6. Follow-ups priorizados

| # | Severidad | Tema |
|---|---|---|
| 1 | 🔴 Alta | Quitar `pass` en texto plano de `usuarios` |
| 2 | 🔴 Alta | Reescribir flujos públicos (registro → `preRegistros`, lista negra → `listanegraPublica`) |
| 3 | 🔴 Alta | `loadAllData()` por-nodo (no leer todo `alula`) |
| 4 | 🟠 Media | Poblar y usar `alula/admins/{uid}` |
| 5 | 🟠 Media | Migrar `usuarios` a indexado por uid (ultimoAcceso, read solo-admin) |
| 6 | 🟠 Media | Activar Firebase App Check (anti-spam en escritura pública) |
| 7 | 🟡 Baja | Mover fotos base64 a Cloud Storage (solo URL en RTDB) |
| 8 | 🟡 Baja | Enforcement de roles vía Custom Claims (hoy solo cosmético) |

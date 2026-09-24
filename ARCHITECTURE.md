# Arquitectura — Alula Hostel

Este documento describe cómo está construida la app tal como está en el código
hoy, no cómo debería estar. Para el backlog de mejoras ver
[`docs/pending-tasks.md`](docs/pending-tasks.md).

## Filosofía

- **Sin build step.** El navegador carga `js/app.js` como `type="module"` y
  resuelve los `import` nativamente. No hay bundler, transpilador ni
  `node_modules` en el front. El SDK de Firebase se importa como ESM desde
  `https://www.gstatic.com/firebasejs/12.10.0/...`.
- **El estado vive en Firebase.** La Realtime Database bajo `alula/` es la única
  fuente de verdad persistente. No hay backend propio para la lógica de negocio
  del panel (sí Cloud Functions puntuales: `cotizar`, `crearUsuario`).
- **Cache en memoria.** `js/firebase-config.js` mantiene un objeto `cache`. Toda
  lectura de la UI pasa por `DB.get(nodo, default)` (lee del cache, no de la
  red). Las escrituras van por `DB.set(nodo, valor)`, que actualiza el cache y
  persiste en `alula/<nodo>`.
- **Render imperativo.** Cada módulo tiene funciones `renderX()` que arman HTML
  con template strings y lo inyectan con `innerHTML`. No hay virtual DOM ni
  binding reactivo: tras un cambio de datos se vuelve a llamar al render.
- **Funciones globales en `window`.** Como los módulos ES tienen scope privado y
  el HTML usa `onclick="..."`, `js/app.js` hace `Object.assign(window, {...})`
  con todas las funciones que el HTML necesita invocar.

## Flujo de arranque

`index.html` carga `js/app.js`, que:

1. Importa `firebase-config.js` (inicializa la app Firebase, `db`, `auth`).
2. Importa el resto de los módulos y expone sus funciones en `window`.
3. `updateDate()` — pinta la fecha en la UI.
4. **`checkPublicMode()`** — si la URL trae `?registro=1`, reemplaza la pantalla
   de login por el formulario público de registro de huésped y **corta ahí** el
   flujo normal (el huésped anónimo nunca ve el panel).
5. Cablea listeners de modales y el botón del form público.
6. **`initAuth()`** — `onAuthStateChanged`: si hay sesión persistida restaura el
   panel (llama `loadAllData()`, valida el usuario contra `alula/usuarios`,
   aplica UI por rol); si no, muestra el login.

En login manual (`doLogin`): `signInWithEmailAndPassword` → `loadAllData()` →
valida que el email exista y esté activo en `alula/usuarios` → escribe
`alula/ultimoAcceso/<uid>` → aplica rol → `showSection('dashboard')`.

> La vista pública de lista negra **ya no existe**. Fue eliminada por decisión de
> producto: la lista negra queda solo interna (requiere login). El único modo
> público que queda es `?registro=1`.

## Capa de datos

`js/firebase-config.js` expone:

```js
export const cache = {};                       // estado en memoria
export const DB = {
  get: (k, def) => cache[k] ?? def,            // lee del cache
  set: async (k, v) => { cache[k] = v; await set(ref(db,'alula/'+k), v); }
};
```

### ⚠️ Patrón full-array (importante)

Casi todos los nodos (`reservas`, `huespedes`, `movimientos`, `usuarios`,
`auditoria`, ...) son **arrays completos**. El patrón de escritura en todo el
front es: `DB.get` el array entero → mutar/`push` en memoria → `DB.set` el array
entero de vuelta. Consecuencias:

- **No es concurrency-safe.** Dos pestañas escribiendo el mismo nodo pisan
  cambios (última escritura gana).
- **Costo creciente.** Cada acción reescribe todo el nodo (p. ej. `logAuditoria`
  reescribe el array de auditoría completo en cada login/acción).
- **Interacción con las reglas.** Un nodo con escritura solo-admin no admite el
  patrón full-array desde un no-admin; por eso `ultimoAcceso` se movió a un nodo
  propio por-uid (ver abajo) y las escrituras de usuarios pasan al Admin SDK vía
  Cloud Function, que bypassa las reglas.

RTDB además devuelve un nodo como **array** si las keys son `0..N` consecutivas y
como **object** si son mixtas. El código defensivo hace
`Array.isArray(v) ? v.filter(Boolean) : Object.values(v)` en varios lados
(functions, knowledge, preRegistros) para tolerar ambos shapes.

### `loadAllData` nodo por nodo

Las reglas deny-by-default prohíben leer `alula/` como un todo, así que
`loadAllData()` lee cada nodo por separado, **en paralelo**, y tolera fallos
individuales (un no-admin recibe error de permisos en `secrets` y sigue):

```js
const KNOWN_NODES = [
  'config', 'camasConfig', 'reservas', 'huespedes', 'movimientos', 'cierres',
  'precios', 'beds', 'usuarios', 'roles', 'auditoria', 'aluKnowledge',
  'secrets', 'ultimoAcceso', 'preRegistros'
];
```

Cada `get(ref(db,'alula/'+node))` va en su propio `try/catch` dentro de un
`Promise.all`. Si un nodo no existe, simplemente no se cachea (`aluKnowledge` se
inicializa a `[]` si falta).

## Mapa de dependencias entre módulos

- **`firebase-config.js`** es la base: exporta `db`, `auth`, `DB`, `cache`,
  `loadAllData`. Casi todos los módulos lo importan.
- **`app.js`** importa todos los módulos y los expone en `window`. Nadie importa
  `app.js`.
- **`auth.js`** importa `firebase-config`, `config` (defaults), `auditoria`;
  importa dinámicamente `navigation` y `chatbot` para evitar ciclos. Expone
  `currentUser` (estado global mutable) que consumen `usuarios.js` y otros.
- **`auditoria.js`** (`logAuditoria`) lo importan casi todos los módulos que
  mutan datos.
- **`helpers.js`** (`escapeHtml`, `openModal`, `closeModal`, `showNotif`,
  `today`, ...) es utilitario transversal.
- **`listanegra.js`** importa `getScoreBadge` de `huespedes.js`.
- **`usuarios.js`** importa `currentUser` de `auth.js` y `loadAllData` para
  refrescar tras crear un usuario vía Cloud Function.
- **Ciclos evitados con `import()` dinámico:** `auth ↔ navigation/chatbot`,
  `firebase-config → auth (initData)`, `firebase-config → helpers (showNotif)`.
- **`js/services/`** (`camas.service.js`, `cotizador.service.js`) son **puros**:
  no importan Firebase ni tocan el DOM. Tienen tests Vitest y una **copia
  sincronizada a mano** en `functions/` para uso server-side.

## Modelo de dominio

Objetos guardados como arrays bajo `alula/`. Shapes reales (según el código):

**Reserva** (`alula/reservas`):
```
{ id:'r'+ts, huespedId, hab, cama, entrada, salida, precio, moneda,
  pago, plataforma, estado, estadoPago, pagado, saldo, notas }
```

**Huésped** (`alula/huespedes`):
```
{ id:'h'+ts, nombre, apellido, dni, nac, tel, email, ciudad, provincia,
  fechaNacimiento, genero, foto, estadias, score?, obs? }
```
`foto` es un data URL base64 (o `null`). `score` bajo (≤5) marca al huésped en
la lista negra interna.

**Movimiento** (`alula/movimientos`):
```
{ id:'m'+ts, tipo:'ingreso'|'egreso', cat, moneda, monto, metodo, fecha, concepto }
```

**Cama** — la configuración vive en `alula/camasConfig` / `alula/beds` y en
`config.hostel.habitaciones`. La lógica de disponibilidad, ocupación, score y
precio dinámico está en `services/camas.service.js` (función pura sobre
`camas + reservas + rango de fechas`).

**Reservas no se borran físicamente en el flujo normal** salvo acción explícita
de borrado; el resto de operaciones (check-in/out, pagos, extensión) mutan la
reserva en su lugar.

## Modos públicos

Un único modo público: **`?registro=1`**. `checkPublicMode()` lo detecta y
muestra `showPublicRegistrationForm()`, un formulario que:

- Pide nombre, apellido, DNI y nacionalidad como obligatorios (+ campos
  opcionales y foto del documento).
- **`submitPublicRegistration()`** hace `push` de un único registro a
  `alula/preRegistros` con `pendiente:true`. **No lee ni reescribe** `huespedes`:
  el anónimo no puede —ni debe— leer el árbol.
- Las reglas permiten a un anónimo **crear** un `preRegistro` acotado por
  esquema, pero no leer ni modificar nada más.

Los pre-registros se revisan desde **Huéspedes** (`renderPreRegistros`,
`aprobarPreRegistro`, `rechazarPreRegistro`): aprobar promueve el registro a
`huespedes`; ambos eliminan el `preRegistro` procesado.

> El link del form usa `?registro=1` (ver `showPublicFormLink`/`checkPublicMode`
> en `js/huespedes.js`).

## Roles y enforcement

Hay **dos capas** de control de acceso, y no hay que confundirlas:

1. **UI por rol (cosmética).** `alula/roles` es un array de roles con permisos
   por módulo (`{ reservas:'rw', caja:'r', ... }`). `applyRoleUI` muestra/oculta
   nav y elementos `.admin-only` según el rol del usuario logueado. Esto **no es
   seguridad**: es UX. Un usuario podría, en teoría, saltarse la UI.

2. **Reglas RTDB (enforcement real).** La autorización real la dan las reglas de
   `database.rules.json`, desplegadas. Para "admin", **la fuente de verdad es
   `alula/admins/<uid> === true`** — las reglas hacen
   `root.child('alula/admins/'+auth.uid).val() === true` para gatear escritura
   en `usuarios`, `roles`, `config`, y lectura/escritura de `secrets` y
   `admins`. Los arrays no se pueden recorrer desde reglas, por eso se usa este
   nodo-mapa por-uid en vez de leer el rol dentro de `alula/usuarios`.

`syncAdminFlag()` (en `auth.js`) mantiene `alula/admins/<uid>` alineado con el
rol en cada login (best-effort, fire-and-forget). El primer admin se siembra a
mano (ver `docs/migrate-admins-instructions.md`); hoy hay 2 admins sembrados.

> Limitación conocida: los roles **no-admin** todavía no tienen enforcement por
> rol en las reglas (los nodos operativos son `auth != null` a secas). El único
> corte fino real en reglas hoy es admin vs. no-admin. Ver backlog.
</content>

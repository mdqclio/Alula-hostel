# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 2026-07-13

Estado tras los Bloques A y B (mergeados a `main`) y la Cloud Function de alta
de usuarios (en rama, sin mergear). Documentación completa agregada:
`README.md`, `ARCHITECTURE.md`, `docs/firebase-schema.md`, `docs/modules.md`,
`docs/pending-tasks.md`.

### Bloque A — hardening y validaciones (mergeado a `main`)
- **Fix `require()` en dashboard** ([3e7ebdd](https://github.com/mdqclio/Alula-hostel/commit/3e7ebdd)) —
  reemplazado por `import` estático de `dateToLocal` (el código del browser es ESM).
- **Auditoría XSS con `escapeHtml`** ([7a3ac4f](https://github.com/mdqclio/Alula-hostel/commit/7a3ac4f),
  [709ef48](https://github.com/mdqclio/Alula-hostel/commit/709ef48)) — escapado
  de HTML en interpolaciones de todo el front, incluida `contabilidad.js` y la
  foto de huésped.
- **Validaciones en `saveReserva`** ([df57aef](https://github.com/mdqclio/Alula-hostel/commit/df57aef)) —
  rango de fechas, precio negativo y sobrepago.
- **API key de Groq fuera del cliente + reglas RTDB endurecidas** ([0c8791f](https://github.com/mdqclio/Alula-hostel/commit/0c8791f)).
- **`grilla.js` huérfano del root eliminado + `package.json` main corregido** ([2fb6e5e](https://github.com/mdqclio/Alula-hostel/commit/2fb6e5e)).

### Bloque B — migración de reglas (mergeado a `main` **y DESPLEGADO en producción**)
- **Reglas RTDB deny-by-default desplegadas** — `alula/` niega todo; cada nodo
  opta por permisos explícitos. Ver `database.rules.json` y
  [`docs/bloque-b-informe.md`](docs/bloque-b-informe.md).
- **`loadAllData` nodo por nodo** ([d49a26f](https://github.com/mdqclio/Alula-hostel/commit/d49a26f)) —
  lectura individual y en paralelo de cada `alula/<nodo>` (compatible con
  deny-by-default, que impide leer `alula/` como un todo).
- **Form público → `preRegistros`** ([3d76ff0](https://github.com/mdqclio/Alula-hostel/commit/3d76ff0)) —
  el registro público (`?registro=1`) hace `push` a `alula/preRegistros`
  (escritura anónima acotada por esquema). Smoke test OK end-to-end: envío
  anónimo, revisión, aprobar y rechazar.
- **Vista pública de lista negra ELIMINADA** ([c51b04b](https://github.com/mdqclio/Alula-hostel/commit/c51b04b),
  [ca022fe](https://github.com/mdqclio/Alula-hostel/commit/ca022fe)) — decisión
  de producto: la lista negra queda solo interna (requiere login).
- **`ultimoAcceso` movido a `alula/ultimoAcceso/<uid>`** ([961e2a6](https://github.com/mdqclio/Alula-hostel/commit/961e2a6)) —
  cada uid escribe solo su propio nodo; antes se bumpeaba reescribiendo el array
  `usuarios` completo (incompatible con `usuarios` write solo-admin).
- **UI de revisión de pre-registros en Huéspedes** ([9a3cd48](https://github.com/mdqclio/Alula-hostel/commit/9a3cd48)) —
  `renderPreRegistros`, `aprobarPreRegistro`, `rechazarPreRegistro`.
- **Campo `uid` agregado a `alula/usuarios`** ([e97c135](https://github.com/mdqclio/Alula-hostel/commit/e97c135)) —
  mapea usuario ↔ Firebase Auth uid.
- **`alula/admins` sembrado (2 admins)** — fuente de verdad de "admin" para las
  reglas (`root.child('alula/admins/'+auth.uid).val() === true`).

### Operativo — sign-up deshabilitado
- El **sign-up público de Firebase Auth está deshabilitado a propósito**. Como
  consecuencia, **crear usuarios desde la app no funciona** hasta desplegar la
  Cloud Function `crearUsuario` (abajo). La cuenta de test fue inhabilitada.

### Pendiente en rama (NO mergeado a `main`)
- **`fix/publicform-ux`** (pusheada, sin mergear) — mayoría de edad obligatoria
  en el form público ([2ec56b3](https://github.com/mdqclio/Alula-hostel/commit/2ec56b3))
  y pantalla de éxito que reemplaza el form tras enviar
  ([ebe9b9c](https://github.com/mdqclio/Alula-hostel/commit/ebe9b9c)).
- **`feat/crear-usuario-function`** (esta rama, sin mergear) — Cloud Function
  `crearUsuario` con auth de admin ([0043221](https://github.com/mdqclio/Alula-hostel/commit/0043221)),
  front adaptado para dejar de usar el sign-up cliente
  ([d7e3a37](https://github.com/mdqclio/Alula-hostel/commit/d7e3a37)), tests de
  validación del body ([ebfaabf](https://github.com/mdqclio/Alula-hostel/commit/ebfaabf))
  y pasos de deploy ([fd80463](https://github.com/mdqclio/Alula-hostel/commit/fd80463)).
  **PENDIENTE:** review, deploy de la function y cargar la URL en
  `CREAR_USUARIO_URL` (`js/usuarios.js`). Ver
  [`docs/crear-usuario-deploy.md`](docs/crear-usuario-deploy.md). Tests: **57 passing**.

## [Unreleased] — 2026-05-26

### Added
- **Cloud Function `/cotizar`** ([726dac2](https://github.com/mdqclio/Alula-hostel/commit/726dac2)) —
  HTTP endpoint que envuelve el cotizador para consumo externo (mibot247 / n8n).
  Auth por header `x-api-key` (secret en GCP Secret Manager).
  URL: <https://cotizar-5jk73wvuzq-uc.a.run.app>.
  Doc completa: [`docs/cloud-function-cotizar.md`](docs/cloud-function-cotizar.md).
- **Cotizador inline en Grilla** ([17f9737](https://github.com/mdqclio/Alula-hostel/commit/17f9737)) —
  modo dual operativo/cotización dentro de la vista Grilla, sin abrir modales aparte.
- **Validación `cantidadCamas` vs disponibles** ([51f7ecf](https://github.com/mdqclio/Alula-hostel/commit/51f7ecf)) —
  error `sin_camas` cuando se piden más camas de las que hay libres en el rango.
- **Servicio puro de cotización + tests Vitest** ([da8a467](https://github.com/mdqclio/Alula-hostel/commit/da8a467)) —
  `js/services/cotizador.service.js` aislado del DOM/Firebase, 46 tests iniciales.

### Fixed
- **`aluKnowledge` tolera shape object** ([1cf9a45](https://github.com/mdqclio/Alula-hostel/commit/1cf9a45)) —
  Firebase RTDB sirve nodos como array si las keys son `0..N` consecutivas y como
  object si hay keys mixtas. mibot247 v2.4 escribe entries con keys `kb_<ts>`, lo
  que cambiaba el shape de retorno y rompía la vista "Base de Conocimiento"
  ("No hay entradas") y los escritores (`.push`/`.splice` sobre object). Render +
  edit/delete/add ahora preservan el shape de origen y usan la key real (no idx
  numérico) para los handlers. Mismo patrón aplicado al `buildSystemPrompt` del
  chatbot. Archivos: [`js/knowledge.js`](js/knowledge.js), [`js/chatbot.js`](js/chatbot.js).
- **Validación `fechas_pasadas` en cotizador** ([bcb4324](https://github.com/mdqclio/Alula-hostel/commit/bcb4324)) —
  nuevo error `fechas_pasadas` cuando `entrada < hoy`. Aplicado en ambas copias
  (`js/services/cotizador.service.js` y `functions/cotizador.service.js`). Test
  agregado; fixtures del test migrados de `2026-02-XX` → `2027-02-XX`.
- **`package.json` type `module`** ([105cf42](https://github.com/mdqclio/Alula-hostel/commit/105cf42)) —
  todos los `js/*.js` del browser son ES modules; `commonjs` hacía fallar
  `node --check` sobre código válido. Sin cambio en runtime.

### Infrastructure
- **Carpeta `functions/`** — primera Cloud Function del proyecto. Node 20,
  `type:module`, deps `firebase-admin` + `firebase-functions`. Las dos copias
  de servicios (`cotizador.service.js`, `camas.service.js`) son duplicados
  sincronizados a mano de `js/services/`.
- **`firebase.json`** — agregado para configurar el deploy de `functions/`.
  Solo trae la sección `functions`, sin `hosting`/`firestore`/`storage`.

### Operations
Endpoint deployado y operativo. Tests verdes: **47 passed (47)**.
GH Pages servido desde `main`. Secret `COTIZADOR_API_KEY` v1 en GCP Secret
Manager (rotación: ver doc del endpoint).

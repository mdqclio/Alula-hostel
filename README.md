# Alula Hostel — Sistema de Gestión

Panel web de gestión para el Alula Hostel (Mar del Plata): reservas, mapa de
camas, check-in/out, caja y contabilidad, huéspedes, lista negra interna,
roles/usuarios, base de conocimiento y un asistente de respuestas. Todo el
estado vive en Firebase Realtime Database bajo el nodo `alula/`.

Es una app de una sola página, sin framework ni paso de build: `index.html`
carga módulos ES nativos desde `js/` y fragmentos de HTML desde `sections/`.

## Stack

| Capa | Tecnología |
|------|-----------|
| Front | HTML + CSS + JavaScript vanilla, **ES Modules nativos, sin build step** |
| SDK Firebase | `firebasejs/12.10.0` importado como ESM desde `https://www.gstatic.com` |
| Auth | Firebase Authentication (email/password) |
| Datos | Firebase Realtime Database (nodo raíz `alula/`) |
| Backend | Cloud Functions v2 (Node 20, `type:module`, región `us-central1`) — carpeta `functions/` |
| Tests | Vitest (solo sobre lógica pura: `js/services/` y `functions/`) |
| Hosting | GitHub Pages servido desde `main` |

No hay bundler, transpilador ni `node_modules` en el front: el navegador
resuelve los `import` directamente. `package.json` en la raíz existe solo para
correr los tests con Vitest.

## Correr en local

Al ser ES Modules, hay que servir la carpeta por HTTP (abrir `index.html` con
`file://` rompe los imports). Cualquier servidor estático sirve:

```bash
# opción 1
python3 -m http.server 8000
# opción 2
npx serve .
```

Luego abrir <http://localhost:8000>. La app se conecta a la instancia real de
Firebase (config en `js/firebase-config.js`); no hay emulador configurado.

Tests:

```bash
npm test        # vitest run
npm run test:watch
```

Estado actual: **57 tests passing**.

> Nota: crear usuarios desde la app **no funciona en local ni en producción**
> hasta desplegar la Cloud Function `crearUsuario` y completar su URL en el
> front. El sign-up público de Firebase Auth está deshabilitado a propósito
> (ver más abajo).

## Estructura del repo

```
index.html                 Shell de la SPA (login + app + modales)
sections/*.html            Fragmentos de cada vista (dashboard, reservas, ...)
css/styles.css             Estilos únicos
js/
  app.js                   Entry point: importa todo y expone funciones en window
  firebase-config.js       Init Firebase, cache en memoria, DB.get/DB.set, loadAllData
  auth.js                  Login/logout, roles, sync de alula/admins/<uid>
  navigation.js            Router de secciones (SPA)
  <modulo>.js              Un archivo por dominio (reservas, huespedes, caja, ...)
  services/                Lógica pura testeable (sin DOM ni Firebase) + tests
functions/                 Cloud Functions (cotizar, crearUsuario) + copias de servicios
database.rules.json        Reglas RTDB versionadas (deny-by-default) — desplegadas
storage.rules              Reglas de Cloud Storage
firebase.json              Wiring de database/storage/functions para el deploy
docs/                      Documentación (ver punteros abajo)
```

Ver [`docs/modules.md`](docs/modules.md) para la referencia archivo por archivo.

## Funcionalidades por módulo

| Módulo | Archivo | Qué hace |
|--------|---------|----------|
| Dashboard | `js/dashboard.js` | Resumen de ocupación y disponibilidad por fecha |
| Mapa de camas | `js/mapa.js` | Vista de camas por habitación y estado por fecha |
| Grilla | `js/grilla.js` | Grilla temporal con cotizador inline (modo operativo/cotización) |
| Reservas | `js/reservas.js` | Alta, check-in/out, pagos, extensión, cambio de cama, borrado |
| Check-in | `js/checkin.js` | Vista de check-in del día |
| Huéspedes | `js/huespedes.js` | Alta/edición, OCR de documento, form público y revisión de pre-registros |
| Contabilidad | `js/contabilidad.js` | Reportes, filtros, export CSV |
| Caja / Saldos | `js/caja.js` | Movimientos, cierres de caja, transferencias, saldos por cuenta |
| Lista negra | `js/listanegra.js` | Huéspedes con score bajo — **solo interna, requiere login** |
| Roles y Usuarios | `js/usuarios.js` | ABM de roles y de usuarios (usuarios vía Cloud Function) |
| Base de conocimiento | `js/knowledge.js` | Entradas de conocimiento para el asistente |
| Chatbot | `js/chatbot.js` | Asistente de respuestas (**desactivado**: la key de Groq salió del cliente) |
| Historial | `js/auditoria.js` | Log de auditoría paginado |
| Configuración | `js/config-ui.js` | Hostel, temporadas, horarios, cuentas, métodos de pago, camas, etc. |

## Firebase

- **Reglas versionadas y desplegadas.** Las reglas de RTDB viven en
  [`database.rules.json`](database.rules.json), cableadas en `firebase.json`, y
  están **desplegadas en producción** con modelo **deny-by-default**: `alula/`
  niega lectura/escritura y cada nodo opta por permisos explícitos. El detalle
  nodo por nodo está en [`docs/firebase-schema.md`](docs/firebase-schema.md).
- **`alula/admins/<uid>` es la fuente de verdad de "admin"** para las reglas
  (los arrays no se pueden iterar desde reglas). El front la refresca en cada
  login (`syncAdminFlag`, best-effort).
- **Sign-up de Firebase Auth deshabilitado a propósito.** No debe existir alta
  pública de cuentas: los usuarios del panel los crea un admin mediante la Cloud
  Function `crearUsuario` (auth con ID token de admin + Admin SDK). Mientras esa
  función no esté desplegada y su URL cargada en `js/usuarios.js`, el alta de
  usuarios desde la app queda inoperable. Ver
  [`docs/crear-usuario-deploy.md`](docs/crear-usuario-deploy.md).
- **La config de Firebase en el cliente es pública** (`apiKey`, `projectId`,
  etc. en `js/firebase-config.js`); eso es esperado en apps web de Firebase. La
  seguridad la dan las reglas de RTDB, no el ocultamiento de esa config.

## Documentación

- [`CHANGELOG.md`](CHANGELOG.md) — historial de cambios.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — filosofía, arranque, capa DB, dominio, roles.
- [`docs/firebase-schema.md`](docs/firebase-schema.md) — árbol de `alula/` y modelo de seguridad.
- [`docs/modules.md`](docs/modules.md) — referencia por archivo de `js/` y `functions/`.
- [`docs/pending-tasks.md`](docs/pending-tasks.md) — backlog priorizado.
- [`docs/crear-usuario-deploy.md`](docs/crear-usuario-deploy.md) — pasos de deploy de la Function `crearUsuario`.
- [`docs/cloud-function-cotizar.md`](docs/cloud-function-cotizar.md) — endpoint `cotizar`.
- [`docs/bloque-b-informe.md`](docs/bloque-b-informe.md) — informe de la migración de reglas (Bloque B).
</content>
</invoke>

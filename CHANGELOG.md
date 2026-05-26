# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

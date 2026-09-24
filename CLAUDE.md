# Alula Hostel — convenciones del proyecto

Reglas permanentes. Valen para toda tarea, salvo que el dueño diga lo contrario
en forma explícita para esa tarea.

## Idioma

- Todo en español: código (nombres, comentarios, mensajes de UI), commits y docs.

## Deploy y ramas

- **Nunca correr `firebase deploy`**, de ningún tipo (hosting, functions,
  database, storage, `--only` lo que sea). Los deploys los hace el dueño.
  Si una tarea toca `database.rules.json` u otra config de Firebase, se edita
  solo el archivo.
- **Nunca mergear a `main`.** Siempre: branch nueva → commits → push de la branch → informe.

## Informes

- Toda tarea termina con su informe completo en
  `docs/informes/AAAA-MM-DD-<tema>.md` (hallazgos, decisiones, pendientes),
  commiteado y pusheado en la misma branch.
- El resumen en pantalla puede ser corto; el archivo es la fuente completa.

## Tests

- `npx vitest run` tiene que estar verde antes de cada push.
- La lógica pura va en `js/services/*.service.js`, sin DOM ni Firebase, con su
  `*.service.test.js` al lado. La UI (`js/*.js`) persiste lo que devuelven esos servicios.

## Seguridad y datos

- `escapeHtml` (de `js/helpers.js`) en **todo** dato de usuario que vaya a
  `innerHTML`: nombres, conceptos, notas, ids interpolados en `onclick`, etc.
- **Los movimientos de dinero siempre llevan cuenta.** Ningún flujo puede crear
  un movimiento "Sin cuenta". Validar con `validarCuentaMovimiento`
  (`js/services/movimientos.service.js`).
- Los movimientos no se borran: se corrigen por anulación (contra-asiento).

## Forma de trabajo

- Ante una contradicción entre lo pedido y el flujo actual, **frenar y
  preguntar** antes de improvisar. Lo que sí se decida por cuenta propia va
  explícito en el informe, en la sección de decisiones.

## Referencias

- `README.md`, `ARCHITECTURE.md`, `docs/firebase-schema.md`, `docs/modules.md`, `docs/pending-tasks.md`.

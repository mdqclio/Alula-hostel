# Referencia de módulos

Referencia archivo por archivo de `js/` y `functions/`, con sus exportaciones
principales según el código actual. No es exhaustiva de cada helper interno;
lista lo que otros módulos o el HTML consumen.

## `js/` — front

### `app.js`
Entry point. No exporta nada. Importa todos los módulos, hace
`Object.assign(window, {...})` para exponer las funciones que el HTML llama por
`onclick`, y arranca: `updateDate()`, `checkPublicMode()`, `initAuth()`.

### `firebase-config.js`
Init de Firebase y capa de datos.
`firebaseApp`, `db`, `auth`, `cache`, `DB` (`.get`/`.set`), `loadAllData()`.
Define `KNOWN_NODES` (nodos que se pre-cargan).

### `auth.js`
Autenticación, roles y sync de admins.
`currentUser` (estado mutable), `ROLE_LABELS`, `rolToKey()`, `showLoginError()`,
`applyRoleUI()`, `doLogin()`, `doLogout()`, `openChangePassword()`,
`saveChangePassword()`, `initAuth()`, `initData()`. Internas: `syncAdminFlag()`
(mantiene `alula/admins/<uid>`).

### `navigation.js`
Router SPA. `showSection()`, `closeSidebar()`, `openSidebar()`,
`toggleSidebar()`, `updateDate()` + carga de fragmentos de `sections/`.

### `dashboard.js`
`renderDashboard()`, `onEntradaChange()`.

### `mapa.js`
`renderMapa()`, `mapaNavegar()`, `renderMapaFecha()`, `cycleBed()`.

### `grilla.js`
`renderGrilla()`, `grillaNavegar()`, `grillaHoy()`, `setCotizacionRango()`,
`clearCotizacionRango()`. Grilla temporal con cotizador inline (modo
operativo/cotización).

### `reservas.js`
Núcleo operativo. `renderReservas()`, `openNuevaReserva()`, `saveReserva()`
(valida rango de fechas, precio negativo y sobrepago), `updateBedsSelect()`,
`calcTotalReserva()`, `doCheckin()`, `confirmCheckin()`, `openPago()`,
`savePago()`, `openExtender()`, `calcExtension()`, `saveExtension()`,
`doCheckout()`, `limpiarDuplicados()`, `openCambioCama()`,
`updateCambioCamaSelect()`, `saveCambioCama()`, `openHorario()`,
`toggleHorarioCobro()`, `saveHorario()`, `deleteReserva()`, `updateCamaInfo()`.

### `checkin.js`
`renderCheckin()`.

### `huespedes.js`
ABM de huéspedes + form público + pre-registros.
`getScoreBadge()`, `renderScoreStars()`, `setScore()`, `renderHuespedes()`,
`renderPreRegistros()`, `aprobarPreRegistro()`, `rechazarPreRegistro()`,
`showGuestDetail()`, `previewDoc()`, `runOCR()`, `saveHuesped()`,
`openEditHuesped()`, `saveEditHuesped()`, `confirmDelete()`, `deleteHuesped()`,
`showPublicFormLink()`, `copyPublicLink()`, `openPublicFormPreview()`,
`checkPublicMode()`, `showPublicRegistrationForm()`, `previewPubDoc()`,
`submitPublicRegistration()`.
El link público es `?registro=1`; el envío hace `push` a `alula/preRegistros`.

### `contabilidad.js`
`renderAcct()`, `switchAcctTab()`, `aplicarFiltroReportes()`,
`exportarReporteCSV()`.

### `caja.js`
`renderCaja()`, `saveMovimiento()`, `cerrarCaja()`, `openMovimientoModal()`,
`openTransferenciaModal()`, `saveTransferencia()`, `renderSaldos()`.

### `listanegra.js`
`renderListaNegra()`. Solo interna (requiere login); filtra `huespedes` por
`score <= 5`. Importa `getScoreBadge` de `huespedes.js`. **La vista pública fue
eliminada.**

### `usuarios.js`
Roles y usuarios. `MODULES`, `MODULE_LABELS`, `renderRoles()`, `togglePerm()`,
`deleteRol()`, `saveRol()`, `renderUsuarios()`, `openNuevoUsuario()`,
`editUsuario()`, `populateRolSelect()`, `toggleUsuarioEstado()`, `saveUsuario()`.
`saveUsuario()` **crea usuarios llamando la Cloud Function `crearUsuario`** con
el ID token del admin; la constante `CREAR_USUARIO_URL` está en
`__COMPLETAR_TRAS_DEPLOY__` (bloquea el alta hasta el deploy). La edición de
password propia se hace con `updatePassword` de Firebase Auth.

### `knowledge.js`
`renderKnowledge()`, `saveKnowledgeEntry()`, `deleteKnowledgeEntry()`,
`editKnowledgeEntry()`, `cancelEditKnowledge()`, `saveEditKnowledge()`. Tolera
shape array u object (`kb_<ts>`).

### `chatbot.js`
Asistente de respuestas. `toggleChatFloat()`, `initChatbot()`, `clearChat()`,
`sendChat()`, `sendQuickReply()`, `saveApiKey()`, `copyMsg()`,
`loadApiKeyFromFirebase()`, `openChatCorrect()`, `closeChatCorrect()`,
`saveChatCorrect()`. **Desactivado por seguridad:** `loadApiKeyFromFirebase()` es
un stub vacío y `saveApiKey()` avisa que la key ya no se configura desde el
cliente. La key de Groq debe ir en Secret Manager + Cloud Function proxy (ver
backlog).

### `auditoria.js`
`renderHistorial()`, `aplicarFiltroHistorial()`, `verDetalleAuditoria()`,
`historialPaginaAnterior()`, `historialPaginaSiguiente()`, y `logAuditoria()`
(reescribe `alula/auditoria` completo por acción — usado por casi todos los
módulos que mutan datos).

### `config-ui.js` / `config.js`
`config-ui.js`: UI de configuración (hostel, temporadas, horarios, cuentas,
métodos de pago, plataformas, monedas, quick replies, camas, score preview).
`config.js`: `CONFIG_DEFAULTS` y constantes de configuración por defecto.

### `helpers.js`
Utilitarios transversales: `escapeHtml()`, `openModal()`, `closeModal()`,
`showNotif()`, `today()`, formateo de fechas/moneda, etc.

## `js/services/` — lógica pura (con tests Vitest)

### `services/camas.service.js`
Sin DOM ni Firebase. `calcularScoreCama()`, `isCamaDisponible()`,
`calcularOcupacionGlobal()`, `calcularOcupacionHabitacion()`,
`calcularPrecioCama()`, `sugerirCama()`. Tests en `camas.service.test.js`.

### `services/cotizador.service.js`
Sin DOM ni Firebase. `cotizar({ entrada, salida, cantidadCamas, reservas,
camasConfig, habitaciones, temporadas, monedas })` → cotización o error
(`fechas_pasadas`, `sin_camas`, etc.). Tests en `cotizador.service.test.js`.

> Estos dos servicios tienen una **copia sincronizada a mano** en `functions/`
> (`functions/camas.service.js`, `functions/cotizador.service.js`) para uso
> server-side. Al editar uno hay que reflejar el cambio en el otro.

## `functions/` — Cloud Functions (v2, Node 20, región `us-central1`)

### `index.js`
Exporta dos endpoints HTTP:

- **`cotizar`** — auth por header `x-api-key` (secret `COTIZADOR_API_KEY` en
  Secret Manager). Lee `reservas`/`camasConfig`/`config`, llama al servicio puro
  y devuelve la cotización. **Desplegado y operativo.** Doc:
  [`cloud-function-cotizar.md`](cloud-function-cotizar.md).
- **`crearUsuario`** — crea un usuario del panel sin usar el sign-up público.
  Auth por **ID token de admin** (`Authorization: Bearer <token>`,
  `verifyIdToken`), autorización por `alula/admins/<uid> === true`, valida el
  body con `validateCrearUsuarioBody`, crea la cuenta con el Admin SDK
  (`createUser`), apéndea a `alula/usuarios` y registra auditoría. `cors:true`
  para el preflight. **PENDIENTE DE DEPLOY** — hasta desplegarla y cargar su URL
  en `js/usuarios.js`, el alta de usuarios desde la app no funciona. Pasos:
  [`crear-usuario-deploy.md`](crear-usuario-deploy.md).

### `crear-usuario.validate.js`
`validateCrearUsuarioBody(body, rolesIds)` — validación pura y testeable del body
de `crearUsuario` (email con formato, password ≥ 6, nombre 1–80, `rolId` debe
existir en `alula/roles`). Devuelve `{valid:true, value}` o
`{valid:false, error, mensaje}`. Tests en `crear-usuario.validate.test.js`.

### `cotizador.service.js` / `camas.service.js`
Copias server-side sincronizadas a mano de `js/services/`.
</content>

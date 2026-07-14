# Backlog / tareas pendientes

Priorizado. Estado a 2026-07-13, post Bloques A/B y function de usuarios.

## Bloqueantes / alta prioridad

### 1. Deploy de la Cloud Function `crearUsuario` + URL en el front
La función existe en `functions/index.js` y el front ya la llama, pero
`CREAR_USUARIO_URL` en `js/usuarios.js` está en `'__COMPLETAR_TRAS_DEPLOY__'`.
Como el sign-up público de Firebase Auth está deshabilitado, **crear usuarios
desde la app no funciona** hasta:
1. Desplegar `firebase deploy --only functions:crearUsuario`.
2. Copiar la URL que imprime a `CREAR_USUARIO_URL`.
3. Verificar alta end-to-end con un admin logueado.
Pasos detallados: [`crear-usuario-deploy.md`](crear-usuario-deploy.md).

### 2. Mensaje honesto en el botón "crear usuario" mientras tanto
Hasta que el punto 1 esté hecho, el alta falla silenciosamente con "Error al
crear usuario". Mostrar un mensaje claro de que el alta está temporalmente
deshabilitada (function sin desplegar) en vez de un error genérico.

### 3. Validar que `h.foto` empiece con `data:image/` antes de renderizar
`showGuestDetail` (y otros) hacen `<img src="${escapeHtml(h.foto)}">` con lo que
venga en `foto`. `escapeHtml` no impide un `src` malicioso (p. ej.
`javascript:`-vía-atributo u otros esquemas). Validar que el valor arranque con
`data:image/` antes de inyectarlo; si no, no renderizar la imagen. Aplica tanto
a `huespedes` como a la foto de `preRegistros` (input anónimo).

## Seguridad / modelo de datos

### 4. Reestructurar `usuarios` por uid + enforcement por rol en reglas
Hoy `usuarios` es un array y el único corte en reglas es admin vs. no-admin
(vía `alula/admins/<uid>`). Los nodos operativos son `auth != null` para
cualquier logueado. Reestructurar usuarios como mapa por-uid y agregar
enforcement por rol (recepción/ventas/limpieza) en `database.rules.json`, para
que las reglas —y no solo la UI— apliquen los permisos por módulo.

### 5. Migrar `groqApiKey` a `alula/secrets` + Cloud Function proxy (reactivar chatbot)
El chatbot está desactivado: `loadApiKeyFromFirebase()` es un stub y
`saveApiKey()` avisa que ya no se configura desde el cliente (la key solía vivir
en el cliente/RTDB, exponiéndola). Para reactivarlo: guardar la key en Secret
Manager (o `alula/secrets`, solo-admin) y llamar a Groq desde una Cloud Function
proxy, nunca desde el browser. Molde: la función `cotizar`.

### 6. Fotos base64 → Cloud Storage
`huespedes[].foto` y `preRegistros[].foto` son data URLs base64 embebidos en el
nodo. Infla los arrays (que se reescriben enteros por el patrón full-array) y las
reglas ya limitan `preRegistros.foto` a 2 MB. Mover las imágenes a Cloud Storage
(`storage.rules` ya existe) y guardar solo la URL.

### 7. App Check / rate limiting en `preRegistros`
`preRegistros` es el único punto de escritura anónima. Está acotado por
`.validate` (esquema + longitudes), pero sin App Check ni rate limiting: es
spameable. Agregar App Check y/o throttling.

## Robustez / operaciones

### 8. `logAuditoria` a push-por-entidad
Hoy `logAuditoria` (en `js/auditoria.js`) lee y reescribe el **array de
auditoría completo** en cada login/acción. Migrar a `push` por entrada (o
por-entidad) para que no crezca el costo ni se pisen escrituras concurrentes.

### 9. Backup automatizado del nodo `alula/`
No hay backup. Automatizar un export periódico del nodo `alula/` (los datos son
la única fuente de verdad y viven solo en RTDB).

### 10. Recuperación de la cuenta `admin@alula.com`
El mail `admin@alula.com` **no existe** como buzón real, así que no hay forma de
resetear su contraseña por email. Migrar esa cuenta admin a un email real y
verificado para tener recuperación de clave posible antes de un lockout.
</content>

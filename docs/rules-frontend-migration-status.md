# Estado de los cambios de front para las reglas endurecidas

Rama: `feat/rules-frontend-prep` (más cambios relacionados en otras ramas).
Referencia de los follow-ups: `firebase.rules.proposed.json` (`__notas`) y
`docs/firebase-rules-audit.md` (rama `chore/firebase-rules`).

> **Nada de esto está deployado.** Las reglas en producción siguen siendo
> `auth != null`. No deployar hasta completar los bloqueantes y migrar datos.

## Hecho

| # | Follow-up | Dónde | Estado |
|---|-----------|-------|--------|
| 1 | `loadAllData` leía `alula/` entero | `firebase-config.js` (esta rama) | ✅ Lee nodo-por-nodo en paralelo, con fallo individual tolerado. |
| 2 | Form público escribía `huespedes` completo sin auth | `huespedes.js submitPublicRegistration` (esta rama) | ✅ Hace `push()` a `alula/preRegistros` con los 12 campos del esquema. |
| 3 | Lista negra pública leía `alula/` y exponía PII | `listanegra.js showListaNegraPublica` (esta rama) | ✅ Lee solo `alula/listanegraPublica` (nombre/apellido/motivo/nivel). **Falta** la sincronización del nodo (ver pendientes). |
| 4 | Admin se derivaba del array `usuarios` | `auth.js syncAdminFlag` (esta rama) | ✅ Escribe `alula/admins/<uid>=true` en cada login admin. **Falta** bootstrap inicial (`docs/migrate-admins-instructions.md`). |
| 5 | `pass` en texto plano en `usuarios` | rama `chore/remove-pass-cleartext` | ✅ Código ya no escribe `pass`. **Falta** limpieza de datos (`docs/cleanup-pass-instructions.md`). |
| 12 | `groqApiKey` legible por cualquier autenticado | rama `chore/restrict-groq-api-key` + `chore/firebase-rules` | ✅ Front lee de `alula/secrets`; regla `secrets` solo-admin agregada. **Falta** migrar el dato (`docs/migrate-groq-key-instructions.md`). |

## Pendiente (no abordado en esta tanda)

| # | Follow-up | Por qué quedó afuera |
|---|-----------|----------------------|
| 3b | **Sync de `alula/listanegraPublica` desde `huespedes`** | Necesita decisión de diseño: ¿lo escribe el cliente admin al guardar/puntuar un huésped (score ≤ 5 → upsert; score > 5 → remove), o una Cloud Function on-write sobre `huespedes`? La Function es más robusta (no depende de que un admin abra la app) pero requiere backend. **Bloqueante** para que la vista pública muestre algo. |
| 6 | **`login`/`saveChangePassword` reescriben el array `usuarios` completo** (bump de `ultimoAcceso`) | Con `usuarios` write solo-admin, esto rompe para no-admins. Requiere migrar a `usuarios/{uid}` indexado por uid (cada uno escribe su propio `ultimoAcceso`) o mover `ultimoAcceso` a un nodo aparte. Cambio estructural grande. |
| 7 | **`usuarios` se lee para validar login** | Por eso en las reglas propuestas `usuarios` queda `read: auth!=null` (no solo-admin) hasta migrar a un `usuariosPublic/{uid}` (nombre/rol/estado) legible por su dueño. Recién ahí los datos sensibles de `usuarios` pueden pasar a solo-admin. |
| 8 | **Enforcement por rol** (limpieza/ventas read-only) | Hoy es solo cosmético en la UI; por consola cualquier autenticado escribe. Enforcement real = Custom Claims o reestructurar por uid. |
| 9 | **Spam/DoS en `preRegistros`** (escritura pública) | Activar Firebase App Check y/o limitar tamaño/rate. La validación de reglas ya acota campos y `foto ≤ 2MB`. |
| 10 | **Fotos base64 en RTDB** | Migrar `foto` a Cloud Storage y guardar solo la URL; infla el árbol y encarece lecturas. |
| 11 | **Seeding de `roles`/`config` (`initData`)** | Con `roles`/`config` write solo-admin, sembrar estando logueado como admin, o abrir reglas temporalmente la primera vez. |

## Verificación de lecturas amplias

`grep` sobre `js/` tras esta rama: **no queda ninguna** lectura del árbol entero
`get(ref(db, 'alula'))`. Las lecturas son:
- `firebase-config.js loadAllData`: nodo-por-nodo (`alula/<node>`).
- `listanegra.js`: solo `alula/listanegraPublica`.
- Todo lo demás pasa por `DB.get(...)` (cache en memoria) o `DB.set(...)`
  (escritura por-nodo a `alula/<k>`).

## Próximos pasos sugeridos (orden)

1. Mergear las ramas de front (esta + `chore/remove-pass-cleartext` +
   `chore/restrict-groq-api-key`) a `main`.
2. Resolver el **sync de `listanegraPublica`** (decisión cliente vs Function).
3. Migrar datos: `admins` (bootstrap), `groqApiKey` → `secrets`, limpiar `pass`.
4. Atacar el bloqueante de `usuarios`/`ultimoAcceso` (follow-ups 6 y 7) — sin
   esto, endurecer `usuarios` rompe el login de no-admins.
5. **Probar las reglas en un proyecto de staging** (RTDB emulator o proyecto
   aparte) antes de tocar producción.
6. Quitar el bloque `__notas` de `firebase.rules.proposed.json` (RTDB no lo
   acepta) y deployar.

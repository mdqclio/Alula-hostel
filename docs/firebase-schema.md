# Esquema de Firebase — `alula/`

Estado del árbol de Realtime Database **tal como está hoy** según el código
(`js/firebase-config.js`, los módulos de `js/`, `functions/`) y
[`database.rules.json`](../database.rules.json). Todo cuelga del nodo raíz
`alula/`.

## Árbol

```
alula/
├── config              # Configuración del hostel: hostel.habitaciones, temporadas,
│                       #   monedas, horarios, cuentas, métodos de pago, categorías...
├── camasConfig         # Configuración de camas (atributos, score base)
├── beds                # Camas / estado
├── precios             # Precios
├── reservas            # Array de reservas (ver shape abajo)
├── huespedes           # Array de huéspedes
├── movimientos         # Array de movimientos de caja
├── cierres             # Cierres de caja
├── auditoria           # Log de auditoría (array; se reescribe entero por acción)
├── usuarios            # Array de usuarios del panel { id, uid, nombre, email, rol, estado }
├── roles               # Array de roles con permisos por módulo
├── admins              # Mapa por-uid: alula/admins/<uid> = true  ← fuente de verdad de "admin"
├── ultimoAcceso        # Mapa por-uid: alula/ultimoAcceso/<uid> = ISO string
├── preRegistros        # Registros del form público (push keys); pendiente:true
├── secrets             # Solo-admin. Reservado para secretos server-side (no del cliente)
└── aluKnowledge        # Base de conocimiento del asistente (array u object kb_<ts>)
```

Estos son exactamente los nodos que el front pre-carga en `KNOWN_NODES`
(`js/firebase-config.js`), leídos uno por uno en paralelo.

## Shapes principales

**`reservas[]`**
```json
{ "id":"r<ts>", "huespedId":"h<ts>", "hab":"", "cama":"", "entrada":"YYYY-MM-DD",
  "salida":"YYYY-MM-DD", "precio":0, "moneda":"", "pago":"", "plataforma":"",
  "estado":"", "estadoPago":"", "pagado":0, "saldo":0, "notas":"" }
```

**`huespedes[]`**
```json
{ "id":"h<ts>", "nombre":"", "apellido":"", "dni":"", "nac":"", "tel":"",
  "email":"", "ciudad":"", "provincia":"", "fechaNacimiento":"", "genero":"",
  "foto":"data:image/...|null", "estadias":0 }
```
`score` y `obs` pueden agregarse luego; `score` ≤ 5 marca lista negra interna.

**`movimientos[]`**
```json
{ "id":"m<ts>", "tipo":"ingreso|egreso", "cat":"", "moneda":"", "monto":0,
  "metodo":"", "fecha":"YYYY-MM-DD", "concepto":"" }
```

**`usuarios[]`**
```json
{ "id":"u<ts>", "uid":"<firebase-auth-uid>", "nombre":"", "email":"",
  "rol":"rol-...", "estado":"activo|inactivo" }
```
El campo **`uid`** (Firebase Auth) se agregó para mapear `ultimoAcceso` y para
que la Cloud Function identifique al caller. Usuarios viejos podían tener
`ultimoAcceso` inline; hoy vive en su nodo por-uid.

**`preRegistros/<pushId>`** (form público)
```json
{ "nombre":"", "apellido":"", "dni":"", "nac":"", "tel":"", "email":"",
  "ciudad":"", "provincia":"", "fechaNacimiento":"", "genero":"",
  "foto":"data:image/...|null", "pendiente": true }
```

**`admins/<uid>`** = `true` · **`ultimoAcceso/<uid>`** = `"<ISO>"`

## Notas del modelo

- **Arrays completos.** La mayoría de los nodos son arrays enteros; el front lee,
  muta y reescribe el array completo (patrón full-array). No es concurrency-safe.
- **Filtrado en el cliente.** No hay queries del lado servidor: la app trae los
  arrays completos al cache y filtra/ordena en memoria (p. ej. lista negra =
  `huespedes.filter(score<=5)`).
- **Reservas no se borran** en el flujo normal salvo borrado explícito.
- **Array vs object.** RTDB devuelve array si las keys son `0..N` y object si son
  mixtas. Código defensivo usa
  `Array.isArray(v) ? v.filter(Boolean) : Object.values(v)`.
- **`foto` es base64** embebido en el registro (data URL), no una URL de Storage.
- **`preRegistros`** usa push keys (no array), a diferencia del resto.

## Modelo de seguridad (deny-by-default) — desplegado

Reglas en [`database.rules.json`](../database.rules.json), cableadas en
`firebase.json` y **desplegadas en producción**. `alula/` es
`.read:false / .write:false`; cada nodo opta por permisos explícitos. "Admin" =
`root.child('alula/admins/'+auth.uid).val() === true`.

| Nodo | Lectura | Escritura |
|------|---------|-----------|
| `alula/` (raíz) | ❌ false | ❌ false |
| `admins` | solo admin (y cada uid lee su propia flag) | solo admin; `$uid` valida booleano |
| `preRegistros` | autenticado | **anónimo puede crear** un `$pid` nuevo acotado por `.validate` (esquema: nombre/apellido/dni/nac/pendiente requeridos, longitudes, email regex, `foto`≤2 MB, `pendiente===true`, sin campos extra); autenticado puede escribir |
| `usuarios` | autenticado | solo admin |
| `roles` | autenticado | solo admin |
| `config` | autenticado | solo admin |
| `secrets` | solo admin | solo admin |
| `ultimoAcceso` | autenticado | cada uid solo su propio `<uid>` (`auth.uid === $uid`) |
| `huespedes`, `reservas`, `precios`, `camasConfig`, `beds`, `movimientos`, `cierres`, `auditoria`, `aluKnowledge` | autenticado | autenticado |

Puntos a tener presentes:

- **El único corte fino real es admin vs. no-admin.** Los nodos operativos son
  `auth != null` a secas para lectura y escritura: cualquier usuario logueado
  puede escribirlos. El enforcement por rol (recepción/ventas/limpieza) todavía
  **no** está en reglas (ver [`pending-tasks.md`](pending-tasks.md)).
- **`preRegistros`** es el único punto de escritura anónima. Está acotado por
  `.validate`, pero no tiene rate limiting ni App Check (backlog).
- **La Cloud Function usa el Admin SDK**, que **bypassa estas reglas**; por eso
  `crearUsuario` puede escribir `usuarios`/`auditoria` aunque el patrón
  full-array chocaría con la escritura solo-admin desde el cliente.
</content>

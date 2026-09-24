# Mejoras de UX de grupos y caja: informe

Branch: `fix/ux-grupos-caja` (desde `main` @ `6fdb150`), pusheada. Sin merge a `main`.
Sin `firebase deploy`. `database.rules.json` no se tocó: los campos nuevos de
movimientos viajan dentro de `alula/movimientos`, que no valida campos.

Origen: tres fricciones del primer uso real. Hubo dos rondas más: una con
decisiones sobre los hallazgos de la primera y otra que arregló los
pendientes de totales, dashboard y Balance USD.

Tests: `npx vitest run` → **110/110** (eran 71). Hay 4 nuevos en
`grupos.service.test.js` y 35 en el archivo nuevo `movimientos.service.test.js`.

**No se probó en el navegador.** El Playwright de la máquina no tiene el
browser instalado y no se instaló nada. La verificación fue la suite de
tests, `node --check` sobre todos los módulos y un script que confirma que
cada import con nombre existe como export. **Falta una pasada manual
logueado** (ver "Pendientes").

## Commits

| Commit | Contenido |
|---|---|
| `dc983f0` feat(grupos): seña opcional en el alta del grupo | Campos seña/método/cuenta en el modal de Reserva grupal; `validarGrupo` valida la seña |
| `3713390` feat(reservas): bloque Grupos con acceso directo al detalle | Tarjeta "👥 Grupos" en la sección Reservas |
| `ca5b1c1` feat(caja): anulación de movimientos por contra-asiento | `js/services/movimientos.service.js` + UI en Caja y Contabilidad |
| `88afb10` fix(caja): bloquear anulación de una sola pata de transferencia | Mensaje explícito para transferencias |
| `f62b5bc` feat(reservas): vincular cobros a la reserva y revertirlos al anular | `reservaId` en los 5 flujos de cobro + reversión del saldo de la reserva |
| `27f84d9` feat(caja): cuenta obligatoria en todo movimiento de dinero | Selector de cuenta obligatorio en todos los flujos que mueven dinero |
| `cff32ac` fix(caja): totales brutos sin anulaciones y Balance USD con egresos | `totalesMovimientos` aplicado en Caja, Contabilidad, Reportes, CSV y Dashboard |

## 1. Seña en el alta del grupo

- El modal de Reserva grupal suma tres campos opcionales: **Seña**, **Método de pago** y **Cuenta**.
- `validarGrupo` recibe `senia`. Si viene vacía, `undefined` o 0, se comporta
  como antes. Si viene, tiene que cumplir `0 <= senia <= totalAcordado`. Una
  seña negativa o no numérica da error.
- Con seña > 0 se registra el pago inicial con el mismo efecto que "Pago al
  grupo":
  - `aplicarPagoGrupo` actualiza `pagado` y `saldo` del grupo antes de guardarlo.
  - Se crea un movimiento `ingreso` con `cat: 'reserva'`, `grupoId`, `cuenta` y concepto `Seña grupo <nombre>`.
  - Se llama a `logAuditoria('editar', 'grupo', …)` con "Pago grupal registrado (seña)".
- En la segunda ronda la cuenta pasó a ser obligatoria cuando hay seña (ver punto 6).

## 2. Acceso directo a los grupos

- La sección Reservas no tenía pestañas, solo tarjetas. Se siguió ese patrón:
  una tarjeta **"👥 Grupos"** arriba de la lista de reservas.
- Lista los grupos no cancelados, ordenados por fecha de entrada. Columnas:
  nombre, entrada, salida, cantidad de camas, total, pagado, saldo y estado.
- Tocar una fila abre el detalle de grupo que ya existía (`openGrupo`).
- Todos los datos de usuario pasan por `escapeHtml`, incluido el id en el `onclick`.
- `renderListaGrupos()` (en `js/grupos.js`) se llama al principio de
  `renderReservas()`. Por eso se refresca con todo lo que ya refrescaba la
  lista: pagos, check-in, check-out y cancelación.

## 3. Anulación de movimientos (contra-asiento)

### Comportamiento

- Hay una acción **"Anular"** en Caja ("Movimientos de hoy") y en las pestañas
  Ingresos, Egresos, Sueldos y Servicios de Contabilidad.
- Abre un modal con un resumen del movimiento y su efecto (grupo o reserva). El **motivo es obligatorio**.
- Anular **no borra nada**:
  - El original queda con `anulado: true`, `motivoAnulacion`, `fechaAnulacion` y `anuladoPorId` (el id del espejo).
  - Se crea un espejo de **tipo contrario** (ingreso ↔ egreso) con el mismo monto, moneda, cuenta, categoría y método.
  - El espejo tiene concepto `Anulación de <concepto>`, `anulaId` apuntando al original, fecha de hoy y el mismo motivo.
  - El espejo copia además `grupoId`, `reservaId`, `tcARS` y `equivalenteARS` si el original los tiene.
- En pantalla:
  - El original anulado se ve atenuado y tachado, con el badge "anulado" (el motivo aparece al pasar el mouse).
  - El espejo lleva el badge "anulación".
  - Ninguno de los dos muestra el botón y el servicio los rechaza igual.
- Pago de grupo (`grupoId`): primero se valida la reversión, y recién después
  se escribe `pagado - monto` y `saldo + monto` en el grupo, con auditoría propia.
- `logAuditoria('editar', 'movimiento', …)` guarda el motivo, el id del
  contra-asiento y el antes/después. Se usó la acción `editar` porque el
  filtro del historial solo conoce `crear` / `editar` / `eliminar`.
- No hay permisos nuevos: disponible para cualquier usuario autenticado, como el resto.

### Lógica pura (`js/services/movimientos.service.js`)

| Función | Qué hace |
|---|---|
| `puedeAnular(mov)` | Rechaza: movimiento inexistente, ya anulado, espejo (`anulaId`), transferencia, tipo desconocido, monto inválido y cobro de reserva sin vínculo |
| `construirAnulacion(mov, {motivo, id, fecha})` | Devuelve `{original, espejo}` sin mutar el objeto recibido. Exige motivo (se recortan los espacios) |
| `revertirPagoGrupo(grupo, mov)` | Inverso de `aplicarPagoGrupo`. Controla moneda, que sea ingreso y que el monto no supere lo pagado |
| `revertirPagoReserva(reserva, mov)` | Igual que el anterior, para una reserva individual, y además recalcula `estadoPago`. Con `afectaSaldo: false` devuelve `sinCambios` |
| `estadoPagoReserva(pagado, saldo)` | `pendiente` / `senia` / `total` |
| `validarCuentaMovimiento(id, cuentas)` | Exige una cuenta existente y activa |
| `esParAnulacion(m)` / `sinAnulaciones(movs)` | Detecta y filtra el original anulado y su espejo |
| `totalesMovimientos(movs)` | Brutos por moneda sin pares de anulación + neto ARS/USD sobre todos los movimientos |

Hay un test que verifica que original + espejo suman cero, y otro que
verifica que revertir es exactamente el inverso de `aplicarPagoGrupo`.

### Verificación de saldos y reportes

El pedido decía que los cálculos no deberían necesitar cambios si el espejo es
un movimiento normal. La verificación de la primera ronda dio esto:

| Cálculo | Resultado con original + espejo |
|---|---|
| Saldo por cuenta (`renderSaldos`) | ✅ Correcto: misma `cuenta`, se cancelan |
| Balance neto de Contabilidad (Resumen mes) y Reportes | ✅ Correcto |
| Balance ARS de Caja y del cierre | ✅ Correcto |
| Totales brutos "Ingresos" / "Egresos" | ⚠️ Crecían los dos → **arreglado** (sección 7) |
| Dashboard "ingresos de hoy" | ⚠️ Contaba el ingreso anulado → **arreglado** (sección 7) |
| Balance USD de Caja y del cierre | ⚠️ Bug previo: no restaba egresos USD → **arreglado** (sección 7) |

## 4. Transferencias internas

Una transferencia son dos movimientos enlazados por `transferenciaId`. Anular
solo uno descuadraría la otra cuenta. **Decisión del usuario:** bloquear la
anulación individual con el mensaje *"Es parte de una transferencia — anulá
desde el par completo"*. El botón no se muestra en esos movimientos.
La anulación del par completo **no se implementó** (ver Pendientes).

## 5. Cobros de reservas individuales

### Hallazgo

Los movimientos de reservas individuales no guardaban un vínculo a la reserva.
Anularlos no podía revertir el saldo, y había 5 flujos distintos que los creaban.

### Decisiones del usuario

- Arreglar de raíz: los **5 flujos** guardan `reservaId` y la anulación revierte `pagado`, `saldo` y `estadoPago`.
- Un **cobro de reserva** (`cat: 'reserva'`) sin `grupoId` ni `reservaId` no
  se puede anular y muestra un aviso. La base se limpió, así que no hay datos viejos.
- Los **movimientos manuales de Caja** siguen siendo anulables. Aplicada al
  pie de la letra, la regla los habría bloqueado a todos, porque nunca tienen
  ninguno de los dos vínculos. Se preguntó y se decidió dejarlos anulables.
  El bloqueo se basa en `cat === 'reserva'` en minúscula, que es el valor
  que ponen los flujos del código. La categoría de las cargas manuales es
  "Reservas" (con mayúscula), así que no se bloquea.

### Qué revierte cada flujo al anularse

| Flujo | Efecto original en la reserva | Al anular |
|---|---|---|
| Alta de reserva con pago | `pagado` = monto, `saldo` = total − monto | `pagado −`, `saldo +`, recalcula `estadoPago` |
| Check-in (si la reserva no tenía pagos) | Cobra la estadía completa: `pagado` = total, `saldo` = 0 | Vuelve a `pagado 0`, `saldo` = total, `pendiente` |
| Cobrar (`savePago`) | `pagado +`, `saldo −` | Inverso |
| Extensión cobrada | `pagado +` (el saldo no cambia) | `pagado −`, `saldo +`: la extensión queda adeudada |
| Late check-out / Early check-in | **Ninguno**: cargo aparte, en `horariosEspeciales` | **Ninguno** (`afectaSaldo: false`) |

### Decisiones propias (a revisar)

- **Late/early con `afectaSaldo: false`.** Ese cargo nunca sumó a
  `pagado`/`saldo` de la reserva y puede estar en otra moneda. Revertirlo
  inventaría una deuda que no existió, así que su anulación solo compensa el
  dinero. El modal lo avisa.
- **`savePago` ya no acepta un monto mayor al saldo.** Antes recortaba el
  saldo a 0 y guardaba el pago entero, así que la reversión no podía
  reconstruir el saldo real. Ahora rechaza con "El monto supera el saldo de la
  reserva", igual que el pago de grupo.
- **Reserva eliminada.** Si la reserva de un cobro ya no existe, se anula solo
  el movimiento y el modal lo avisa. Bloquearla habría dejado ese dinero sin
  forma de corregirse, que es justo el problema que originó la tarea.
  (Los grupos no se pueden eliminar, solo cancelar. Por eso, si falta el grupo, se bloquea.)

## 6. Cuenta obligatoria en todo movimiento de dinero

**Decisión del usuario:** ningún movimiento nace "Sin cuenta", en ningún flujo.

- Selector **Cuenta \*** obligatorio en:
  - Pago al grupo
  - Seña del alta de grupo (si hay seña)
  - Alta de reserva con pago
  - Check-in que cobra
  - Cobrar
  - Extensión cobrada
  - Late/early cobrado
  - Movimiento manual de Caja, que antes decía "Cuenta \*" pero aceptaba vacío
- Las transferencias ya exigían origen y destino.
- `validarCuentaMovimiento` exige una cuenta existente y activa. Se valida antes de escribir nada.
- `cuentasOptions()` (en `js/config.js`) ya no ofrece "Sin asignar", arranca
  en "Seleccionar cuenta…" y escapa id, nombre y moneda (antes no escapaba).
  Caja y grupos pasaron a usar este helper.

### Detalle del check-in

El check-in solo genera un movimiento cuando la reserva **no tiene ningún
pago** (`!r.pagado`). En ese caso cobra la estadía completa
(`precio × noches`). Por eso:

- El selector de cuenta y el aviso "El check-in registra el cobro de $X" **solo aparecen en ese caso**.
- Si la reserva ya tiene pagos, el check-in no crea un movimiento y no pide cuenta.
- Si la estadía da $0, tampoco se pide cuenta.

Ojo: este comportamiento ya existía. Una reserva "Sin pago (pendiente)" queda
cobrada completa al hacer el check-in aunque en la realidad no se haya
cobrado. Ahora al menos se ve el aviso con el monto antes de confirmar.

## 7. Totales brutos, dashboard y Balance USD (tercera ronda)

**Pedido del usuario:** sacar de los ingresos/egresos brutos los movimientos
con `anulado: true` y sus espejos (`anulaId`) sin que cambie el neto,
aplicar lo mismo al dashboard y arreglar el Balance USD de Caja.

### Decisión de diseño: brutos filtrados, neto sobre todos

`totalesMovimientos(movs)` calcula los **brutos** (`ingARS`, `ingUSD`,
`egARS`, `egUSD`) sin los pares de anulación, y el **neto** (`netoARS`,
`netoUSD`) sobre **todos** los movimientos.

La razón: si original y espejo caen en el mismo día o período, filtrar o no
filtrar da el mismo neto. Pero si el original es de ayer (quizás ya cerrado
en el cierre de caja) y el espejo es de hoy, filtrar los dos del neto de hoy
escondería la corrección. Calculado sobre todos, el neto de cada período
sigue siendo el de un contra-asiento clásico y el total entre períodos
cuadra. Hay un test que cubre el caso de una sola pata del par en el período.

**Consecuencia visible:** en un período que tiene solo una pata del par, el
neto no es igual a brutos ingresos − brutos egresos. Ejemplo: se anula hoy un
ingreso de ayer. Hoy muestra Ingresos $X, Egresos $Y y un Balance que incluye
el −monto del espejo. Es intencional: el balance refleja la corrección
contable.

### Dónde se aplicó

| Lugar | Brutos (sin anulaciones) | Neto (todos) |
|---|---|---|
| Caja: "Ingresos del día", "Egresos del día", sub USD | ✅ | — |
| Caja: Balance ARS / **Balance USD** | — | ✅ Ahora el USD resta egresos USD |
| Cierre de caja: `balanceARS` / **`balanceUSD`** (y su auditoría) | — | ✅ Ahora el USD resta egresos USD |
| Contabilidad, Resumen mes: Ingresos ARS/USD, Egresos ARS | ✅ | — |
| Contabilidad, Resumen mes: "Transacciones" | ✅ Cuenta solo las vigentes | — |
| Contabilidad, Resumen mes: Balance neto ARS | — | ✅ |
| Reportes: cajas Ingresos/Egresos ARS/USD | ✅ | — |
| Reportes: Balance ARS/USD | — | ✅ |
| Dashboard: ingresos del día ARS/USD | ✅ | — |

- **CSV de Reportes:** sigue exportando todas las filas, anulados y espejos
  incluidos, para mantener la auditabilidad. Suma la columna **"Anulación"**
  (`anulado: <motivo>` o `anula <id>`) para poder filtrarlas al sumar en una
  planilla.
- **Tablas de detalle** (Caja, pestañas de Contabilidad, Reportes): siguen
  mostrando anulados (tachados) y espejos. Solo cambian los totales.
- **Saldo por cuenta** (`renderSaldos`): sin cambios. Suma todo y el par se
  cancela por cuenta.
- **Cierres ya guardados:** se guardaron con el Balance USD viejo (solo
  ingresos). No se recalculan. El fix vale para los cierres nuevos.

## Archivo `0,` en la raíz

Era un archivo vacío que quedó de una redirección de shell mal escrita. Se
borró, pero **no figura en ningún commit porque nunca estuvo en git**: con
borrarlo del disco alcanzó.

## Pendientes

Resueltos en la tercera ronda (sección 7): totales brutos inflados por
anulaciones, dashboard con ingresos anulados y Balance USD de Caja sin
egresos.

1. **Anulación de una transferencia completa** (las dos patas juntas): no se implementó.
2. **Prueba manual en el navegador:**
   - Alta de grupo con seña.
   - Tarjeta Grupos.
   - Anular un manual, un pago de grupo, un cobro de reserva y un late checkout.
   - Intentar anular una transferencia, un anulado y un espejo.
   - Cuenta obligatoria en cada modal.
   - Check-in con y sin pagos previos.
   - Totales de Caja, Resumen, Reportes y Dashboard antes y después de una anulación.
   - Balance USD de Caja con un egreso USD.
3. **Cierres de caja anteriores** guardaron `balanceUSD` sin restar egresos USD. Si importa, hay que corregirlos a mano.
4. **Detalle cosmético previo:** en Caja, el encabezado de la tabla dice
   "Hora" y "Método", pero las celdas muestran la fecha y la cuenta. No se tocó.
5. **Check-in que cobra todo** en reservas sin pago (comportamiento previo, ver
   sección 6): revisar si es lo que se quiere.

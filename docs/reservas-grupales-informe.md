# Reservas grupales: informe

Branch: `feat/reservas-grupales` (desde `main` @ `abf03c2`). Sin merge a `main`.
Sin `firebase deploy`: las reglas solo se editaron en `database.rules.json`.

## Qué se hizo

Un grupo (ej. 20 personas con precio negociado) se carga en un solo paso. Por
dentro se guarda como **N reservas individuales normales** (una por cama)
unidas por `grupoId`. Así la grilla, el mapa, el check-in, la disponibilidad y
el control de solapes siguen funcionando sin cambios.

| Commit | Contenido |
|---|---|
| `feat(grupos): validación y armado puro…` | `js/services/grupos.service.js` + 14 tests |
| `feat(grupos): nodo alula/grupos…` | `KNOWN_NODES` en `loadAllData` + regla `grupos` |
| `feat(grupos): alta de reserva grupal…` | `js/grupos.js`, 3 modales en `index.html`, botón en Reservas |
| `feat(grupos): mostrar el grupo en…` | badge de grupo en lista, grilla, check-in, mapa, dashboard e historial del huésped |

## Modelo de datos

### `alula/grupos/{grupoId}` (nodo nuevo, **objeto por id**, no array)

```
{ id, nombre, huespedTitularId, entrada, salida, camas: [camaIds],
  totalAcordado, moneda, pagado, saldo, integrantes, obs, estado }
```

- `id` = `'g' + Date.now()`. `estado`: `confirmada | checkin | checkout | cancelada`.
- Cada grupo se escribe en su propio nodo (`set(ref(db, 'alula/grupos/' + id))`).
  Nunca se reescribe el nodo `grupos` completo.

### Reservas hijas (en `alula/reservas`, mismo shape de siempre)

Campos extra: `grupoId`, `grupoNombre`, `esGrupal: true`.
Valores fijos: `precio: 0`, `pagado: 0`, `saldo: 0`, `estadoPago: 'grupal'`,
`plataforma: 'directo'`, `huespedId` = titular.
Id: `r<timestamp del grupo>-<n>`.

### Movimientos

Cada pago al grupo genera un movimiento normal (`tipo: 'ingreso'`, `cat: 'reserva'`)
con un campo extra: `grupoId`. **El dinero vive solo en el grupo.** Las hijas
nunca generan movimientos.

## Decisiones tomadas

1. **Validación pura y testeada** (`validarGrupo`). Exige nombre, titular,
   fechas válidas con salida > entrada, al menos 2 camas sin repetir,
   `totalAcordado > 0` y todas las camas libres. Para decidir si una cama
   está libre reusa `isCamaDisponible` del motor de camas (solo lectura,
   el motor no se modificó).
2. **Alta rápida de titular.** Lo que pedía el brief no coincide con el código:
   el modal de reserva individual **no tiene** alta rápida, solo un select
   de huéspedes existentes. En el modal grupal agregué la opción
   "+ Alta rápida de titular" (nombre, apellido y DNI). Crea el huésped con el
   mismo shape que `saveHuesped` y lo audita. El huésped se crea recién
   después de validar el grupo, así no quedan huérfanos si la validación falla.
3. **Acciones individuales ocultas en las hijas.** Check-in, check-out, cobrar,
   +días, cambio de cama y borrar se reemplazan por el botón "👥 Ver grupo".
   Motivo: el check-in individual (`confirmCheckin`) cobra `precio × noches`
   si `pagado == 0`, y con precio 0 generaría movimientos en $0. Además,
   cambiar de cama o borrar una hija desincroniza `grupo.camas`.
   Early/late check-out se mantienen por integrante, porque se cobran como
   movimiento aparte.
4. **Check-in grupal:** misma regla que el individual (no se permite antes de la
   fecha de entrada). Pasa el grupo y todas sus hijas `confirmada` a `checkin`
   y graba `horaCheckin`. No pide llave: con 20 camas no tiene sentido cargar una
   llave por cama en un solo click.
5. **Check-out grupal:** si queda saldo, pide confirmación. Marca las camas como
   `dirty`, igual que el check-out individual.
6. **Pago al grupo:** no acepta montos ≤ 0 ni montos mayores al saldo
   (`aplicarPagoGrupo`). Los métodos de pago salen de la config
   (`metodosOptions`). El grupo arranca con `pagado 0` y `saldo = total`. En el
   alta no hay seña, porque el brief no la pedía; la seña se carga con
   "Registrar pago" apenas se crea el grupo.
7. **Cancelar:** solo se puede con el grupo en `confirmada` y pide
   confirmación. Pasa el grupo y sus hijas a `cancelada`, lo que libera las
   camas: `cancelada` ya queda fuera de todos los chequeos de disponibilidad.
   **No hay reintegro automático:** si hubo pagos, el aviso lo dice y el
   reintegro se registra a mano en Caja.
8. **Auditoría:** un solo `logAuditoria` por operación, con entidad `grupo`
   (crear, check-in, check-out, pago, cancelar). No se loguea cada hija.
9. **Escape:** nombre del grupo, integrantes, obs y titular se renderizan con
   `escapeHtml`, en el detalle y en todos los badges (`grupoTag`).

## Dashboard: qué se revisó y qué se tocó

- **Ocupación:** `renderDashboard` cuenta `reservas.filter(estado === 'checkin')`.
  Las hijas son reservas en `checkin` tras el check-in grupal, así que **ya cuentan
  bien**. No hubo que cambiar nada. Lo mismo pasa con el resumen del mapa y con
  `calcularOcupacionGlobal`.
- **Ingresos del día / contabilidad / reportes:** salen de `movimientos`, no de
  reservas. Como las hijas no generan movimientos y los pagos del grupo sí, **ya
  cuentan bien**. No hubo que cambiar nada.
- **Cambios de presentación, sin tocar cálculos:**
  - Las listas "próximos check-ins/check-outs" muestran el badge del grupo en
    vez del titular.
  - `pagoBadge` (helpers) muestra "Grupal" para las hijas. Antes habría dicho
    "Pagado", porque su saldo es 0.

## Otras vistas tocadas (solo presentación)

- **Reservas:** las hijas muestran badge 👥 grupo, total "Grupal" y "Ver grupo".
  La búsqueda también encuentra por nombre de grupo.
- **Grilla:** la celda de entrada muestra "👥 nombre del grupo". Click → detalle del grupo.
- **Check-in:** en las filas de hijas, "👥 Grupo" reemplaza a los botones individuales.
- **Mapa:** la cama muestra el grupo. Click en una cama de grupo → detalle del grupo.
- **Detalle de huésped:** si es titular, el grupo cuenta como **una** estadía
  con el total acordado, en lugar de N filas en $0.

## Pendientes / limitaciones conocidas

- **Tests:** en `main` hay 47 tests, no 57. Los 10 de `crearUsuario` están en
  `feat/crear-usuario-function`, que todavía no se mergeó. Con esta branch:
  **61 verdes** (47 + 14 nuevos).
- **Deploy de reglas pendiente (dueño).** Mientras las reglas endurecidas no se
  desplieguen, rige la regla vieja `auth != null` para todo y `grupos` funciona
  igual. Cuando se desplieguen, `grupos` ya queda incluido.
- **Borrar al titular** (Huéspedes → borrar) borra sus reservas, incluidas las
  hijas, pero deja el nodo del grupo huérfano. No lo toqué porque es el flujo
  existente de huéspedes.
- No hay pantalla para **editar** un grupo (fechas, camas, total). Para cambiarlo
  hoy: cancelar y volver a crear.
- No hay lista propia de grupos: al detalle se entra desde cualquier hija
  (Reservas, Grilla, Mapa, Check-in).
- No lo probé en navegador: el entorno no tenía Chromium y no quise escribir en
  la base real. Verificado: sintaxis de todos los módulos, que cada import nombrado
  exista como export, y los tests.

## Smoke test manual (para el dueño)

Conviene hacerlo con fechas futuras y camas libres, y cancelar el grupo al final.

**Alta**
- [ ] Reservas → aparece el botón "👥 Reserva grupal" junto a "+ Nueva reserva".
- [ ] Sin fechas, el bloque de camas dice "Elegí las fechas…".
- [ ] Con fechas cargadas, las camas ocupadas en ese rango aparecen grisadas con "(ocupada)".
- [ ] "Seleccionar todo el hostel" marca todas las libres (y un segundo click las desmarca). El contador se actualiza.
- [ ] Intentar guardar con 1 cama → error "al menos 2 camas".
- [ ] Total vacío o 0 → error. Salida anterior a la entrada → error.
- [ ] Titular "+ Alta rápida" sin DNI → error. Completo → se crea el huésped (verlo en Huéspedes).
- [ ] Nombre del grupo `<b>Test</b>` → se ve el texto literal, sin negrita (escape OK).
- [ ] Guardar → aviso "Grupo creado… (N camas)".

**Visualización**
- [ ] Reservas: N filas con badge "👥 nombre", total "Grupal", pago "Grupal", botón "Ver grupo".
- [ ] Buscar por nombre del grupo → aparecen las hijas.
- [ ] Grilla: las N camas muestran "👥 nombre" en las fechas del grupo.
- [ ] Nueva reserva individual en esas fechas: las camas del grupo figuran "no disponible".
- [ ] Historial → hay un solo registro "Nueva reserva grupal".

**Detalle y acciones**
- [ ] "Ver grupo" → datos, integrantes (con saltos de línea), obs, pagado $0, saldo = total.
- [ ] "Registrar pago" con un monto mayor al saldo → error. Pago parcial → baja el saldo.
- [ ] Contabilidad → Ingresos: aparece el movimiento con el concepto del grupo, una sola vez.
- [ ] Dashboard → "Ingresos hoy" suma ese pago (y no las hijas).
- [ ] Check-in grupal antes de la fecha de entrada → error. En la fecha (o con un grupo de hoy): todas las hijas pasan a "En hostel".
- [ ] Dashboard: la ocupación sube en N camas. Mapa: esas camas aparecen ocupadas con el grupo.
- [ ] Check-in → "En hostel": las hijas muestran badge del grupo y "👥 Grupo".
- [ ] Check-out grupal con saldo → pide confirmación. Después, las camas quedan "sucias" en el Mapa.

**Cancelar**
- [ ] Crear otro grupo, "Cancelar grupo" → confirmación. El grupo y las hijas quedan "Cancelada".
- [ ] Las camas vuelven a estar disponibles para una reserva nueva en esas fechas.

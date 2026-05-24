# Cloud Function `/cotizar`

Endpoint HTTP que expone el cotizador para que el bot de n8n lo consuma desde fuera del frontend.

## URL

```
https://cotizar-5jk73wvuzq-uc.a.run.app
```

Si redeployás y la URL cambia, está al final del output de `firebase deploy --only functions:cotizar`. También visible con `firebase functions:list --project alula-hostel`.

> La function se expone con `invoker: 'public'` en `onRequest` para que Cloud Run no bloquee con 403 antes de llegar al handler. La auth real la hace el header `x-api-key`.

## Auth

Header obligatorio:

```
x-api-key: <secret>
```

El secret se guarda en GCP Secret Manager como `COTIZADOR_API_KEY` y se inyecta a la function en runtime.

## Request

```
POST <url>/cotizar
Content-Type: application/json
x-api-key: <secret>

{
  "tenant": "alula",
  "entrada": "2026-06-15",
  "salida":  "2026-06-18",
  "cantidadCamas": 1
}
```

- `tenant`: por ahora solo `"alula"`. Otros valores → 400.
- `entrada` / `salida`: `YYYY-MM-DD`. Si están mal o `salida <= entrada`, la function devuelve **200** con `{ok:false, error:'fechas_invalidas'|'fechas_invertidas'}` (es error de negocio del cotizador puro, no del HTTP).
- `cantidadCamas`: entero ≥ 1, default 1.

## Response

La function devuelve **exactamente** el objeto que retorna `cotizar()`. El contrato vive en [js/services/cotizador.service.js](../js/services/cotizador.service.js).

Forma resumida:

```jsonc
// happy path
{
  "ok": true,
  "noches": 3,
  "entrada": "2026-06-15",
  "salida": "2026-06-18",
  "ocupacion": 12,
  "temporada": "media",
  "precioBase": 30000,
  "moneda": "ARS",
  "camas": [ /* todas las camas disponibles, ordenadas por precioTotal asc */ ],
  "sugerencia": { /* la cama con mejor score */ },
  "alternativas": [ /* top 5 sin la sugerencia */ ],
  "warnings": []
}
```

```jsonc
// errores de negocio (todavía HTTP 200)
{ "ok": false, "error": "fechas_invalidas", "mensaje": "..." }
{ "ok": false, "error": "fechas_invertidas", "mensaje": "..." }
{ "ok": false, "error": "sin_camas", "mensaje": "Pediste N camas, solo hay M disponibles" }
```

## Códigos HTTP

| Código | Cuándo | Body |
|---|---|---|
| **200** | Cotización OK o error de negocio (`ok:false`) | objeto de `cotizar()` |
| **400** | `tenant` faltante o no soportado | `{error:'tenant_no_soportado', mensaje}` |
| **401** | Falta o es inválido `x-api-key` | `{error:'unauthorized', mensaje}` |
| **405** | Método ≠ POST | `{error:'method_not_allowed', mensaje}` |
| **500** | Error interno (Firebase no responde, bug del handler) | `{error:'internal', mensaje}` |

## Operación

### Rotar la API key

```bash
NEW_KEY=$(openssl rand -hex 32)
printf '%s' "$NEW_KEY" | firebase functions:secrets:set COTIZADOR_API_KEY --project alula-hostel --data-file=-
firebase deploy --only functions:cotizar --project alula-hostel
echo "Nueva key: $NEW_KEY  ← copiar a n8n y borrar este shell"
```

La versión anterior queda disponible (Secret Manager guarda historial); destruir con:

```bash
firebase functions:secrets:destroy COTIZADOR_API_KEY --project alula-hostel
```

Versión específica:
```bash
firebase functions:secrets:access COTIZADOR_API_KEY[@<n>] --project alula-hostel
```

### Ver logs

```bash
firebase functions:log --only cotizar --project alula-hostel
firebase functions:log --only cotizar --lines 50 --project alula-hostel
```

### Re-deploy

```bash
firebase deploy --only functions:cotizar --project alula-hostel
```

## Arquitectura

- `functions/index.js` — handler Gen 2 (`onRequest`), lee Firebase RTDB, llama al cotizador puro.
- `functions/cotizador.service.js` — **copia** de `js/services/cotizador.service.js`. Mantener en sync manualmente.
- `functions/camas.service.js` — **copia** de `js/services/camas.service.js`. Mantener en sync manualmente.

La razón de la duplicación: Cloud Functions empaqueta solo el contenido de `functions/`. Importar desde `../js/` no funciona en el deploy.

Si cambia la lógica del cotizador o del scoring/pricing, actualizar los tres archivos juntos (web app + ambas copias en `functions/`).

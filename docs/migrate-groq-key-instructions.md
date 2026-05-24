# Migración de `groqApiKey` a `alula/secrets` (manual)

## Contexto

La API key de Groq vivía en `alula/config/groqApiKey`. Como `alula/config` es
legible por **cualquier usuario autenticado**, la key quedaba expuesta a todo
el equipo (recepción, ventas, limpieza), no sólo a admins.

Sin un backend no podemos sacar la key del cliente del todo, pero **sí** podemos
moverla a un nodo separado `alula/secrets` y restringir su lectura/escritura a
admins vía reglas de Firebase.

- **Código** (esta rama `chore/restrict-groq-api-key`): ya lee/escribe desde
  `alula/secrets`.
- **Reglas** (rama `chore/firebase-rules`): se agregó el bloque `secrets`
  (solo-admin). **NO deployado** todavía.

## ⚠️ Importante: el chatbot/OCR queda sin key hasta migrar

Apenas se mergee el cambio de código, `DB.get('secrets')` estará **vacío** hasta
que se copie el dato. Síntoma: el chatbot pide la API key de nuevo y el OCR
avisa "No hay API key de Groq". Es esperado hasta completar el paso 2.

## ⚠️ Esto NO se ejecuta automáticamente

El agente nocturno no movió ni borró datos en Firebase. Comandos de escritura
abajo, **sin ejecutar**, para correr a mano.

## Pasos

### 1. Leer la key actual (backup)

```bash
firebase database:get "/alula/config/groqApiKey" > /tmp/groq-key.json
cat /tmp/groq-key.json   # debería verse "gsk_...."
```

### 2. Escribirla en el nodo nuevo `alula/secrets/groqApiKey`

```bash
# NO ejecutar hasta confirmar el valor del paso 1
firebase database:set /alula/secrets/groqApiKey "$(cat /tmp/groq-key.json | tr -d '\"')"
```

(o, más simple, desde la app ya migrada: abrir el chatbot como admin y pegar la
key de nuevo — `saveApiKey()` ahora la guarda en `alula/secrets`.)

### 3. Verificar que quedó en secrets

```bash
firebase database:get "/alula/secrets/groqApiKey"   # debe mostrar la key
```

### 4. Borrar la copia vieja de `alula/config`

```bash
# NO ejecutar hasta confirmar el paso 3
firebase database:set /alula/config/groqApiKey null
```

### 5. (Cuando se haga la Tarea 6 y se deployen las reglas)

Deployar las reglas de `chore/firebase-rules` que restringen `alula/secrets` a
admins. **No** deployar reglas hasta que los cambios de front (Tarea 6) estén
listos, o se rompe la lectura amplia que todavía hace el front.

## Orden recomendado

1. Mergear `chore/restrict-groq-api-key` (código) + Tarea 6 (front).
2. Migrar el dato (pasos 1–4 de acá).
3. Recién entonces deployar las reglas endurecidas (incluye el bloque `secrets`).

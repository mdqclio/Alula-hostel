# Limpieza del campo `pass` en `/alula/usuarios` (manual)

## Contexto

El campo `pass` guardaba contraseñas en **texto plano** dentro de
`alula/usuarios[]`. Firebase Auth ya gestiona las contraseñas (hash + salt del
lado de Google), así que ese campo era **redundante y un riesgo de seguridad**.

El **código ya no escribe** `pass` (commit `chore: stop storing plaintext
passwords...`). Falta limpiar los registros **ya existentes** en la base.

> Inspección al momento del cambio: 4 usuarios, **2** todavía tenían `.pass`.

## ⚠️ Esto NO se ejecuta automáticamente

El agente nocturno dejó esto documentado para que lo corras vos, despierto y con
la base a la vista. Los comandos de escritura están a propósito **sin ejecutar**.

## Pasos

### 1. Backup (siempre primero)

```bash
firebase database:get "/alula/usuarios" > /tmp/users-backup.json
cp /tmp/users-backup.json /tmp/users-backup-$(date +%Y%m%d-%H%M%S).json   # copia con fecha
```

### 2. Generar la versión limpia (sin `pass`)

```bash
node scripts/strip-pass.js /tmp/users-backup.json /tmp/users-clean.json
```

El script preserva la estructura (array u objeto) que devuelve RTDB y reporta
cuántos `pass` removió. Revisá el diff antes de aplicar:

```bash
diff <(jq -S . /tmp/users-backup.json) <(jq -S . /tmp/users-clean.json)
```

### 3. Aplicar (manual — revisá el paso 2 antes)

```bash
# NO ejecutar hasta verificar /tmp/users-clean.json
firebase database:set /alula/usuarios /tmp/users-clean.json
```

### 4. Verificar

```bash
firebase database:get "/alula/usuarios" | node -e "
const a = JSON.parse(require('fs').readFileSync(0));
const arr = Array.isArray(a) ? a.filter(Boolean) : Object.values(a||{});
console.log('Con .pass restantes:', arr.filter(x => x.pass !== undefined).length);  // debe ser 0
"
```

## Notas

- Los **flujos de auth NO se tocaron**: `signInWithEmailAndPassword`,
  `createUserWithEmailAndPassword`, `updatePassword`,
  `reauthenticateWithCredential` y `EmailAuthProvider.credential` siguen usando
  la contraseña del input para Firebase Auth. Lo único que se eliminó es la
  **persistencia en la DB** del texto plano.
- Si algún usuario necesita resetear su contraseña, se hace por Firebase Auth
  (botón "Cambiar contraseña" en la app, o reset por email desde la consola de
  Firebase), no tocando este nodo.
- Rollback: `firebase database:set /alula/usuarios /tmp/users-backup.json`.

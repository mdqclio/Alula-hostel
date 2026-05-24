# Bootstrap de `alula/admins/{uid}` (manual)

## Contexto

Las reglas endurecidas (rama `chore/firebase-rules`) determinan si un usuario es
admin leyendo `root.child('alula/admins/'+auth.uid) === true`. (No se puede
iterar el array `alula/usuarios` desde una regla, por eso hace falta un índice
por `uid` de Firebase Auth.)

El código (`auth.js → syncAdminFlag`, vía `applyRoleUI`) **escribe esa flag en
cada login**: si el usuario es admin, `set(alula/admins/<uid>, true)`; si no,
`remove(...)`. Es **self-perpetuating** — cada admin que entra refresca su
propia flag.

## El problema del huevo y la gallina

Una vez **deployadas** las reglas endurecidas, escribir en `alula/admins` exige
**ya ser admin**. Si ningún `uid` está marcado, ningún admin puede marcarse, y
nadie puede escribir nada admin-only. Hay que **sembrar el primer admin antes**
de endurecer las reglas.

## ⚠️ No ejecutado automáticamente

El agente nocturno no escribió en `alula/admins`. Pasos manuales abajo.

## Opción A — Sembrar con las reglas actuales (recomendado, más simple)

Las reglas **actuales** permiten escribir con `auth != null`. Entonces:

1. Mergeá esta rama (`feat/rules-frontend-prep`) a `main` y abrí la app.
2. Iniciá sesión con **cada usuario admin** una vez. En ese login,
   `syncAdminFlag` escribe `alula/admins/<uid> = true` solo.
3. Verificá:
   ```bash
   firebase database:get "/alula/admins"
   ```
   Deberías ver un objeto `{ "<uid1>": true, "<uid2>": true, ... }`.
4. Recién con todos los admins marcados, deployá las reglas endurecidas.

## Opción B — Sembrar a mano por consola / CLI

Si preferís no depender del login, conseguí el `uid` de cada admin (Firebase
Console → Authentication → columna User UID) y escribí:

```bash
# NO ejecutar sin reemplazar <UID_ADMIN> por el uid real
firebase database:set "/alula/admins/<UID_ADMIN>" true
```

Repetir por cada admin. Verificar con `firebase database:get "/alula/admins"`.

## Mapear usuarios → uid

`alula/usuarios[].id` es un id interno (`u123...`), **no** el `uid` de Firebase
Auth. Para mapear email → uid:

```bash
# lista los usuarios de Firebase Auth (uid + email)
firebase auth:export /tmp/auth-users.json --format=json
node -e "
const a = JSON.parse(require('fs').readFileSync('/tmp/auth-users.json')).users || [];
a.forEach(u => console.log(u.localId, u.email));
"
```

Cruzá esos `uid` con los usuarios cuyo `rol === 'rol-admin'` en `alula/usuarios`.

## Notas

- Esto **no** depende de que las reglas estén deployadas: funciona con las
  reglas actuales (`auth != null`).
- Bajo reglas endurecidas, un **no-admin** que intente el `remove()` recibirá
  permission-denied (capturado, sin romper el login) — es esperado.

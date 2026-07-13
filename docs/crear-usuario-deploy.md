# Deploy de la Function `crearUsuario` — pasos manuales

Branch: `feat/crear-usuario-function`. El código está listo; faltan los pasos
que **hacés vos** (yo NO deployo). El front tiene un placeholder en la URL que
hay que completar con la URL real que devuelve el deploy.

> Prerrequisito ya cumplido en bloques anteriores: `alula/admins/<uid>` sembrado
> para los 2 admins. La Function autoriza leyendo ese nodo, así que sin admins
> sembrados nadie podría crear usuarios.

## 1. Deploy de la Function (solo esta function)

```bash
firebase deploy --only functions:crearUsuario --project alula-hostel
```

- Si es el primer deploy de functions en este proyecto, puede pedir habilitar
  APIs (Cloud Functions, Cloud Build, Artifact Registry) y una cuenta de
  facturación (plan Blaze). `cotizar` ya está deployada, así que debería estar
  todo habilitado.
- La Function NO usa secrets (a diferencia de `cotizar`). No hace falta setear
  `COTIZADOR_API_KEY` para esta.

## 2. Obtener la URL

Al terminar, la CLI imprime la Function URL, con forma:

```
Function URL (crearUsuario(us-central1)): https://us-central1-alula-hostel.cloudfunctions.net/crearUsuario
```

Si te la perdiste:

```bash
firebase functions:list --project alula-hostel
```

(o Firebase Console → Functions → `crearUsuario` → Trigger URL).

## 3. Pegar la URL en la constante del front

Editar `js/usuarios.js`, cerca del tope:

```js
const CREAR_USUARIO_URL = '__COMPLETAR_TRAS_DEPLOY__';
```

Reemplazar el placeholder por la URL real, p. ej.:

```js
const CREAR_USUARIO_URL = 'https://us-central1-alula-hostel.cloudfunctions.net/crearUsuario';
```

## 4. Commit final

```bash
git add js/usuarios.js
git commit -m "chore(usuarios): completar URL de la Function crearUsuario tras el deploy"
git push
```

(Sigue sin mergear a `main` hasta que valides el smoke test.)

## 5. Smoke test

1. Deployá también el front (hosting) con la URL ya completada, o probá local
   apuntando a la URL de producción de la Function.
2. Login como **admin** en el panel.
3. Usuarios → **Nuevo Usuario** → completá email, contraseña (≥ 6), nombre y rol
   → Guardar.
4. Esperado:
   - Notificación "Usuario creado: <nombre>".
   - El usuario aparece en la tabla (el front hace `loadAllData()` tras el OK).
   - En Firebase Console → Authentication aparece el nuevo usuario.
   - En RTDB, `alula/usuarios` tiene el nuevo registro con `uid` y `estado:activo`,
     y `alula/auditoria` tiene una entrada `crear/usuario` con el admin que lo creó.
5. Casos de error a verificar rápido:
   - Email ya existente → "Ese email ya existe" (409).
   - (Opcional) Un usuario NO admin no debería poder crear: 403 → "No tenés
     permisos". El sign-up público de Firebase Auth sigue deshabilitado.

## Notas de seguridad / follow-ups

- La Function usa `cors: true` (cualquier origen). La seguridad NO depende del
  CORS: exige un **Firebase ID token de un admin** (`verifyIdToken` +
  `alula/admins/<uid> === true`). Un origen atacante igual necesitaría un token
  de admin válido. Si querés endurecer, restringí el `cors` al dominio de
  hosting en `functions/index.js`.
- La Function escribe `alula/usuarios` y `alula/auditoria` como **arrays
  completos** (patrón full-array del proyecto), vía Admin SDK (bypassa reglas).
- NO se tocaron: `database.rules.json`, el flujo de `preRegistros`, ni el form
  público.

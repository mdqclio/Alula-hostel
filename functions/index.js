import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { cotizar as cotizarPure } from './cotizador.service.js';
import { validateCrearUsuarioBody } from './crear-usuario.validate.js';

const COTIZADOR_API_KEY = defineSecret('COTIZADOR_API_KEY');

initializeApp();

const ALLOWED_TENANTS = new Set(['alula']);

export const cotizar = onRequest(
  { secrets: [COTIZADOR_API_KEY], region: 'us-central1', invoker: 'public' },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'method_not_allowed', mensaje: 'Use POST.' });
        return;
      }

      const apiKey = req.get('x-api-key');
      if (!apiKey || apiKey !== COTIZADOR_API_KEY.value()) {
        res.status(401).json({ error: 'unauthorized', mensaje: 'Missing or invalid x-api-key.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      const { tenant, entrada, salida, cantidadCamas } = body;

      if (!tenant || typeof tenant !== 'string' || !ALLOWED_TENANTS.has(tenant)) {
        res.status(400).json({ error: 'tenant_no_soportado', mensaje: `Tenant '${tenant}' no soportado.` });
        return;
      }

      // Validación de entradas barata en el borde HTTP (la lógica de cálculo de
      // cotizador.service.js no cambia; sólo evitamos llamarla con basura).
      if (typeof entrada !== 'string' || typeof salida !== 'string') {
        res.status(400).json({ error: 'fechas_requeridas', mensaje: 'entrada y salida deben ser strings YYYY-MM-DD.' });
        return;
      }
      // cantidadCamas: si viene, debe ser un entero positivo razonable.
      if (cantidadCamas !== undefined) {
        const n = Number(cantidadCamas);
        if (!Number.isInteger(n) || n < 1 || n > 1000) {
          res.status(400).json({ error: 'cantidad_camas_invalida', mensaje: 'cantidadCamas debe ser un entero entre 1 y 1000.' });
          return;
        }
      }

      const db = getDatabase();
      const [reservasSnap, camasConfigSnap, configSnap] = await Promise.all([
        db.ref(`${tenant}/reservas`).get(),
        db.ref(`${tenant}/camasConfig`).get(),
        db.ref(`${tenant}/config`).get(),
      ]);

      const reservasVal = reservasSnap.val() || {};
      const reservas = Array.isArray(reservasVal) ? reservasVal.filter(Boolean) : Object.values(reservasVal);
      const camasConfig = camasConfigSnap.val() || {};
      const config = configSnap.val() || {};
      const habitaciones = (config.hostel && config.hostel.habitaciones) || [];
      const temporadas = config.temporadas || {};
      const monedas = config.monedas || [];

      const result = cotizarPure({
        entrada,
        salida,
        cantidadCamas: Number(cantidadCamas) || 1,
        reservas,
        camasConfig,
        habitaciones,
        temporadas,
        monedas,
      });

      res.status(200).json(result);
    } catch (err) {
      console.error('cotizar internal error:', err);
      res.status(500).json({ error: 'internal', mensaje: 'Internal server error.' });
    }
  }
);

// Crea un usuario del panel sin usar el sign-up público de Firebase Auth (que
// está deshabilitado a propósito). La identidad la aporta el ADMIN logueado vía
// su Firebase ID token; NO hay API key compartida. Molde: `cotizar` (arriba).
// `cors: true` maneja el preflight OPTIONS del browser (el header Authorization
// no es simple). La seguridad no depende del CORS: exige un ID token de admin.
export const crearUsuario = onRequest(
  { region: 'us-central1', cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'method_not_allowed', mensaje: 'Use POST.' });
        return;
      }

      // --- Autenticación: identidad del caller vía Firebase ID token ---
      const authHeader = req.get('Authorization') || '';
      const m = authHeader.match(/^Bearer (.+)$/);
      if (!m) {
        res.status(401).json({ error: 'unauthorized', mensaje: 'Falta el header Authorization: Bearer <token>.' });
        return;
      }
      let decoded;
      try {
        decoded = await getAuth().verifyIdToken(m[1]);
      } catch (e) {
        res.status(401).json({ error: 'unauthorized', mensaje: 'Token inválido o expirado.' });
        return;
      }
      const callerUid = decoded.uid;

      const db = getDatabase();

      // --- Autorización: el caller debe ser admin (alula/admins/<uid> === true) ---
      const adminSnap = await db.ref(`alula/admins/${callerUid}`).get();
      if (adminSnap.val() !== true) {
        res.status(403).json({ error: 'forbidden', mensaje: 'Solo un administrador puede crear usuarios.' });
        return;
      }

      // --- Validación del body (lógica pura, testeada en crear-usuario.validate.test.js) ---
      const rolesSnap = await db.ref('alula/roles').get();
      const rolesVal = rolesSnap.val() || [];
      const roles = Array.isArray(rolesVal) ? rolesVal.filter(Boolean) : Object.values(rolesVal);
      const rolesIds = roles.map(r => r && r.id).filter(Boolean);

      const check = validateCrearUsuarioBody(req.body, rolesIds);
      if (!check.valid) {
        res.status(400).json({ error: check.error, mensaje: check.mensaje });
        return;
      }
      const { email, password, nombre, rolId } = check.value;

      // --- Crear el usuario en Firebase Auth ---
      let userRecord;
      try {
        userRecord = await getAuth().createUser({ email, password });
      } catch (e) {
        if (e && e.code === 'auth/email-already-exists') {
          res.status(409).json({ error: 'email_existe', mensaje: 'Ese email ya está registrado.' });
          return;
        }
        throw e; // cae al catch general → 500 sin filtrar detalles internos
      }

      // --- Apéndice a alula/usuarios ---
      // PATRÓN FULL-ARRAY CONOCIDO: alula/usuarios es un array completo. Se lee,
      // se apendea y se reescribe entero. Desde el Admin SDK no hay problema de
      // permisos (bypassa las reglas RTDB). Mismo shape que saveUsuario en
      // js/usuarios.js: { id:'u'+Date.now(), uid, nombre, email, rol, estado }.
      const usuariosSnap = await db.ref('alula/usuarios').get();
      const usuariosVal = usuariosSnap.val() || [];
      const usuarios = Array.isArray(usuariosVal) ? usuariosVal.filter(Boolean) : Object.values(usuariosVal);
      const nuevoU = {
        id: 'u' + Date.now(),
        uid: userRecord.uid,
        nombre,
        email,
        rol: rolId,
        estado: 'activo',
      };
      usuarios.push(nuevoU);
      await db.ref('alula/usuarios').set(usuarios);

      // --- Auditoría (mismo shape que logAuditoria del front; array completo) ---
      const caller = usuarios.find(u => u && u.uid === callerUid);
      const usuarioAudit = caller
        ? { id: caller.id, nombre: caller.nombre, email: caller.email }
        : { id: callerUid, nombre: decoded.name || decoded.email || callerUid, email: decoded.email || '' };
      const auditSnap = await db.ref('alula/auditoria').get();
      const auditVal = auditSnap.val() || [];
      const logs = Array.isArray(auditVal) ? auditVal.filter(Boolean) : Object.values(auditVal);
      logs.push({
        id: 'aud' + Date.now() + Math.random().toString(36).slice(2, 5),
        fecha: new Date().toISOString(),
        usuario: usuarioAudit,
        accion: 'crear',
        entidad: 'usuario',
        entidadId: nuevoU.id,
        descripcion: `Usuario creado por admin: ${nombre} (${email}) — rol ${rolId}`,
        cambios: { antes: null, despues: { nombre, email, rol: rolId, estado: 'activo' } },
      });
      await db.ref('alula/auditoria').set(logs);

      res.status(201).json({ ok: true, id: nuevoU.id, uid: userRecord.uid });
    } catch (err) {
      console.error('crearUsuario internal error:', err);
      res.status(500).json({ error: 'internal', mensaje: 'Internal server error.' });
    }
  }
);

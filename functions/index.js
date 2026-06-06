import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { cotizar as cotizarPure } from './cotizador.service.js';

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

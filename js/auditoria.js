// ===================== AUDITORÍA / LOG DE CAMBIOS =====================
import { DB } from './firebase-config.js';
import { today } from './helpers.js';

// Módulo de paginación y filtrado
let _historialFiltrados = [];
let _historialPage = 0;
const PAGE_SIZE = 100;

// ===================== HELPER PRINCIPAL =====================
/**
 * Registra un evento en el log de auditoría.
 * Silencioso: nunca lanza excepción ni interrumpe la operación.
 */
export async function logAuditoria(accion, entidad, entidadId, descripcion, antes = null, despues = null) {
  try {
    // Import dinámico para evitar ciclo circular con auth.js
    const { currentUser } = await import('./auth.js');
    const usuario = currentUser.value
      ? { id: currentUser.value.id, nombre: currentUser.value.name, email: currentUser.value.email }
      : { id: 'anon', nombre: 'Anónimo', email: '' };

    const registro = {
      id: 'aud' + Date.now() + Math.random().toString(36).slice(2, 5),
      fecha: new Date().toISOString(),
      usuario,
      accion,       // 'crear' | 'editar' | 'eliminar' | 'login' | 'logout'
      entidad,      // 'reserva' | 'huesped' | 'movimiento' | 'usuario' | 'config' | 'cuenta' | 'score'
      entidadId: entidadId || null,
      descripcion,
      cambios: { antes: antes ?? null, despues: despues ?? null }
    };

    const logs = DB.get('auditoria', []);
    logs.push(registro);
    DB.set('auditoria', logs); // fire-and-forget
  } catch(e) {
    console.warn('[auditoria] fallo silencioso:', e?.message || e);
  }
}

// ===================== HISTORIAL UI =====================
export function renderHistorial() {
  const c = document.getElementById('historialContent');
  if (!c) return;

  const tod = today();
  const primerDiaMes = tod.slice(0, 7) + '-01';
  const inp = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:7px 10px;width:100%;font-size:13px;';

  c.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;min-width:140px;">
            <label>Desde</label>
            <input type="date" id="aud-desde" value="${primerDiaMes}" style="${inp}">
          </div>
          <div class="form-group" style="margin:0;min-width:140px;">
            <label>Hasta</label>
            <input type="date" id="aud-hasta" value="${tod}" style="${inp}">
          </div>
          <div class="form-group" style="margin:0;min-width:130px;">
            <label>Acción</label>
            <select id="aud-accion" style="${inp}">
              <option value="">Todas</option>
              <option value="crear">Crear</option>
              <option value="editar">Editar</option>
              <option value="eliminar">Eliminar</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:140px;">
            <label>Entidad</label>
            <select id="aud-entidad" style="${inp}">
              <option value="">Todas</option>
              <option value="reserva">Reserva</option>
              <option value="huesped">Huésped</option>
              <option value="movimiento">Movimiento</option>
              <option value="usuario">Usuario</option>
              <option value="config">Config</option>
              <option value="cuenta">Cuenta</option>
              <option value="score">Score</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:180px;">
            <label>Buscar</label>
            <input type="text" id="aud-buscar" placeholder="Texto libre..." style="${inp}">
          </div>
          <button class="btn btn-blue btn-sm" onclick="aplicarFiltroHistorial()" style="align-self:flex-end">Filtrar</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Historial de cambios</h3>
        <span id="aud-count" style="font-size:12px;color:var(--text3)"></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Descripción</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody id="aud-tabla"></tbody>
      </table>
      <div id="aud-paginacion" style="padding:12px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border);"></div>
    </div>`;

  aplicarFiltroHistorial();
}

export function aplicarFiltroHistorial() {
  const desde  = document.getElementById('aud-desde')?.value || '';
  const hasta   = document.getElementById('aud-hasta')?.value || '';
  const accion  = document.getElementById('aud-accion')?.value || '';
  const entidad = document.getElementById('aud-entidad')?.value || '';
  const buscar  = document.getElementById('aud-buscar')?.value.toLowerCase() || '';

  let logs = DB.get('auditoria', []);

  if (desde)   logs = logs.filter(l => l.fecha.slice(0, 10) >= desde);
  if (hasta)   logs = logs.filter(l => l.fecha.slice(0, 10) <= hasta);
  if (accion)  logs = logs.filter(l => l.accion === accion);
  if (entidad) logs = logs.filter(l => l.entidad === entidad);
  if (buscar)  logs = logs.filter(l =>
    l.descripcion?.toLowerCase().includes(buscar) ||
    l.usuario?.nombre?.toLowerCase().includes(buscar) ||
    (l.entidadId || '').toLowerCase().includes(buscar)
  );

  logs.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

  _historialFiltrados = logs;
  _historialPage = 0;
  _renderPagina();
}

function _renderPagina() {
  const total      = _historialFiltrados.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const inicio     = _historialPage * PAGE_SIZE;
  const pagina     = _historialFiltrados.slice(inicio, inicio + PAGE_SIZE);

  const accionColor = {
    crear: '#34d399', editar: '#60a5fa', eliminar: '#f87171',
    login: '#a78bfa', logout: '#94a3b8'
  };

  const countEl = document.getElementById('aud-count');
  if (countEl) countEl.textContent = `${total} registro(s)`;

  const tablaEl = document.getElementById('aud-tabla');
  if (tablaEl) tablaEl.innerHTML = pagina.length
    ? pagina.map(l => {
        const fecha = new Date(l.fecha).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const color = accionColor[l.accion] || '#94a3b8';
        const tieneCambios = l.cambios?.antes !== null || l.cambios?.despues !== null;
        return `<tr>
          <td style="font-family:'DM Mono';font-size:11px;white-space:nowrap">${fecha}</td>
          <td style="font-size:12px">${l.usuario?.nombre || '—'}</td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44">${l.accion}</span></td>
          <td style="font-size:12px;color:var(--text2)">${l.entidad}</td>
          <td style="font-size:13px">${l.descripcion}</td>
          <td>${tieneCambios ? `<button class="btn btn-ghost btn-sm" onclick="verDetalleAuditoria('${l.id}')">Ver</button>` : '<span style="color:var(--text3);font-size:12px">—</span>'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Sin registros en este período</td></tr>';

  const pagEl = document.getElementById('aud-paginacion');
  if (!pagEl) return;
  if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
  pagEl.innerHTML = `
    <span style="font-size:12px;color:var(--text3)">Página ${_historialPage + 1} de ${totalPages} (${total} registros)</span>
    ${_historialPage > 0 ? `<button class="btn btn-ghost btn-sm" onclick="historialPaginaAnterior()">◀ Anterior</button>` : ''}
    ${_historialPage < totalPages - 1 ? `<button class="btn btn-ghost btn-sm" onclick="historialPaginaSiguiente()">Siguiente ▶</button>` : ''}
  `;
}

export function historialPaginaAnterior() {
  if (_historialPage > 0) { _historialPage--; _renderPagina(); }
}

export function historialPaginaSiguiente() {
  const totalPages = Math.ceil(_historialFiltrados.length / PAGE_SIZE);
  if (_historialPage < totalPages - 1) { _historialPage++; _renderPagina(); }
}

export function verDetalleAuditoria(id) {
  const logs = DB.get('auditoria', []);
  const l = logs.find(x => x.id === id);
  if (!l) return;

  const fecha = new Date(l.fecha).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const fmt = v => v !== null && v !== undefined
    ? `<pre style="background:var(--surface3);padding:10px;border-radius:var(--radius);font-size:11px;font-family:'DM Mono';overflow:auto;max-height:220px;white-space:pre-wrap;word-break:break-all">${JSON.stringify(v, null, 2)}</pre>`
    : '<span style="color:var(--text3);font-size:12px">—</span>';

  document.getElementById('audDetalleFecha').textContent       = fecha;
  document.getElementById('audDetalleUsuario').textContent     = `${l.usuario?.nombre || '—'} (${l.usuario?.email || '—'})`;
  document.getElementById('audDetalleAccion').textContent      = l.accion;
  document.getElementById('audDetalleEntidad').textContent     = `${l.entidad}${l.entidadId ? ' — ' + l.entidadId : ''}`;
  document.getElementById('audDetalleDesc').textContent        = l.descripcion;
  document.getElementById('audDetalleAntes').innerHTML         = fmt(l.cambios?.antes);
  document.getElementById('audDetalleDespues').innerHTML       = fmt(l.cambios?.despues);

  const { openModal } = window;
  if (openModal) openModal('modalAuditoriaDetalle');
}

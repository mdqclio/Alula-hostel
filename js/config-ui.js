// ===================== CONFIGURACIÓN =====================
import { DB } from './firebase-config.js';
import { showNotif } from './helpers.js';
import { getConfig, CONFIG_DEFAULTS, getTotalCamas } from './config.js';

function _periodoLabel(p) {
  const rango = p.tipo === 'anual'
    ? `Cada año: ${p.desde} al ${p.hasta}`
    : `${p.desde} al ${p.hasta}`;
  return p.nombre ? `<strong>${p.nombre}</strong> — ${rango}` : rango;
}

export function renderConfig() {
  const cfg = getConfig();
  const inp = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:7px 10px;width:100%;font-size:13px;';
  const textColors = { alta: '#f87171', media: '#fbbf24', baja: '#34d399' };
  const bgColors   = { alta: 'rgba(220,38,38,0.08)', media: 'rgba(217,119,6,0.08)', baja: 'rgba(5,150,105,0.08)' };
  const borderColors = { alta: 'rgba(220,38,38,0.25)', media: 'rgba(217,119,6,0.25)', baja: 'rgba(5,150,105,0.25)' };

  const c = document.getElementById('configContent');
  c.innerHTML = `
    <div style="display:grid;gap:24px;">

      <!-- HOSTEL -->
      <div class="card">
        <div class="card-header">
          <h3>🏨 Estructura del Hostel</h3>
          <span style="font-size:12px;color:var(--text3)">Total activas: <strong style="color:var(--text)">${getTotalCamas()} camas</strong></span>
        </div>
        <div style="padding:16px 20px 8px;">
          <div class="form-group" style="max-width:280px;margin-bottom:16px;">
            <label>Nombre del hostel</label>
            <input type="text" id="cfg-nombre" value="${cfg.hostel.nombre}" style="${inp}">
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">HABITACIÓN</th>
                <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">NOMBRE</th>
                <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">CAMAS</th>
                <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">ACTIVA</th>
                <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">NOTA</th>
                <th style="padding:6px 4px;"></th>
              </tr>
            </thead>
            <tbody>
              ${cfg.hostel.habitaciones.map((h, i) => `
              <tr style="border-bottom:1px solid var(--border);${!h.activa ? 'opacity:0.5' : ''}">
                <td style="padding:8px;color:var(--text3);font-size:12px;">Hab. ${h.id}</td>
                <td style="padding:8px;">
                  <input type="text" value="${h.nombre}" id="cfg-hab-nombre-${i}" style="${inp}padding:5px 8px;">
                </td>
                <td style="padding:8px;text-align:center;">
                  <input type="number" value="${h.camas}" id="cfg-hab-camas-${i}" min="0" max="30"
                    style="${inp}padding:5px 8px;width:70px;text-align:center;">
                </td>
                <td style="padding:8px;text-align:center;">
                  <input type="checkbox" id="cfg-hab-activa-${i}" ${h.activa ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                </td>
                <td style="padding:8px;">
                  <input type="text" value="${h.nota || ''}" id="cfg-hab-nota-${i}" placeholder="En obras, cerrada..."
                    style="${inp}padding:5px 8px;">
                </td>
                <td style="padding:8px;">
                  <button class="btn btn-red btn-sm" style="padding:3px 8px;font-size:11px;" onclick="removeHabitacion(${i})">✕</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding:12px 20px 20px;display:flex;gap:10px;align-items:center;">
          <button class="btn btn-blue btn-sm" onclick="saveConfigHostel()">Guardar estructura</button>
          <button class="btn btn-ghost btn-sm" onclick="addHabitacion()">+ Agregar habitación</button>
        </div>
      </div>

      <!-- TEMPORADAS Y PRECIOS -->
      ${['alta', 'media', 'baja'].map(tipo => {
        const t = cfg.temporadas[tipo];
        const periodos = t.periodos || [];
        return `
        <div class="card">
          <div class="card-header" style="border-bottom-color:${borderColors[tipo]}">
            <h3 style="color:${textColors[tipo]}">💲 ${t.nombre}</h3>
            <span style="font-size:12px;color:var(--text3)">${periodos.length} período${periodos.length !== 1 ? 's' : ''} definido${periodos.length !== 1 ? 's' : ''}</span>
          </div>
          <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${textColors[tipo]};font-weight:600;margin-bottom:14px;">Precio base</div>
              <div class="form-group" style="margin-bottom:10px;"><label style="font-size:11px;">Nombre de la temporada</label>
                <input type="text" id="cfg-t-${tipo}-nombre" value="${t.nombre}" style="${inp}"></div>
              <div class="form-group" style="margin-bottom:10px;"><label style="font-size:11px;">Precio por noche</label>
                <input type="number" id="cfg-t-${tipo}-precio" value="${t.precio}" min="0" style="${inp}"></div>
              <div class="form-group" style="margin-bottom:14px;"><label style="font-size:11px;">Moneda</label>
                <select id="cfg-t-${tipo}-moneda" style="${inp}">
                  <option ${t.moneda === 'ARS' ? 'selected' : ''}>ARS</option>
                  <option ${t.moneda === 'USD' ? 'selected' : ''}>USD</option>
                </select></div>
              <button class="btn btn-blue btn-sm" onclick="saveConfigTemporada('${tipo}')">Guardar precio</button>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${textColors[tipo]};font-weight:600;margin-bottom:14px;">Períodos activos</div>
              ${periodos.length === 0
                ? `<p style="font-size:12px;color:var(--text3);margin-bottom:12px;">Sin períodos — el precio base se usa como referencia manual.</p>`
                : periodos.map(p => `
                  <div style="display:flex;justify-content:space-between;align-items:center;background:${bgColors[tipo]};border:1px solid ${borderColors[tipo]};border-radius:var(--radius);padding:8px 10px;margin-bottom:6px;font-size:12px;">
                    <div>
                      <span style="font-size:10px;color:${textColors[tipo]};text-transform:uppercase;font-weight:600;">${p.tipo === 'anual' ? 'Anual' : 'Una vez'}</span><br>
                      <span style="color:var(--text)">${_periodoLabel(p)}</span>
                    </div>
                    <button class="btn btn-red btn-sm" style="padding:3px 8px;font-size:11px;" onclick="deletePeriodo('${tipo}','${p.id}')">✕</button>
                  </div>`).join('')}
              <div id="add-periodo-form-${tipo}" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-top:8px;">
                <div style="margin-bottom:8px;">
                  <label style="font-size:11px;color:var(--text3);">Nombre del período</label>
                  <input type="text" id="cfg-periodo-nombre-${tipo}" placeholder="Ej: Carnaval, Semana Santa..." style="${inp}margin-top:4px;">
                </div>
                <div style="margin-bottom:8px;">
                  <label style="font-size:11px;color:var(--text3);">Tipo</label>
                  <select id="cfg-periodo-tipo-${tipo}" onchange="togglePeriodoTipo('${tipo}')" style="${inp}margin-top:4px;">
                    <option value="anual">Anual (se repite cada año)</option>
                    <option value="especifico">Específico (fecha exacta)</option>
                  </select>
                </div>
                <div id="cfg-periodo-anual-${tipo}">
                  <p style="font-size:11px;color:var(--text3);margin-bottom:6px;">Seleccioná día y mes — el año se ignora, aplica todos los años.</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div><label style="font-size:11px;color:var(--text3);">Desde</label>
                      <input type="date" id="cfg-periodo-desde-${tipo}" style="${inp}margin-top:4px;"></div>
                    <div><label style="font-size:11px;color:var(--text3);">Hasta</label>
                      <input type="date" id="cfg-periodo-hasta-${tipo}" style="${inp}margin-top:4px;"></div>
                  </div>
                </div>
                <div id="cfg-periodo-especifico-${tipo}" style="display:none;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div><label style="font-size:11px;color:var(--text3);">Desde</label>
                      <input type="date" id="cfg-periodo-desde-esp-${tipo}" style="${inp}margin-top:4px;"></div>
                    <div><label style="font-size:11px;color:var(--text3);">Hasta</label>
                      <input type="date" id="cfg-periodo-hasta-esp-${tipo}" style="${inp}margin-top:4px;"></div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                  <button class="btn btn-green btn-sm" onclick="addPeriodo('${tipo}')">Agregar</button>
                  <button class="btn btn-ghost btn-sm" onclick="toggleAddPeriodo('${tipo}')">Cancelar</button>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;" onclick="toggleAddPeriodo('${tipo}')">+ Agregar período</button>
            </div>
          </div>
        </div>`;
      }).join('')}

      <!-- HORARIOS -->
      <div class="card">
        <div class="card-header"><h3>🕐 Horarios Estándar</h3></div>
        <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">
          <div class="form-group"><label>Check-in estándar</label>
            <input type="time" id="cfg-checkin" value="${cfg.horarios.checkin}" style="${inp}"></div>
          <div class="form-group"><label>Check-out estándar</label>
            <input type="time" id="cfg-checkout" value="${cfg.horarios.checkout}" style="${inp}"></div>
          <div class="form-group"><label>Late checkout (sugerido)</label>
            <input type="time" id="cfg-late" value="${cfg.horarios.lateCheckout}" style="${inp}"></div>
          <div class="form-group"><label>Early check-in (sugerido)</label>
            <input type="time" id="cfg-early" value="${cfg.horarios.earlyCheckin}" style="${inp}"></div>
        </div>
        <div style="padding:0 20px 20px;">
          <button class="btn btn-blue btn-sm" onclick="saveConfigHorarios()">Guardar horarios</button>
        </div>
      </div>

    </div>`;
}

export function toggleAddPeriodo(tipo) {
  const form = document.getElementById(`add-periodo-form-${tipo}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

export function togglePeriodoTipo(tipo) {
  const t = document.getElementById(`cfg-periodo-tipo-${tipo}`).value;
  document.getElementById(`cfg-periodo-anual-${tipo}`).style.display     = t === 'anual'     ? 'block' : 'none';
  document.getElementById(`cfg-periodo-especifico-${tipo}`).style.display = t === 'especifico' ? 'block' : 'none';
}

export async function addPeriodo(tipo) {
  const nombre = document.getElementById(`cfg-periodo-nombre-${tipo}`).value.trim();
  if (!nombre) { showNotif('Poné un nombre al período (ej: Carnaval, Semana Santa)', 'error'); return; }
  const tipoP = document.getElementById(`cfg-periodo-tipo-${tipo}`).value;
  let desde, hasta;
  if (tipoP === 'anual') {
    const dRaw = document.getElementById(`cfg-periodo-desde-${tipo}`).value;
    const hRaw = document.getElementById(`cfg-periodo-hasta-${tipo}`).value;
    if (!dRaw || !hRaw) { showNotif('Seleccioná ambas fechas', 'error'); return; }
    desde = dRaw.slice(5);
    hasta = hRaw.slice(5);
  } else {
    desde = document.getElementById(`cfg-periodo-desde-esp-${tipo}`).value;
    hasta = document.getElementById(`cfg-periodo-hasta-esp-${tipo}`).value;
    if (!desde || !hasta) { showNotif('Seleccioná ambas fechas', 'error'); return; }
    if (desde > hasta) { showNotif('La fecha inicio debe ser anterior al fin', 'error'); return; }
  }
  const stored = DB.get('config', {});
  if (!stored.temporadas) stored.temporadas = {};
  if (!stored.temporadas[tipo]) stored.temporadas[tipo] = { ...getConfig().temporadas[tipo] };
  if (!stored.temporadas[tipo].periodos) stored.temporadas[tipo].periodos = [];
  stored.temporadas[tipo].periodos.push({ id: 'p' + Date.now(), tipo: tipoP, nombre, desde, hasta });
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Período "${nombre}" agregado`);
}

export async function deletePeriodo(tipo, pid) {
  const stored = DB.get('config', {});
  if (stored.temporadas?.[tipo]?.periodos) {
    stored.temporadas[tipo].periodos = stored.temporadas[tipo].periodos.filter(p => p.id !== pid);
    await DB.set('config', stored);
  }
  renderConfig();
  showNotif('Período eliminado');
}

export async function saveConfigHostel() {
  const cfg = getConfig();
  const nombre = document.getElementById('cfg-nombre').value.trim() || CONFIG_DEFAULTS.hostel.nombre;
  const habitaciones = cfg.hostel.habitaciones.map((h, i) => ({
    id:     h.id,
    nombre: document.getElementById(`cfg-hab-nombre-${i}`)?.value.trim() || h.nombre,
    camas:  Number(document.getElementById(`cfg-hab-camas-${i}`)?.value) || 0,
    activa: document.getElementById(`cfg-hab-activa-${i}`)?.checked ?? h.activa,
    nota:   document.getElementById(`cfg-hab-nota-${i}`)?.value.trim() || '',
  }));
  const stored = DB.get('config', {});
  stored.hostel = { nombre, habitaciones };
  await DB.set('config', stored);
  renderConfig();
  showNotif('Estructura del hostel guardada');
}

export async function addHabitacion() {
  const stored = DB.get('config', {});
  const cfg = getConfig();
  const newId = String(Math.max(0, ...cfg.hostel.habitaciones.map(h => Number(h.id) || 0)) + 1);
  const habitaciones = [...cfg.hostel.habitaciones, { id: newId, nombre: `Habitación ${newId}`, camas: 6, activa: true, nota: '' }];
  stored.hostel = { nombre: cfg.hostel.nombre, habitaciones };
  await DB.set('config', stored);
  renderConfig();
  showNotif('Habitación agregada');
}

export async function removeHabitacion(i) {
  const stored = DB.get('config', {});
  const cfg = getConfig();
  const habitaciones = cfg.hostel.habitaciones.filter((_, idx) => idx !== i);
  stored.hostel = { nombre: cfg.hostel.nombre, habitaciones };
  await DB.set('config', stored);
  renderConfig();
  showNotif('Habitación eliminada');
}

export async function saveConfigTemporada(tipo) {
  const stored = DB.get('config', {});
  if (!stored.temporadas) stored.temporadas = {};
  const existing = stored.temporadas[tipo] || {};
  stored.temporadas[tipo] = {
    ...existing,
    nombre: document.getElementById(`cfg-t-${tipo}-nombre`).value.trim() || CONFIG_DEFAULTS.temporadas[tipo].nombre,
    precio: Number(document.getElementById(`cfg-t-${tipo}-precio`).value) || CONFIG_DEFAULTS.temporadas[tipo].precio,
    moneda: document.getElementById(`cfg-t-${tipo}-moneda`).value,
  };
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Precio de ${stored.temporadas[tipo].nombre} guardado`);
}

export async function saveConfigHorarios() {
  const stored = DB.get('config', {});
  stored.horarios = {
    checkin:      document.getElementById('cfg-checkin').value  || CONFIG_DEFAULTS.horarios.checkin,
    checkout:     document.getElementById('cfg-checkout').value || CONFIG_DEFAULTS.horarios.checkout,
    lateCheckout: document.getElementById('cfg-late').value     || CONFIG_DEFAULTS.horarios.lateCheckout,
    earlyCheckin: document.getElementById('cfg-early').value    || CONFIG_DEFAULTS.horarios.earlyCheckin,
  };
  await DB.set('config', stored);
  renderConfig();
  showNotif('Horarios guardados');
}

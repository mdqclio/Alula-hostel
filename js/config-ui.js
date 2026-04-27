// ===================== CONFIGURACIÓN =====================
import { DB } from './firebase-config.js';
import { showNotif, openModal, closeModal } from './helpers.js';
import { getConfig, CONFIG_DEFAULTS, getTotalCamas, getCategorias, getCuentas, getMetodosPago, getPlataformas, getMonedas, getChatQuickReplies } from './config.js';

const inp = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:7px 10px;width:100%;font-size:13px;';

function _periodoLabel(p) {
  const rango = p.tipo === 'anual'
    ? `Cada año: ${p.desde} al ${p.hasta}`
    : `${p.desde} al ${p.hasta}`;
  return p.nombre ? `<strong>${p.nombre}</strong> — ${rango}` : rango;
}

// ===== RENDER PRINCIPAL =====
export function renderConfig() {
  const c = document.getElementById('configContent');
  c.innerHTML = `<div style="display:grid;gap:24px;">
    ${_sectionHostel()}
    ${_sectionTemporadas()}
    ${_sectionHorarios()}
    ${_sectionCategorias()}
    ${_sectionCuentas()}
    ${_sectionMetodos()}
    ${_sectionPlataformas()}
    ${_sectionMonedas()}
    ${_sectionQuickReplies()}
  </div>`;
}

// ===== HOSTEL =====
function _sectionHostel() {
  const cfg = getConfig();
  return `
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
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">HABITACIÓN</th>
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">NOMBRE</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">CAMAS</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">ACTIVA</th>
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:500;">NOTA</th>
          <th style="padding:6px 4px;"></th>
        </tr></thead>
        <tbody>
          ${cfg.hostel.habitaciones.map((h, i) => `
          <tr style="border-bottom:1px solid var(--border);${!h.activa ? 'opacity:0.5' : ''}">
            <td style="padding:8px;color:var(--text3);font-size:12px;">Hab. ${h.id}</td>
            <td style="padding:8px;"><input type="text" value="${h.nombre}" id="cfg-hab-nombre-${i}" style="${inp}padding:5px 8px;"></td>
            <td style="padding:8px;text-align:center;"><input type="number" value="${h.camas}" id="cfg-hab-camas-${i}" min="0" max="30" style="${inp}padding:5px 8px;width:70px;text-align:center;"></td>
            <td style="padding:8px;text-align:center;"><input type="checkbox" id="cfg-hab-activa-${i}" ${h.activa ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;"></td>
            <td style="padding:8px;"><input type="text" value="${h.nota || ''}" id="cfg-hab-nota-${i}" placeholder="En obras..." style="${inp}padding:5px 8px;"></td>
            <td style="padding:8px;"><button class="btn btn-red btn-sm" style="padding:3px 8px;font-size:11px;" onclick="removeHabitacion(${i})">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 20px 20px;display:flex;gap:10px;">
      <button class="btn btn-blue btn-sm" onclick="saveConfigHostel()">Guardar estructura</button>
      <button class="btn btn-ghost btn-sm" onclick="addHabitacion()">+ Agregar habitación</button>
    </div>
  </div>`;
}

// ===== TEMPORADAS =====
function _sectionTemporadas() {
  const cfg = getConfig();
  const textColors   = { alta: '#f87171', media: '#fbbf24', baja: '#34d399' };
  const bgColors     = { alta: 'rgba(220,38,38,0.08)', media: 'rgba(217,119,6,0.08)', baja: 'rgba(5,150,105,0.08)' };
  const borderColors = { alta: 'rgba(220,38,38,0.25)', media: 'rgba(217,119,6,0.25)', baja: 'rgba(5,150,105,0.25)' };

  return ['alta', 'media', 'baja'].map(tipo => {
    const t = cfg.temporadas[tipo];
    const periodos = t.periodos || [];
    return `
    <div class="card">
      <div class="card-header" style="border-bottom-color:${borderColors[tipo]}">
        <h3 style="color:${textColors[tipo]}">💲 ${t.nombre}</h3>
        <span style="font-size:12px;color:var(--text3)">${periodos.length} período(s)</span>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${textColors[tipo]};font-weight:600;margin-bottom:14px;">Precio base</div>
          <div class="form-group" style="margin-bottom:10px;"><label style="font-size:11px;">Nombre</label>
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
            ? `<p style="font-size:12px;color:var(--text3);margin-bottom:12px;">Sin períodos definidos.</p>`
            : periodos.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:${bgColors[tipo]};border:1px solid ${borderColors[tipo]};border-radius:var(--radius);padding:8px 10px;margin-bottom:6px;font-size:12px;">
                <div>
                  <span style="font-size:10px;color:${textColors[tipo]};text-transform:uppercase;font-weight:600;">${p.tipo === 'anual' ? 'Anual' : 'Una vez'}</span><br>
                  <span style="color:var(--text)">${_periodoLabel(p)}</span>
                </div>
                <button class="btn btn-red btn-sm" style="padding:3px 8px;font-size:11px;" onclick="deletePeriodo('${tipo}','${p.id}')">✕</button>
              </div>`).join('')}
          <div id="add-periodo-form-${tipo}" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-top:8px;">
            <div style="margin-bottom:8px;"><label style="font-size:11px;color:var(--text3);">Nombre del período</label>
              <input type="text" id="cfg-periodo-nombre-${tipo}" placeholder="Ej: Carnaval" style="${inp}margin-top:4px;"></div>
            <div style="margin-bottom:8px;"><label style="font-size:11px;color:var(--text3);">Tipo</label>
              <select id="cfg-periodo-tipo-${tipo}" onchange="togglePeriodoTipo('${tipo}')" style="${inp}margin-top:4px;">
                <option value="anual">Anual (se repite)</option>
                <option value="especifico">Específico (fecha exacta)</option>
              </select></div>
            <div id="cfg-periodo-anual-${tipo}">
              <p style="font-size:11px;color:var(--text3);margin-bottom:6px;">Día y mes — el año se ignora.</p>
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
  }).join('');
}

// ===== HORARIOS =====
function _sectionHorarios() {
  const cfg = getConfig();
  return `
  <div class="card">
    <div class="card-header"><h3>🕐 Horarios Estándar</h3></div>
    <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">
      <div class="form-group"><label>Check-in</label><input type="time" id="cfg-checkin" value="${cfg.horarios.checkin}" style="${inp}"></div>
      <div class="form-group"><label>Check-out</label><input type="time" id="cfg-checkout" value="${cfg.horarios.checkout}" style="${inp}"></div>
      <div class="form-group"><label>Late check-out</label><input type="time" id="cfg-late" value="${cfg.horarios.lateCheckout}" style="${inp}"></div>
      <div class="form-group"><label>Early check-in</label><input type="time" id="cfg-early" value="${cfg.horarios.earlyCheckin}" style="${inp}"></div>
    </div>
    <div style="padding:0 20px 20px;">
      <button class="btn btn-blue btn-sm" onclick="saveConfigHorarios()">Guardar horarios</button>
    </div>
  </div>`;
}

// ===== CATEGORÍAS CONTABLES =====
function _sectionCategorias() {
  const cat = getCategorias();
  const lista = (items, tipo) => items.map((c, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${c}</span>
      <button class="btn btn-red btn-sm" style="padding:2px 7px;font-size:11px;" onclick="deleteCategoriaContable('${tipo}',${i})">✕</button>
    </div>`).join('');
  return `
  <div class="card">
    <div class="card-header"><h3>🗂️ Categorías Contables</h3></div>
    <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#34d399;font-weight:600;margin-bottom:10px;">INGRESOS</div>
        ${lista(cat.ingresos, 'ingresos')}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <input type="text" id="cfg-cat-nueva-ingresos" placeholder="Nueva categoría..." style="${inp}flex:1;padding:6px 10px;">
          <button class="btn btn-green btn-sm" onclick="addCategoriaContable('ingresos')">+</button>
        </div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#f87171;font-weight:600;margin-bottom:10px;">EGRESOS</div>
        ${lista(cat.egresos, 'egresos')}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <input type="text" id="cfg-cat-nueva-egresos" placeholder="Nueva categoría..." style="${inp}flex:1;padding:6px 10px;">
          <button class="btn btn-red btn-sm" onclick="addCategoriaContable('egresos')">+</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ===== CUENTAS / CAJAS =====
function _sectionCuentas() {
  const cuentas = getCuentas();
  const tipoIcon = { efectivo: '💵', banco: '🏦', digital: '📱', crypto: '₿' };
  return `
  <div class="card">
    <div class="card-header">
      <h3>💰 Cuentas / Cajas</h3>
      <button class="btn btn-blue btn-sm" onclick="openCuentaForm()">+ Nueva cuenta</button>
    </div>
    <table>
      <thead><tr>
        <th>Nombre</th><th>Tipo</th><th>Moneda</th><th>Responsable</th><th>Saldo inicial</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        ${cuentas.map(c => `<tr style="${!c.activa ? 'opacity:0.5' : ''}">
          <td><strong>${tipoIcon[c.tipo] || '💰'} ${c.nombre}</strong></td>
          <td style="text-transform:capitalize;font-size:12px;color:var(--text2)">${c.tipo}</td>
          <td><span class="badge ${c.moneda === 'USD' ? 'green' : 'blue'}">${c.moneda}</span></td>
          <td style="font-size:12px;color:var(--text3)">${c.responsable || '—'}</td>
          <td style="font-size:12px">${c.moneda === 'USD' ? 'USD ' : '$'}${Number(c.saldoInicial || 0).toLocaleString('es-AR')}${c.fechaSaldoInicial ? ' ('+c.fechaSaldoInicial+')' : ''}</td>
          <td><span class="badge ${c.activa ? 'green' : 'gray'}">${c.activa ? 'activa' : 'inactiva'}</span></td>
          <td style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm" onclick="openCuentaForm('${c.id}')">✏️</button>
            <button class="btn btn-red btn-sm" onclick="deleteCuentaCfg('${c.id}','${c.nombre}')">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ===== MÉTODOS DE PAGO =====
function _sectionMetodos() {
  const metodos = getMetodosPago();
  return `
  <div class="card">
    <div class="card-header"><h3>💳 Métodos de Pago</h3></div>
    <div style="padding:16px 20px;">
      ${metodos.map((m, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;">${m.nombre} <span style="font-size:11px;color:var(--text3)">(id: ${m.id})</span></span>
          <button class="btn btn-red btn-sm" style="padding:2px 7px;font-size:11px;" onclick="deleteMetodoPago(${i})">✕</button>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:12px;">
        <input type="text" id="cfg-metodo-id" placeholder="id (sin espacios)" style="${inp}flex:0.4;padding:6px 10px;">
        <input type="text" id="cfg-metodo-nombre" placeholder="Nombre visible" style="${inp}flex:1;padding:6px 10px;">
        <button class="btn btn-blue btn-sm" onclick="addMetodoPago()">+</button>
      </div>
    </div>
  </div>`;
}

// ===== PLATAFORMAS =====
function _sectionPlataformas() {
  const plats = getPlataformas();
  return `
  <div class="card">
    <div class="card-header"><h3>🌐 Plataformas de Reserva</h3></div>
    <div style="padding:16px 20px;">
      ${plats.map((p, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;">${p.nombre} <span style="font-size:11px;color:var(--text3)">(id: ${p.id})</span></span>
          <button class="btn btn-red btn-sm" style="padding:2px 7px;font-size:11px;" onclick="deletePlataforma(${i})">✕</button>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:12px;">
        <input type="text" id="cfg-plat-nombre" placeholder="Nombre (ej: Hostelworld)" style="${inp}flex:1;padding:6px 10px;">
        <button class="btn btn-blue btn-sm" onclick="addPlataforma()">+</button>
      </div>
    </div>
  </div>`;
}

// ===== MONEDAS =====
function _sectionMonedas() {
  const monedas = getMonedas();
  return `
  <div class="card">
    <div class="card-header"><h3>💱 Monedas Soportadas</h3></div>
    <div style="padding:16px 20px;">
      ${monedas.map((m, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;"><strong>${m.code}</strong> ${m.symbol} — ${m.nombre}</span>
          <button class="btn btn-red btn-sm" style="padding:2px 7px;font-size:11px;" onclick="deleteMoneda(${i})">✕</button>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input type="text" id="cfg-mon-code"   placeholder="Código (ej: EUR)" style="${inp}flex:0.3;padding:6px 10px;min-width:80px;">
        <input type="text" id="cfg-mon-symbol" placeholder="Símbolo (€)" style="${inp}flex:0.3;padding:6px 10px;min-width:60px;">
        <input type="text" id="cfg-mon-nombre" placeholder="Nombre (Euro)" style="${inp}flex:1;padding:6px 10px;min-width:120px;">
        <button class="btn btn-blue btn-sm" onclick="addMoneda()">+</button>
      </div>
    </div>
  </div>`;
}

// ===== QUICK REPLIES CHATBOT =====
function _sectionQuickReplies() {
  const qr = getChatQuickReplies();
  return `
  <div class="card">
    <div class="card-header"><h3>💬 Quick Replies del Chatbot</h3></div>
    <div style="padding:16px 20px;">
      ${qr.map((r, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;"><strong>${r.label}</strong> → ${r.msg}</span>
          <button class="btn btn-red btn-sm" style="padding:2px 7px;font-size:11px;" onclick="deleteQuickReply(${i})">✕</button>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input type="text" id="cfg-qr-label" placeholder="Etiqueta (ej: 💰 Precios)" style="${inp}flex:0.5;padding:6px 10px;min-width:140px;">
        <input type="text" id="cfg-qr-msg"   placeholder="Mensaje que se envía" style="${inp}flex:1;padding:6px 10px;min-width:180px;">
        <button class="btn btn-blue btn-sm" onclick="addQuickReply()">+</button>
      </div>
    </div>
  </div>`;
}

// ===== HELPERS CRUD TEMPORADAS (existentes sin cambios) =====
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
  if (!nombre) { showNotif('Poné un nombre al período', 'error'); return; }
  const tipoP = document.getElementById(`cfg-periodo-tipo-${tipo}`).value;
  let desde, hasta;
  if (tipoP === 'anual') {
    const dRaw = document.getElementById(`cfg-periodo-desde-${tipo}`).value;
    const hRaw = document.getElementById(`cfg-periodo-hasta-${tipo}`).value;
    if (!dRaw || !hRaw) { showNotif('Seleccioná ambas fechas', 'error'); return; }
    desde = dRaw.slice(5); hasta = hRaw.slice(5);
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

export function removeHabitacion(i) {
  const cfg = getConfig();
  const h = cfg.hostel.habitaciones[i];
  const nombre = h ? h.nombre : `Habitación #${i + 1}`;
  document.getElementById('confirmDeleteMsg').innerHTML = `¿Eliminar <strong>${nombre}</strong>? Esta acción no se puede deshacer.`;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.onclick = async () => {
    const stored = DB.get('config', {});
    const habitaciones = cfg.hostel.habitaciones.filter((_, idx) => idx !== i);
    stored.hostel = { nombre: cfg.hostel.nombre, habitaciones };
    await DB.set('config', stored);
    closeModal('modalConfirmDelete');
    renderConfig();
    showNotif('Habitación eliminada');
  };
  openModal('modalConfirmDelete');
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

// ===== CATEGORÍAS CONTABLES CRUD =====
export async function addCategoriaContable(tipo) {
  const val = document.getElementById(`cfg-cat-nueva-${tipo}`)?.value.trim();
  if (!val) { showNotif('Escribí el nombre de la categoría', 'error'); return; }
  const stored = DB.get('config', {});
  if (!stored.categorias) stored.categorias = {};
  const cat = getCategorias();
  if (!stored.categorias[tipo]) stored.categorias[tipo] = [...cat[tipo]];
  if (stored.categorias[tipo].includes(val)) { showNotif('Esa categoría ya existe', 'error'); return; }
  stored.categorias[tipo].push(val);
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Categoría "${val}" agregada`);
}

export async function deleteCategoriaContable(tipo, idx) {
  const stored = DB.get('config', {});
  if (!stored.categorias) stored.categorias = {};
  const cat = getCategorias();
  const lista = [...cat[tipo]];
  lista.splice(idx, 1);
  stored.categorias[tipo] = lista;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Categoría eliminada');
}

// ===== CUENTAS CRUD =====
export function openCuentaForm(id = null) {
  document.getElementById('cuenta-cfg-id').value = id || '';
  if (id) {
    const c = getCuentas().find(x => x.id === id);
    if (!c) return;
    document.getElementById('cuenta-cfg-nombre').value = c.nombre;
    document.getElementById('cuenta-cfg-tipo').value   = c.tipo;
    document.getElementById('cuenta-cfg-moneda').value = c.moneda;
    document.getElementById('cuenta-cfg-responsable').value = c.responsable || '';
    document.getElementById('cuenta-cfg-saldo').value  = c.saldoInicial || 0;
    document.getElementById('cuenta-cfg-fecha').value  = c.fechaSaldoInicial || '';
    document.getElementById('cuenta-cfg-activa').checked = c.activa !== false;
    document.getElementById('modalCuentaTitulo').textContent = 'Editar Cuenta';
  } else {
    ['cuenta-cfg-nombre','cuenta-cfg-responsable'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('cuenta-cfg-tipo').value   = 'efectivo';
    document.getElementById('cuenta-cfg-moneda').value = 'ARS';
    document.getElementById('cuenta-cfg-saldo').value  = 0;
    document.getElementById('cuenta-cfg-fecha').value  = '';
    document.getElementById('cuenta-cfg-activa').checked = true;
    document.getElementById('modalCuentaTitulo').textContent = 'Nueva Cuenta';
  }
  openModal('modalCuenta');
}

export async function saveCuentaCfg() {
  const nombre = document.getElementById('cuenta-cfg-nombre').value.trim();
  if (!nombre) { showNotif('El nombre es obligatorio', 'error'); return; }
  const stored = DB.get('config', {});
  const cuentas = getCuentas();
  const id = document.getElementById('cuenta-cfg-id').value;
  const data = {
    id:               id || 'c' + Date.now(),
    nombre,
    tipo:             document.getElementById('cuenta-cfg-tipo').value,
    moneda:           document.getElementById('cuenta-cfg-moneda').value,
    responsable:      document.getElementById('cuenta-cfg-responsable').value.trim(),
    saldoInicial:     Number(document.getElementById('cuenta-cfg-saldo').value) || 0,
    fechaSaldoInicial:document.getElementById('cuenta-cfg-fecha').value,
    activa:           document.getElementById('cuenta-cfg-activa').checked,
  };
  if (id) {
    const idx = cuentas.findIndex(c => c.id === id);
    if (idx >= 0) cuentas[idx] = data; else cuentas.push(data);
  } else {
    cuentas.push(data);
  }
  stored.cuentas = cuentas;
  await DB.set('config', stored);
  closeModal('modalCuenta');
  renderConfig();
  showNotif(id ? 'Cuenta actualizada' : 'Cuenta creada');
}

export function deleteCuentaCfg(id, nombre) {
  document.getElementById('confirmDeleteMsg').innerHTML = `¿Eliminar la cuenta <strong>${nombre}</strong>? Los movimientos asociados quedarán sin cuenta asignada.`;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.onclick = async () => {
    const stored = DB.get('config', {});
    stored.cuentas = getCuentas().filter(c => c.id !== id);
    await DB.set('config', stored);
    closeModal('modalConfirmDelete');
    renderConfig();
    showNotif('Cuenta eliminada');
  };
  openModal('modalConfirmDelete');
}

// ===== MÉTODOS DE PAGO CRUD =====
export async function addMetodoPago() {
  const id     = document.getElementById('cfg-metodo-id')?.value.trim().replace(/\s+/g, '_').toLowerCase();
  const nombre = document.getElementById('cfg-metodo-nombre')?.value.trim();
  if (!id || !nombre) { showNotif('Completá id y nombre', 'error'); return; }
  const stored = DB.get('config', {});
  const metodos = getMetodosPago();
  if (metodos.some(m => m.id === id)) { showNotif('Ese id ya existe', 'error'); return; }
  metodos.push({ id, nombre });
  stored.metodosPago = metodos;
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Método "${nombre}" agregado`);
}

export async function deleteMetodoPago(idx) {
  const stored = DB.get('config', {});
  const metodos = getMetodosPago();
  metodos.splice(idx, 1);
  stored.metodosPago = metodos;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Método eliminado');
}

// ===== PLATAFORMAS CRUD =====
export async function addPlataforma() {
  const nombre = document.getElementById('cfg-plat-nombre')?.value.trim();
  if (!nombre) { showNotif('Escribí el nombre', 'error'); return; }
  const id = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const stored = DB.get('config', {});
  const plats = getPlataformas();
  if (plats.some(p => p.id === id)) { showNotif('Esa plataforma ya existe', 'error'); return; }
  plats.push({ id, nombre });
  stored.plataformas = plats;
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Plataforma "${nombre}" agregada`);
}

export async function deletePlataforma(idx) {
  const stored = DB.get('config', {});
  const plats = getPlataformas();
  plats.splice(idx, 1);
  stored.plataformas = plats;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Plataforma eliminada');
}

// ===== MONEDAS CRUD =====
export async function addMoneda() {
  const code   = document.getElementById('cfg-mon-code')?.value.trim().toUpperCase();
  const symbol = document.getElementById('cfg-mon-symbol')?.value.trim();
  const nombre = document.getElementById('cfg-mon-nombre')?.value.trim();
  if (!code || !symbol || !nombre) { showNotif('Completá código, símbolo y nombre', 'error'); return; }
  const stored = DB.get('config', {});
  const monedas = getMonedas();
  if (monedas.some(m => m.code === code)) { showNotif('Esa moneda ya existe', 'error'); return; }
  monedas.push({ code, symbol, nombre });
  stored.monedas = monedas;
  await DB.set('config', stored);
  renderConfig();
  showNotif(`Moneda "${code}" agregada`);
}

export async function deleteMoneda(idx) {
  const stored = DB.get('config', {});
  const monedas = getMonedas();
  if (monedas.length <= 1) { showNotif('Debe haber al menos una moneda', 'error'); return; }
  monedas.splice(idx, 1);
  stored.monedas = monedas;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Moneda eliminada');
}

// ===== QUICK REPLIES CRUD =====
export async function addQuickReply() {
  const label = document.getElementById('cfg-qr-label')?.value.trim();
  const msg   = document.getElementById('cfg-qr-msg')?.value.trim();
  if (!label || !msg) { showNotif('Completá etiqueta y mensaje', 'error'); return; }
  const stored = DB.get('config', {});
  const qr = getChatQuickReplies();
  qr.push({ label, msg });
  stored.chatQuickReplies = qr;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Quick reply agregado');
}

export async function deleteQuickReply(idx) {
  const stored = DB.get('config', {});
  const qr = getChatQuickReplies();
  qr.splice(idx, 1);
  stored.chatQuickReplies = qr;
  await DB.set('config', stored);
  renderConfig();
  showNotif('Quick reply eliminado');
}

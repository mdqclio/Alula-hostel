// ===================== PRECIOS =====================
import { DB } from './firebase-config.js';
import { platBadge, showNotif } from './helpers.js';
import { getConfig } from './config.js';

export function renderPrecios(tab) {
  const precios = DB.get('precios', {});
  const c = document.getElementById('pricingContent');
  if (tab === 'temporada') {
    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Temporadas</h3><button class="btn btn-blue btn-sm" onclick="addTemporada()">+ Agregar</button></div>
        <table class="pricing-table">
          <thead><tr><th>Temporada</th><th>Período</th><th>Precio base</th><th>Moneda</th><th>Acción</th></tr></thead>
          <tbody>${(precios.temporadas || []).map(t => `<tr>
            <td><strong style="color:var(--text)">${t.nombre}</strong></td>
            <td>${t.meses}</td>
            <td><input type="number" value="${t.precio}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;width:120px" onchange="updateTemporada('${t.id}','precio',this.value)"></td>
            <td>
              <select style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px" onchange="updateTemporada('${t.id}','moneda',this.value)">
                <option ${t.moneda === 'ARS' ? 'selected' : ''}>ARS</option>
                <option ${t.moneda === 'USD' ? 'selected' : ''}>USD</option>
              </select>
            </td>
            <td><button class="btn btn-red btn-sm" onclick="deleteTemporada('${t.id}')">Eliminar</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } else if (tab === 'habitacion') {
    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Precios por Habitación</h3></div>
        <table class="pricing-table">
          <thead><tr><th>Habitación</th><th>Precio Base</th><th>Temporada Alta</th><th>Temporada Baja</th><th>Moneda</th></tr></thead>
          <tbody>${(precios.habitaciones || []).map(h => `<tr>
            <td><strong style="color:var(--text)">${h.nombre}</strong> <span style="font-size:11px;color:var(--text3)">(${h.hab === '1' ? '8' : '6'} camas)</span></td>
            ${['precio_base', 'precio_alta', 'precio_baja'].map(f => `<td><input type="number" value="${h[f]}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;width:110px" onchange="updateHabPrecio('${h.hab}','${f}',this.value)"></td>`).join('')}
            <td>ARS</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } else {
    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Comisiones y Descuentos por Plataforma</h3></div>
        <table class="pricing-table">
          <thead><tr><th>Plataforma</th><th>Comisión (%)</th><th>Descuento ofrecido (%)</th></tr></thead>
          <tbody>${(precios.plataformas || []).map(p => `<tr>
            <td>${platBadge(p.plat)}</td>
            <td><input type="number" value="${p.comision}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;width:80px" onchange="updatePlatPrecio('${p.plat}','comision',this.value)"></td>
            <td><input type="number" value="${p.descuento}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;width:80px" onchange="updatePlatPrecio('${p.plat}','descuento',this.value)"></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }
}

export function switchPricingTab(tab, el) {
  document.querySelectorAll('#section-precios .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderPrecios(tab);
}

export function updateTemporada(id, field, val) {
  const p = DB.get('precios', {});
  const t = p.temporadas.find(x => x.id === id);
  if (t) t[field] = val;
  DB.set('precios', p);
}

export function updateHabPrecio(hab, field, val) {
  const p = DB.get('precios', {});
  const h = p.habitaciones.find(x => x.hab === hab);
  if (h) h[field] = Number(val);
  DB.set('precios', p);
}

export function updatePlatPrecio(plat, field, val) {
  const p = DB.get('precios', {});
  const h = p.plataformas.find(x => x.plat === plat);
  if (h) h[field] = Number(val);
  DB.set('precios', p);
}

export function deleteTemporada(id) {
  const p = DB.get('precios', {});
  p.temporadas = p.temporadas.filter(x => x.id !== id);
  DB.set('precios', p);
  renderPrecios('temporada');
}

export function addTemporada() {
  const p = DB.get('precios', {});
  const _cfgT = getConfig().temporadas.media;
  p.temporadas.push({ id: 't' + Date.now(), nombre: 'Nueva', meses: '', precio: _cfgT.precio, moneda: _cfgT.moneda });
  DB.set('precios', p);
  renderPrecios('temporada');
}

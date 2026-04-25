// ===================== LISTA NEGRA =====================
import { DB, loadAllData } from './firebase-config.js';
import { showNotif } from './helpers.js';
import { getScoreBadge } from './huespedes.js';

export function renderListaNegra() {
  const huespedes = DB.get('huespedes', []);
  const lista = huespedes.filter(h => h.score && h.score <= 5).sort((a, b) => a.score - b.score);
  const tbody = document.getElementById('tablaListaNegra');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">✅ Sin huéspedes en lista negra</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(h => `<tr>
    <td><strong style="color:var(--text)">${h.nombre} ${h.apellido}</strong></td>
    <td>${getScoreBadge(h.score)}</td>
    <td style="font-size:12px;color:var(--text2)">${h.obs || '—'}</td>
    <td style="text-align:center">${h.estadias || 0}</td>
    <td style="font-size:12px;color:var(--text3)">Alula Hostel</td>
  </tr>`).join('');
}

export function copyListaNegraLink() {
  const url = window.location.href.split('?')[0] + '?listanegra=1';
  navigator.clipboard.writeText(url).then(() => {
    showNotif('🔗 Link copiado al portapapeles');
  }).catch(() => {
    prompt('Copiá este link:', url);
  });
}

export function checkListaNegraMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('listanegra') === '1') {
    showListaNegraPublica();
  }
}

export async function showListaNegraPublica() {
  await loadAllData();
  const huespedes = DB.get('huespedes', []);
  const lista = huespedes.filter(h => h.score && h.score <= 5).sort((a, b) => a.score - b.score);
  document.getElementById('loginScreen').innerHTML = `
    <div style="max-width:600px;width:95%;padding:32px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:40px;margin-bottom:8px;">🚫</div>
        <h1 style="font-size:22px;font-weight:700;color:var(--text)">Lista Negra — Alula Hostel</h1>
        <p style="color:var(--text3);font-size:13px;margin-top:4px">Huéspedes con comportamiento problemático</p>
      </div>
      ${lista.length === 0
        ? '<p style="text-align:center;color:var(--text3)">Sin registros actualmente</p>'
        : `<div style="display:flex;flex-direction:column;gap:10px;">
          ${lista.map(h => `
            <div style="background:var(--surface);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius2);padding:16px 20px;display:flex;align-items:center;gap:16px;">
              <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);font-size:15px;">${h.nombre} ${h.apellido}</div>
                <div style="font-size:12px;color:var(--text3);margin-top:4px;">${h.obs || 'Sin observaciones'}</div>
              </div>
              <div>${getScoreBadge(h.score)}</div>
            </div>`).join('')}
          </div>`}
      <div style="margin-top:28px;text-align:center;">
        <button class="btn btn-ghost btn-sm" onclick="location.reload()">← Volver</button>
      </div>
    </div>`;
}

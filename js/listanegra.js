// ===================== LISTA NEGRA (solo interna, requiere login) =====================
import { DB } from './firebase-config.js';
import { escapeHtml } from './helpers.js';
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
    <td><strong style="color:var(--text)">${escapeHtml(h.nombre)} ${escapeHtml(h.apellido)}</strong></td>
    <td>${getScoreBadge(h.score)}</td>
    <td style="font-size:12px;color:var(--text2)">${escapeHtml(h.obs || '—')}</td>
    <td style="text-align:center">${h.estadias || 0}</td>
    <td style="font-size:12px;color:var(--text3)">Alula Hostel</td>
  </tr>`).join('');
}

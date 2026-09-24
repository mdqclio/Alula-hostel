// ===================== HELPERS =====================

export function dateToLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function today() {
  return dateToLocal(new Date());
}

export function nightsBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

export function fmtMoney(m, mon = 'ARS') {
  if (mon === 'USD') return 'USD ' + Number(m).toLocaleString('es-AR');
  return '$' + Number(m).toLocaleString('es-AR');
}

export function platBadge(p) {
  const map = { directo: 'blue', booking: 'green', airbnb: 'amber', otro: 'gray' };
  return `<span class="badge ${map[p] || 'gray'}">${p}</span>`;
}

export function estadoBadge(e) {
  const map = { confirmada: 'blue', checkin: 'green', checkout: 'gray', cancelada: 'red' };
  const labels = { confirmada: 'Confirmada', checkin: 'En hostel', checkout: 'Check-out', cancelada: 'Cancelada' };
  return `<span class="badge ${map[e] || 'gray'}">${labels[e] || e}</span>`;
}

export function pagoBadge(r) {
  // Las hijas de un grupo no llevan dinero: el saldo vive en el grupo.
  if (r.esGrupal) return `<span class="badge blue">Grupal</span>`;
  const ep = r.estadoPago || 'total';
  const saldo = Number(r.saldo || 0);
  if (ep === 'pendiente') return `<span class="badge red">Sin pago</span>`;
  if (ep === 'senia' || saldo > 0) return `<span class="badge amber">Debe ${fmtMoney(saldo, r.moneda)}</span>`;
  return `<span class="badge green">Pagado</span>`;
}

// Movimientos anulados (contra-asiento): fila atenuada/tachada, badge y
// botón "Anular" solo para los que se pueden anular.
export function movRowStyle(m) {
  return m.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '';
}

export function movAnulacionTag(m) {
  if (m.anulado) return ` <span class="badge red" style="font-size:10px" title="${escapeHtml(m.motivoAnulacion || '')}">anulado</span>`;
  if (m.anulaId) return ' <span class="badge gray" style="font-size:10px">anulación</span>';
  return '';
}

export function movAnularBtn(m) {
  if (m.anulado || m.anulaId || m.esTransferencia) return '';
  return `<button class="btn btn-ghost btn-sm" onclick="openAnularMovimiento('${escapeHtml(m.id)}')" title="Anular por contra-asiento">Anular</button>`;
}

// Badge con el nombre del grupo para reservas hijas ('' si es individual).
export function grupoTag(r) {
  return r && r.esGrupal ? `<span class="badge blue">👥 ${escapeHtml(r.grupoNombre || 'Grupo')}</span>` : '';
}

export function showNotif(msg, type = 'success') {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.className = 'notif show ' + type;
  setTimeout(() => el.classList.remove('show'), 2800);
}

export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

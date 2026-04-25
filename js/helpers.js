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
  const ep = r.estadoPago || 'total';
  const saldo = Number(r.saldo || 0);
  if (ep === 'pendiente') return `<span class="badge red">Sin pago</span>`;
  if (ep === 'senia' || saldo > 0) return `<span class="badge amber">Debe ${fmtMoney(saldo, r.moneda)}</span>`;
  return `<span class="badge green">Pagado</span>`;
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

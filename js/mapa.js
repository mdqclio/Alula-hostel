// ===================== MAPA CAMAS =====================
import { DB } from './firebase-config.js';
import { today, dateToLocal, fmtMoney, openModal } from './helpers.js';
import { getConfig, getTotalCamas, habBeds, camaLabel } from './config.js';
import { nightsBetween } from './helpers.js';

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function renderMapa(fechaVer) {
  const reservas = DB.get('reservas', []);
  const bedStates = DB.get('beds', {});
  const grid = document.getElementById('roomsGrid');
  const fechaConsulta = (fechaVer || today()).substring(0, 10);
  const esModoConsulta = fechaVer && fechaVer.substring(0, 10) !== today();

  // Actualizar el selector de fecha si existe
  const fechaInput = document.getElementById('mapaFecha');
  if (fechaInput && !fechaVer) fechaInput.value = today();

  grid.innerHTML = '';

  for (const habCfg of getConfig().hostel.habitaciones) {
    if (!habCfg.activa || habCfg.camas === 0) continue;
    const hs = habCfg.id;
    const beds = habBeds(hs);

    const allBedIds = beds.map(b => b.id);
    const occupiedBeds = reservas.filter(r =>
      allBedIds.includes(r.cama) &&
      (r.estado === 'checkin' || r.estado === 'confirmada') &&
      r.entrada.substring(0, 10) <= fechaConsulta && r.salida.substring(0, 10) > fechaConsulta
    ).map(r => r.cama);

    const freeCount = beds.length - occupiedBeds.length;
    const allOcc = freeCount === 0;
    const allFree = occupiedBeds.length === 0;

    const card = document.createElement('div');
    card.className = 'room-card';
    const badgeClass = allOcc ? 'full' : allFree ? 'free' : 'partial';
    const badgeLabel = allOcc ? 'Llena' : allFree ? 'Libre' : `${freeCount} libres`;

    card.innerHTML = `
      <div class="room-header">
        <div class="room-title">${habCfg.nombre || 'Hab. ' + hs} <span style="font-size:11px;color:var(--text3)">${beds.length} camas</span></div>
        <span class="room-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="beds-grid">
        ${beds.map((b, i) => {
          const isOccupied = occupiedBeds.includes(b.id);
          let state;
          if (esModoConsulta) {
            state = isOccupied ? 'occupied' : 'free';
          } else {
            if (isOccupied) {
              const resActiva = reservas.find(r =>
                r.cama === b.id &&
                (r.estado === 'checkin' || r.estado === 'confirmada') &&
                r.entrada.substring(0, 10) <= fechaConsulta && r.salida.substring(0, 10) > fechaConsulta
              );
              state = (resActiva && resActiva.estado === 'checkin') ? 'occupied' : 'occupied-confirmed';
            } else {
              state = bedStates[b.id] || 'free';
            }
          }
          const res = reservas.find(r =>
            r.cama === b.id &&
            (r.estado === 'checkin' || r.estado === 'confirmada') &&
            r.entrada.substring(0, 10) <= fechaConsulta && r.salida.substring(0, 10) > fechaConsulta
          );
          const guestName = res ? getHuespedNombre(res.huespedId).split(' ')[0] : '';
          const bunk = i % 2 === 0 ? '⬇' : '⬆';
          const clickable = !esModoConsulta;
          const tooltipText = guestName ? `Cama ${b.label} — ${guestName}` : `Cama ${b.label}`;
          return `<div class="bed ${state} tooltip-wrap" ${clickable ? `onclick="cycleBed('${b.id}')"` : 'style="cursor:default"'}>
            <span style="font-size:8px">${bunk}</span>
            <span class="bed-num">${b.label}</span>
            ${guestName ? `<span class="bed-guest">${guestName}</span>` : ''}
            <div class="tooltip-box">${tooltipText}</div>
          </div>`;
        }).join('')}
      </div>`;
    grid.appendChild(card);
  }

  // Mostrar resumen de ocupación para la fecha consultada
  const totalOcc = reservas.filter(r =>
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada.substring(0, 10) <= fechaConsulta && r.salida.substring(0, 10) > fechaConsulta
  ).length;
  const pct = Math.round(totalOcc / getTotalCamas() * 100);
  let resumen = document.getElementById('mapaResumen');
  if (!resumen) {
    resumen = document.createElement('div');
    resumen.id = 'mapaResumen';
    resumen.style.cssText = 'margin-bottom:16px;font-size:13px;color:var(--text2);display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
    grid.parentNode.insertBefore(resumen, grid);
  }
  resumen.innerHTML = `
    <span>📊 <strong style="color:var(--text)">${totalOcc}/${getTotalCamas()}</strong> camas ocupadas</span>
    <span style="color:var(--text3)">|</span>
    <span style="color:${pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#34d399'};font-weight:600">${pct}% ocupación</span>
    ${esModoConsulta ? `<span class="badge amber">Vista: ${fechaConsulta}</span>` : ''}
  `;
}

export async function cycleBed(bedId) {
  const beds = DB.get('beds', {});
  const reservas = DB.get('reservas', []);
  const resOcupada = reservas.find(r =>
    r.cama === bedId &&
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada.substring(0, 10) <= today() && r.salida.substring(0, 10) > today()
  );
  if (resOcupada) {
    const h = DB.get('huespedes', []).find(x => x.id === resOcupada.huespedId);
    const saldo = Number(resOcupada.saldo || 0);
    const nights = nightsBetween(resOcupada.entrada, resOcupada.salida);
    document.getElementById('guestDetailContent').innerHTML = `
      <div class="guest-detail" style="margin-bottom:20px">
        <div class="guest-avatar">${h ? (h.nombre[0] + h.apellido[0]) : '?'}</div>
        <div class="guest-info">
          <h3>${getHuespedNombre(resOcupada.huespedId)}</h3>
          <div class="guest-meta">
            <span class="meta-chip">🛏 Hab.${resOcupada.hab} — Cama ${camaLabel(resOcupada.cama)}</span>
            ${resOcupada.llave ? `<span class="meta-chip">🔑 Llave: ${resOcupada.llave}</span>` : ''}
            <span class="meta-chip">🌍 ${h?.nac || '—'}</span>
            ${h?.tel ? `<span class="meta-chip"><a href="https://wa.me/${h.tel.replace(/\D/g, '')}" target="_blank" style="color:inherit;text-decoration:none;">📱 ${h.tel}</a></span>` : ''}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        <div style="background:var(--surface2);border-radius:var(--radius);padding:12px;">
          <span style="font-size:11px;color:var(--text3);display:block">Check-in</span>
          <strong>${resOcupada.entrada}${resOcupada.horaCheckin ? ' ' + resOcupada.horaCheckin + 'hs' : ''}</strong>
        </div>
        <div style="background:var(--surface2);border-radius:var(--radius);padding:12px;">
          <span style="font-size:11px;color:var(--text3);display:block">Check-out</span>
          <strong>${resOcupada.salida}</strong>
        </div>
        <div style="background:var(--surface2);border-radius:var(--radius);padding:12px;">
          <span style="font-size:11px;color:var(--text3);display:block">Noches</span>
          <strong>${nights}</strong>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--surface2);border-radius:var(--radius);padding:12px;">
          <span style="font-size:11px;color:var(--text3);display:block">Total estadía</span>
          <strong style="color:var(--accent2)">${fmtMoney(Math.round(resOcupada.precio * nights), resOcupada.moneda)}</strong>
        </div>
        <div style="background:var(--surface2);border-radius:var(--radius);padding:12px;">
          <span style="font-size:11px;color:var(--text3);display:block">Saldo pendiente</span>
          <strong style="color:${saldo > 0 ? '#fbbf24' : '#34d399'}">${saldo > 0 ? fmtMoney(saldo, resOcupada.moneda) : '✓ Al día'}</strong>
        </div>
      </div>
      ${resOcupada.notas ? `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:var(--radius);font-size:13px;color:var(--text2)">📝 ${resOcupada.notas}</div>` : ''}
    `;
    document.querySelector('#modalGuestDetail h2').textContent = '🛏 Cama ' + bedId;
    openModal('modalGuestDetail');
    return;
  }
  // Cama libre: ciclar estado
  const states = ['free', 'dirty', 'maintenance'];
  const cur = beds[bedId] || 'free';
  const next = states[(states.indexOf(cur) + 1) % states.length];
  beds[bedId] = next;
  DB.set('beds', beds);
  renderMapa(document.getElementById('mapaFecha')?.value);
}

export function mapaNavegar(dias) {
  const input = document.getElementById('mapaFecha');
  const base = input.value || today();
  let fecha;
  if (dias === 0) {
    fecha = today();
  } else {
    const d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    fecha = dateToLocal(d);
  }
  input.value = fecha;
  const parts = fecha.split('-');
  const label = document.getElementById('mapaFechaLabel');
  if (label) label.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
  renderMapa(fecha);
}

export function renderMapaFecha(val) {
  const f = val || today();
  const input = document.getElementById('mapaFecha');
  if (input) input.value = f;
  const label = document.getElementById('mapaFechaLabel');
  if (label) { const p = f.split('-'); label.textContent = `${p[2]}/${p[1]}/${p[0]}`; }
  renderMapa(f);
}

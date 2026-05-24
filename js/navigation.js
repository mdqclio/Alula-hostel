// ===================== NAVIGATION =====================
import { loadAllData } from './firebase-config.js';

export const sectionTitles = {
  dashboard: 'Dashboard',
  mapa: 'Mapa de Camas',
  reservas: 'Reservas',
  checkin: 'Check-In / Check-Out',
  huespedes: 'Huéspedes',
  precios: 'Gestión de Precios',
  grilla: 'Grilla de Reservas',
  listanegra: 'Lista Negra',
  contabilidad: 'Contabilidad',
  caja: 'Caja Diaria',
  usuarios: 'Usuarios del Sistema',
  roles: 'Roles y Permisos',
  knowledge: 'Base de Conocimiento Alu',
  config: 'Configuración del Sistema',
  saldos: 'Saldos por Cuenta',
  historial: 'Historial de Cambios'
};

const _sectionCache = {};

export async function showSection(s) {
  // Sidebar: marcar item activo y cerrar la sidebar móvil
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + s)?.classList.add('active');
  closeSidebar();
  document.getElementById('pageTitle').textContent = sectionTitles[s] || s;

  // Cargar el partial de la sección (cache en memoria; fetch solo la 1ª vez)
  const main = document.getElementById('content');
  if (!main) return;
  if (!_sectionCache[s]) {
    try {
      const res = await fetch('sections/' + s + '.html');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _sectionCache[s] = await res.text();
    } catch (e) {
      const { showNotif } = await import('./helpers.js');
      showNotif('No se pudo cargar la sección: ' + s, 'error');
      console.error('[showSection] fetch error:', e);
      return;
    }
  }
  main.innerHTML = _sectionCache[s];

  // Importaciones dinámicas para evitar ciclos
  if (s === 'dashboard') {
    const { renderDashboard } = await import('./dashboard.js');
    loadAllData().then(() => renderDashboard());
  }
  if (s === 'mapa') {
    const { renderMapa, mapaNavegar } = await import('./mapa.js');
    mapaNavegar(0);
    loadAllData().then(() => renderMapa(document.getElementById('mapaFecha').value));
  }
  if (s === 'reservas') {
    const { renderReservas } = await import('./reservas.js');
    loadAllData().then(() => renderReservas());
  }
  if (s === 'checkin') {
    const { renderCheckin } = await import('./checkin.js');
    loadAllData().then(() => renderCheckin());
  }
  if (s === 'grilla') {
    const { renderGrilla } = await import('./grilla.js');
    loadAllData().then(() => renderGrilla());
  }
  if (s === 'listanegra') {
    const { renderListaNegra } = await import('./listanegra.js');
    loadAllData().then(() => renderListaNegra());
  }
  if (s === 'huespedes') {
    const { renderHuespedes } = await import('./huespedes.js');
    loadAllData().then(() => renderHuespedes());
  }
  if (s === 'precios') {
    const { renderPrecios } = await import('./precios.js');
    renderPrecios('temporada');
  }
  if (s === 'contabilidad') {
    const { renderAcct } = await import('./contabilidad.js');
    renderAcct('ingresos');
  }
  if (s === 'caja') {
    const { renderCaja } = await import('./caja.js');
    renderCaja();
  }
  if (s === 'usuarios') {
    const { renderUsuarios } = await import('./usuarios.js');
    renderUsuarios();
  }
  if (s === 'roles') {
    const { renderRoles } = await import('./usuarios.js');
    renderRoles();
  }
  if (s === 'knowledge') {
    const { renderKnowledge } = await import('./knowledge.js');
    setTimeout(() => renderKnowledge(), 50);
  }
  if (s === 'config') {
    const { renderConfig } = await import('./config-ui.js');
    renderConfig();
  }
  if (s === 'saldos') {
    const { renderSaldos } = await import('./caja.js');
    loadAllData().then(() => renderSaldos());
  }
  if (s === 'historial') {
    const { renderHistorial } = await import('./auditoria.js');
    loadAllData().then(() => renderHistorial());
  }
}

export function updateDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('topDate').textContent = d.toLocaleDateString('es-AR', opts);
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

export function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

export function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

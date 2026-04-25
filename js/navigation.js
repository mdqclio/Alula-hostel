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
  config: 'Configuración del Sistema'
};

export async function showSection(s) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('section-' + s)?.classList.add('active');
  document.getElementById('nav-' + s)?.classList.add('active');
  document.getElementById('pageTitle').textContent = sectionTitles[s] || s;

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

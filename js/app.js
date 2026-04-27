// ===================== APP — Punto de entrada =====================
import { loadAllData } from './firebase-config.js';
import { openModal, closeModal, showNotif, today } from './helpers.js';
import { doLogin, doLogout } from './auth.js';
import { showSection, closeSidebar, openSidebar, toggleSidebar, updateDate } from './navigation.js';
import { renderDashboard, onEntradaChange } from './dashboard.js';
import { renderMapa, mapaNavegar, renderMapaFecha, cycleBed } from './mapa.js';
import { renderGrilla, grillaNavegar, grillaHoy } from './grilla.js';
import {
  renderReservas, openNuevaReserva, saveReserva, updateBedsSelect, calcTotalReserva,
  doCheckin, confirmCheckin, openPago, savePago,
  openExtender, calcExtension, saveExtension,
  doCheckout, limpiarDuplicados,
  openCambioCama, updateCambioCamaSelect, saveCambioCama,
  openHorario, toggleHorarioCobro, saveHorario,
  deleteReserva
} from './reservas.js';
import { renderCheckin } from './checkin.js';
import {
  renderHuespedes, showGuestDetail, saveHuesped, previewDoc, runOCR,
  openEditHuesped, saveEditHuesped, confirmDelete, deleteHuesped,
  renderScoreStars, setScore, getScoreBadge,
  showPublicFormLink, copyPublicLink, openPublicFormPreview,
  checkPublicMode, showPublicRegistrationForm, previewPubDoc, submitPublicRegistration
} from './huespedes.js';
import { renderPrecios, switchPricingTab, updateTemporada, updateHabPrecio, updatePlatPrecio, deleteTemporada, addTemporada } from './precios.js';
import { renderAcct, switchAcctTab, aplicarFiltroReportes, exportarReporteCSV } from './contabilidad.js';
import {
  renderCaja, saveMovimiento, cerrarCaja,
  openMovimientoModal, openTransferenciaModal, saveTransferencia, renderSaldos
} from './caja.js';
import { renderListaNegra, copyListaNegraLink, checkListaNegraMode } from './listanegra.js';
import {
  renderRoles, togglePerm, deleteRol, saveRol,
  renderUsuarios, openNuevoUsuario, editUsuario, populateRolSelect, toggleUsuarioEstado, saveUsuario
} from './usuarios.js';
import { renderKnowledge, saveKnowledgeEntry, deleteKnowledgeEntry, editKnowledgeEntry, cancelEditKnowledge, saveEditKnowledge } from './knowledge.js';
import {
  renderConfig, saveConfigHostel, addHabitacion, removeHabitacion,
  saveConfigTemporada, saveConfigHorarios,
  toggleAddPeriodo, togglePeriodoTipo, addPeriodo, deletePeriodo,
  addCategoriaContable, deleteCategoriaContable,
  openCuentaForm, saveCuentaCfg, deleteCuentaCfg,
  addMetodoPago, deleteMetodoPago,
  addPlataforma, deletePlataforma,
  addMoneda, deleteMoneda,
  addQuickReply, deleteQuickReply
} from './config-ui.js';
import {
  toggleChatFloat, initChatbot, clearChat, sendChat, sendQuickReply,
  saveApiKey, copyMsg, loadApiKeyFromFirebase,
  openChatCorrect, closeChatCorrect, saveChatCorrect
} from './chatbot.js';

// ===================== EXPONER FUNCIONES GLOBALMENTE =====================
// Necesario para onclick="..." en el HTML porque type="module" tiene scope privado

Object.assign(window, {
  // Auth
  doLogin, doLogout,

  // Navigation
  showSection, closeSidebar, openSidebar, toggleSidebar,

  // Dashboard
  renderDashboard, onEntradaChange,

  // Mapa
  renderMapa, mapaNavegar, renderMapaFecha,

  // Grilla
  renderGrilla, grillaNavegar, grillaHoy,

  // Reservas
  renderReservas, openNuevaReserva, saveReserva, updateBedsSelect, calcTotalReserva,
  doCheckin, confirmCheckin, openPago, savePago,
  openExtender, calcExtension, saveExtension,
  doCheckout, limpiarDuplicados,
  openCambioCama, updateCambioCamaSelect, saveCambioCama,
  openHorario, toggleHorarioCobro, toggleHorarioCobroToggle: toggleHorarioCobro,
  saveHorario, deleteReserva,

  // Check-in
  renderCheckin,

  // Huéspedes
  renderHuespedes, showGuestDetail, saveHuesped, previewDoc, runOCR,
  openEditHuesped, saveEditHuesped, confirmDelete, deleteHuesped,
  renderScoreStars, setScore, getScoreBadge,
  showPublicFormLink, copyPublicLink, openPublicFormPreview,
  showPublicRegistrationForm, previewPubDoc, submitPublicRegistration,

  // Precios
  renderPrecios, switchPricingTab,
  updateTemporada, updateHabPrecio, updatePlatPrecio, deleteTemporada, addTemporada,

  // Contabilidad
  renderAcct, switchAcctTab, aplicarFiltroReportes, exportarReporteCSV,

  // Caja / Saldos
  renderCaja, saveMovimiento, cerrarCaja,
  openMovimientoModal, openTransferenciaModal, saveTransferencia, renderSaldos,

  // Lista negra
  renderListaNegra, copyListaNegraLink,

  // Usuarios y Roles
  renderRoles, togglePerm, deleteRol, saveRol,
  renderUsuarios, openNuevoUsuario, editUsuario, populateRolSelect, toggleUsuarioEstado, saveUsuario,

  // Knowledge
  renderKnowledge, saveKnowledgeEntry, deleteKnowledgeEntry,
  editKnowledgeEntry, cancelEditKnowledge, saveEditKnowledge,

  // Configuración
  renderConfig, saveConfigHostel, addHabitacion, removeHabitacion,
  saveConfigTemporada, saveConfigHorarios,
  toggleAddPeriodo, togglePeriodoTipo, addPeriodo, deletePeriodo,
  addCategoriaContable, deleteCategoriaContable,
  openCuentaForm, saveCuentaCfg, deleteCuentaCfg,
  addMetodoPago, deleteMetodoPago,
  addPlataforma, deletePlataforma,
  addMoneda, deleteMoneda,
  addQuickReply, deleteQuickReply,

  // Chatbot
  toggleChatFloat, initChatbot, clearChat, sendChat, sendQuickReply,
  saveApiKey, copyMsg, loadApiKeyFromFirebase,
  openChatCorrect, closeChatCorrect, saveChatCorrect,

  // Helpers globales
  openModal, closeModal, today, cycleBed,
});

// ===================== INICIALIZACIÓN =====================
updateDate();
checkPublicMode();
checkListaNegraMode();

// Botón formulario público en login
document.getElementById('btnPublicForm')?.addEventListener('click', showPublicRegistrationForm);

// Cerrar modales al hacer click fuera
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); });
});

// Event listener para el selector de fecha del mapa
document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'mapaFecha') {
    renderMapa(e.target.value);
  }
});

// Cargar datos y mostrar dashboard
loadAllData().then(async () => {
  await loadApiKeyFromFirebase();
  showSection('dashboard');
});

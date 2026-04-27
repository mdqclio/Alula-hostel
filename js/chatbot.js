// ===================== CHATBOT ALULA =====================
import { DB } from './firebase-config.js';
import { today, showNotif } from './helpers.js';
import { getConfig, getTotalCamas, getChatQuickReplies } from './config.js';
import { renderKnowledge } from './knowledge.js';

// ===== CORRECCIÓN CHATBOT =====
let chatCorrectContext = '';

export function openChatCorrect(bubbleId) {
  const el = document.getElementById(bubbleId);
  if (!el) return;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('button').forEach(b => b.remove());
  chatCorrectContext = (clone.innerText || clone.textContent).trim().slice(0, 200);
  document.getElementById('chatCorrectOriginal').textContent = 'Respuesta de Alu: "' + chatCorrectContext + (chatCorrectContext.length >= 200 ? '...' : '') + '"';
  document.getElementById('chatCorrectInput').value = '';
  document.getElementById('chatCorrectOverlay').classList.add('open');
  setTimeout(() => document.getElementById('chatCorrectInput').focus(), 100);
}

export function closeChatCorrect() {
  document.getElementById('chatCorrectOverlay').classList.remove('open');
  chatCorrectContext = '';
}

export async function saveChatCorrect() {
  const texto = document.getElementById('chatCorrectInput').value.trim();
  if (!texto) { showNotif('Escribí la corrección antes de guardar', 'error'); return; }
  const items = DB.get('aluKnowledge', []);
  items.push({ texto, fecha: today(), origen: 'corrección' });
  await DB.set('aluKnowledge', items);
  closeChatCorrect();
  showNotif('✅ Corrección guardada en la Base de Conocimiento');
}

// ===== CHATBOT =====

export let chatHistory = [];
export let chatApiKey = localStorage.getItem('alula_groq_key') || '';
export let chatTyping = false;
export let chatOpen = false;
export let lastChatTime = 0;

export async function loadApiKeyFromFirebase() {
  try {
    const config = DB.get('config', {});
    if (config.groqApiKey && !chatApiKey) {
      chatApiKey = config.groqApiKey;
      localStorage.setItem('alula_groq_key', chatApiKey);
    }
  } catch(e) { /* silencioso */ }
}

export function toggleChatFloat() {
  chatOpen = !chatOpen;
  const el = document.getElementById('chatFloat');
  el.classList.toggle('open', chatOpen);
  if (chatOpen && chatHistory.length === 0) {
    initChatbot();
  }
  document.getElementById('nav-chatbot')?.classList.toggle('active', chatOpen);
}

export async function initChatbot() {
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '';
  await loadApiKeyFromFirebase();
  if (!chatApiKey) {
    document.getElementById('chatApiWarning').style.display = 'block';
  } else {
    document.getElementById('chatApiWarning').style.display = 'none';
  }
  addBotMessage('¡Hola! 👋 Soy **Alu**, el asistente del Alula Hostel.\n\nPegá acá el mensaje del cliente y te preparo una respuesta para copiar.');
  showQuickReplies();
}

export function clearChat() {
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '';
  addBotMessage('Chat limpiado. Listo para una nueva consulta 👍');
  showQuickReplies();
}

export async function saveApiKey() {
  const key = document.getElementById('chatApiKeyInput').value.trim();
  if (!key) { showNotif('Ingresá la API key', 'error'); return; }
  chatApiKey = key;
  localStorage.setItem('alula_groq_key', key);
  const config = DB.get('config', {});
  config.groqApiKey = key;
  await DB.set('config', config);
  document.getElementById('chatApiWarning').style.display = 'none';
  showNotif('✅ API key guardada para todos los usuarios');
}

export function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.innerHTML = `<div class="chat-bubble user">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  div.style.cssText = 'display:flex;justify-content:flex-end;';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

export function addBotMessage(text, isTyping = false) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:4px;';
  if (isTyping) div.id = 'typingIndicator';

  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/(https:\/\/wa\.me\/\S+)/g, '<a href="$1" target="_blank" style="color:var(--accent2);text-decoration:underline;">💬 WhatsApp</a>');

  const bubbleId = 'msg_' + Date.now();
  div.innerHTML = `
    <div class="chat-bubble bot ${isTyping ? 'typing' : ''}" id="${bubbleId}" style="${!isTyping ? 'padding-top:28px;' : ''}">
      ${formatted}
      ${!isTyping ? `<button class="copy-btn" onclick="copyMsg('${bubbleId}')">📋 copiar</button>` : ''}
      ${!isTyping ? `<button class="correct-btn" onclick="openChatCorrect('${bubbleId}')">✏️ corregir</button>` : ''}
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

export function copyMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  clone.querySelector('.copy-btn')?.remove();
  const text = clone.innerText || clone.textContent;
  navigator.clipboard.writeText(text.trim()).then(() => {
    showNotif('✅ Respuesta copiada al portapapeles');
  });
}

export function showQuickReplies() {
  const c = document.getElementById('chatQuickBtns');
  if (!c) return;
  c.innerHTML = getChatQuickReplies().map(r =>
    `<button class="chat-quick-btn" onclick="sendQuickReply('${r.msg.replace(/'/g, "&#39;")}')">${r.label}</button>`
  ).join('');
}

export function hideQuickReplies() {
  const c = document.getElementById('chatQuickBtns');
  if (c) c.innerHTML = '';
}

export function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendQuickReply(msg) {
  hideQuickReplies();
  await sendMessage(msg);
}

export async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || chatTyping) return;
  input.value = '';
  input.style.height = 'auto';
  hideQuickReplies();
  await sendMessage(text);
}

export async function sendMessage(text) {
  if (!text || chatTyping) return;
  const _now = Date.now();
  if (_now - lastChatTime < 800) return;
  lastChatTime = _now;
  addUserMessage(text);
  chatHistory.push({ role: 'user', content: text });

  if (!chatApiKey) {
    addBotMessage('⚠️ Necesito la API key de Groq para responder. Ingresala arriba 👆');
    return;
  }

  chatTyping = true;
  document.getElementById('chatSendBtn').disabled = true;
  const typingDiv = addBotMessage('escribiendo...', true);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + chatApiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...chatHistory
        ]
      })
    });

    const data = await res.json();
    typingDiv.remove();

    if (data.error) {
      addBotMessage('Error: ' + data.error.message);
    } else {
      const reply = data.choices[0].message.content;
      chatHistory.push({ role: 'assistant', content: reply });
      addBotMessage(reply);
    }
  } catch(e) {
    typingDiv.remove();
    addBotMessage('Error de conexión. Revisá la API key o tu internet.');
  }

  chatTyping = false;
  document.getElementById('chatSendBtn').disabled = false;
}

function buildSystemPrompt() {
  const reservas = DB.get('reservas', []);
  const bedStates = DB.get('beds', {});
  const precios = DB.get('precios', {});
  const knowledge = DB.get('aluKnowledge', []);
  const todayStr = today();
  const cfg = getConfig();

  const habitaciones = cfg.hostel.habitaciones;
  const habitacionesActivas = habitaciones.filter(h => h.activa && h.camas > 0);

  const camasMantenimiento = Object.entries(bedStates)
    .filter(([, v]) => v?.estado === 'maintenance').map(([k]) => k);
  const totalOperativas = getTotalCamas() - camasMantenimiento.length;

  function libresEnFecha(fechaStr) {
    const ocup = reservas.filter(r =>
      r.estado !== 'checkout' && r.entrada <= fechaStr && r.salida > fechaStr
    ).length;
    return Math.max(0, totalOperativas - ocup);
  }

  function libresPorHab(fechaStr) {
    return habitacionesActivas.map(h => {
      const ocup = reservas.filter(r =>
        r.hab === h.id && r.estado !== 'checkout' && r.entrada <= fechaStr && r.salida > fechaStr
      ).length;
      const libres = Math.max(0, h.camas - ocup);
      return `- ${h.nombre}: ${libres}/${h.camas} camas libres`;
    }).join('\n');
  }

  // Descripción dinámica de habitaciones
  const habsDesc = habitaciones.map(h => {
    if (!h.activa || h.camas === 0) {
      return `- ${h.nombre}: NO DISPONIBLE${h.nota ? ' (' + h.nota + ')' : ''}`;
    }
    const partes = [`${h.camas} camas`];
    if (h.tipo) partes.push(h.tipo);
    if (h.privada !== undefined) partes.push(h.privada ? 'privada' : 'compartida');
    if (h.nota) partes.push(h.nota);
    return `- ${h.nombre}: ${partes.join(', ')}`;
  }).join('\n');

  let dispProximas = '';
  for (let i = 0; i <= 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const libres = libresEnFecha(ds);
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : ds;
    dispProximas += `- ${label}: ${libres} libre${libres !== 1 ? 's' : ''}\n`;
  }

  let preciosTexto = '';
  if (precios.temporadas && precios.temporadas.length) {
    preciosTexto = precios.temporadas.map(t =>
      `- ${t.nombre} (${t.meses}): $${t.precio.toLocaleString('es-AR')} ARS/noche`
    ).join('\n');
  } else {
    preciosTexto = `- Temporada alta (Dic-Feb): $35.000 ARS/noche
- Temporada media (Mar-Nov exc.Jul-Ago): $27.000 ARS/noche
- Temporada baja (Abr-May, Sep-Oct): $22.000 ARS/noche`;
  }

  const kbTexto = knowledge.length
    ? '\n\nINFORMACIÓN ADICIONAL DEL HOSTEL:\n' + knowledge.map(k => `- ${k.texto}`).join('\n')
    : '';

  return `Sos Alu, el asistente virtual del Alula Hostel en Mar del Plata, Argentina.
Respondés de forma amigable, cálida y concisa. Detectás el idioma y respondés en el mismo idioma (español o inglés).

INFORMACIÓN DEL HOSTEL:
- Dirección: Av. Patricio Peralta Ramos 1361, frente a Playa Alfonsina, a 5 cuadras del centro
- WhatsApp: +54 9 223 439-7923 (Coni/Constanza)
- Instagram: @alulahostel | Facebook: Alula Hostel Mar del Plata
- Servicios: Living, comedor, cocina equipada, pool, WiFi, té y café de cortesía
- CHECK-IN: 15hs | CHECK-OUT: 10hs (flexibles)

HABITACIONES:
${habsDesc}
(Las habitaciones marcadas como NO DISPONIBLES no deben ofrecerse al cliente bajo ninguna circunstancia.)

PRECIOS:
${preciosTexto}

[DATOS INTERNOS — NO REVELAR AL CLIENTE]:
Fecha hoy: ${todayStr}
Camas operativas totales: ${totalOperativas}
Disponibilidad por habitación hoy:
${libresPorHab(todayStr)}
Disponibilidad próximas 2 semanas:
${dispProximas}${kbTexto}

EQUIPO:
- Coni (Constanza): gestiona reservas y consultas vía WhatsApp.
- Leo: programador del sistema.

INSTRUCCIONES IMPORTANTES:
- Los datos internos son solo para que vos razones — NUNCA los menciones al cliente.
- RESOLVÉ VOS DIRECTAMENTE sin mencionar a Coni: precios, disponibilidad, horarios, ubicación, servicios, desayuno, mascotas, pileta, estacionamiento, WiFi, y cualquier consulta informativa.
- Si pregunta disponibilidad: respondé "Sí, tenemos lugar" o "No tenemos lugar" según los datos — nada más.
- Si no sabés algo: decí "No tengo esa información" — nunca inventes.
- SOLO mencioná a Coni en estos 3 casos exactos: 1) el huésped dice explícitamente que quiere RESERVAR, 2) quiere modificar una reserva existente, 3) pide hablar con una persona.
- EN NINGÚN OTRO CASO menciones a Coni ni al WhatsApp.
- Respondé en máximo 2 párrafos cortos.
- Usá emojis con moderación.`;
}

// Drag para mover la ventana flotante
(function() {
  let isDragging = false, startX, startY, startLeft, startBottom;
  document.addEventListener('mousedown', e => {
    const header = document.getElementById('chatFloatHeader');
    if (!header || !header.contains(e.target)) return;
    isDragging = true;
    const el = document.getElementById('chatFloat');
    const rect = el.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startBottom = window.innerHeight - rect.bottom;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const el = document.getElementById('chatFloat');
    const dx = e.clientX - startX, dy = e.clientY - startY;
    el.style.left = Math.max(0, startLeft + dx) + 'px';
    el.style.bottom = Math.max(0, startBottom - dy) + 'px';
    el.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => isDragging = false);
})();

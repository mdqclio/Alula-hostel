// ===================== BASE DE CONOCIMIENTO ALU =====================
import { DB } from './firebase-config.js';
import { today, showNotif, escapeHtml } from './helpers.js';
import { logAuditoria } from './auditoria.js';

// Firebase RTDB sirve nodos con keys 0..N consecutivas como array, y con
// keys mixtas/alfanuméricas como object. mibot247 escribe entries con keys
// "kb_<timestamp>", lo que rompe la asunción "siempre array". Normalizamos
// a pares [key, item] sin perder la key real (la necesitamos para edit/delete).
function knowledgePairs(raw) {
  if (Array.isArray(raw)) {
    return raw.reduce((acc, item, i) => {
      if (item != null) acc.push([String(i), item]);
      return acc;
    }, []);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).filter(([, v]) => v != null);
  }
  return [];
}

export function renderKnowledge() {
  const raw = DB.get('aluKnowledge', []);
  const lista = document.getElementById('kb-lista');
  if (!lista) { console.warn('kb-lista no encontrado'); return; }
  const pairs = knowledgePairs(raw);
  if (!pairs.length) {
    lista.innerHTML = '<p style="color:var(--text3);font-size:13px;">No hay entradas todavía. Usá el campo de arriba para agregar info que Alu usará en sus respuestas.</p>';
    return;
  }
  lista.innerHTML = pairs.map(([key, item]) => {
    const safeKey = escapeHtml(key);
    return `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;" id="kb-item-${safeKey}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <div class="kb-text-view" id="kb-text-${safeKey}" style="font-size:14px;color:var(--text);line-height:1.5;">${escapeHtml(item.texto)}</div>
          <textarea class="kb-text-edit" id="kb-edit-${safeKey}" style="display:none;width:100%;padding:8px;background:var(--surface3);border:1px solid var(--accent);border-radius:var(--radius);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;min-height:60px;">${escapeHtml(item.texto)}</textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;">
          <div style="font-size:11px;color:var(--text3);">${item.fecha || ''} ${item.origen === 'corrección' ? '<span style="color:var(--amber);">✏️ corrección</span>' : ''}</div>
          <div style="display:flex;gap:4px;" id="kb-btns-${safeKey}">
            <button class="btn btn-ghost btn-sm" onclick="editKnowledgeEntry('${safeKey}')">✏️ editar</button>
            <button class="btn btn-red btn-sm" onclick="deleteKnowledgeEntry('${safeKey}')">✕</button>
          </div>
          <div style="display:none;gap:4px;" id="kb-edit-btns-${safeKey}">
            <button class="btn btn-ghost btn-sm" onclick="cancelEditKnowledge('${safeKey}')">Cancelar</button>
            <button class="btn btn-blue btn-sm" onclick="saveEditKnowledge('${safeKey}')">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

export function editKnowledgeEntry(key) {
  document.getElementById('kb-text-' + key).style.display = 'none';
  document.getElementById('kb-edit-' + key).style.display = 'block';
  document.getElementById('kb-btns-' + key).style.display = 'none';
  document.getElementById('kb-edit-btns-' + key).style.display = 'flex';
  document.getElementById('kb-edit-' + key).focus();
}

export function cancelEditKnowledge(key) {
  document.getElementById('kb-text-' + key).style.display = 'block';
  document.getElementById('kb-edit-' + key).style.display = 'none';
  document.getElementById('kb-btns-' + key).style.display = 'flex';
  document.getElementById('kb-edit-btns-' + key).style.display = 'none';
}

export async function saveEditKnowledge(key) {
  const nuevo = document.getElementById('kb-edit-' + key).value.trim();
  if (!nuevo) { showNotif('El texto no puede estar vacío', 'error'); return; }
  const raw = DB.get('aluKnowledge', []);
  const items = Array.isArray(raw) ? [...raw] : { ...(raw || {}) };
  const target = Array.isArray(items) ? items[Number(key)] : items[key];
  if (!target) { showNotif('Entrada no encontrada', 'error'); return; }
  const _antes = target.texto;
  target.texto = nuevo;
  target.fecha = today();
  await DB.set('aluKnowledge', items);
  await logAuditoria('editar', 'knowledge', key, 'Entrada knowledge editada', { texto: _antes }, { texto: nuevo });
  renderKnowledge();
  showNotif('✅ Entrada actualizada');
}

export async function saveKnowledgeEntry() {
  const input = document.getElementById('kb-nueva-entrada');
  const texto = input.value.trim();
  if (!texto) { showNotif('Escribí algo antes de agregar', 'error'); return; }
  const raw = DB.get('aluKnowledge', []);
  const nuevo = { texto, fecha: today() };
  let items, newKey;
  if (Array.isArray(raw)) {
    items = [...raw, nuevo];
    newKey = String(items.length - 1);
  } else {
    items = { ...(raw || {}) };
    newKey = 'kb_admin_' + Date.now();
    items[newKey] = nuevo;
  }
  await DB.set('aluKnowledge', items);
  await logAuditoria('crear', 'knowledge', newKey, `Entrada knowledge agregada: ${texto.slice(0, 60)}`, null, { texto });
  input.value = '';
  renderKnowledge();
  showNotif('✅ Entrada agregada a la base de conocimiento');
}

export async function deleteKnowledgeEntry(key) {
  const raw = DB.get('aluKnowledge', []);
  let items, eliminado;
  if (Array.isArray(raw)) {
    items = [...raw];
    eliminado = items[Number(key)]?.texto;
    items.splice(Number(key), 1);
  } else {
    items = { ...(raw || {}) };
    eliminado = items[key]?.texto;
    delete items[key];
  }
  await DB.set('aluKnowledge', items);
  await logAuditoria('eliminar', 'knowledge', key, `Entrada eliminada: ${(eliminado || '').slice(0, 60)}`, { texto: eliminado }, null);
  renderKnowledge();
  showNotif('Entrada eliminada');
}

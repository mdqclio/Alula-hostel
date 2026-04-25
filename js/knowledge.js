// ===================== BASE DE CONOCIMIENTO ALU =====================
import { DB } from './firebase-config.js';
import { today, showNotif } from './helpers.js';

export function renderKnowledge() {
  const items = DB.get('aluKnowledge', []);
  const lista = document.getElementById('kb-lista');
  if (!lista) { console.warn('kb-lista no encontrado'); return; }
  if (!Array.isArray(items) || !items.length) {
    lista.innerHTML = '<p style="color:var(--text3);font-size:13px;">No hay entradas todavía. Usá el campo de arriba para agregar info que Alu usará en sus respuestas.</p>';
    return;
  }
  lista.innerHTML = items.map((item, idx) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;" id="kb-item-${idx}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <div class="kb-text-view" id="kb-text-${idx}" style="font-size:14px;color:var(--text);line-height:1.5;">${item.texto}</div>
          <textarea class="kb-text-edit" id="kb-edit-${idx}" style="display:none;width:100%;padding:8px;background:var(--surface3);border:1px solid var(--accent);border-radius:var(--radius);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;min-height:60px;">${item.texto}</textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;">
          <div style="font-size:11px;color:var(--text3);">${item.fecha || ''} ${item.origen === 'corrección' ? '<span style="color:var(--amber);">✏️ corrección</span>' : ''}</div>
          <div style="display:flex;gap:4px;" id="kb-btns-${idx}">
            <button class="btn btn-ghost btn-sm" onclick="editKnowledgeEntry(${idx})">✏️ editar</button>
            <button class="btn btn-red btn-sm" onclick="deleteKnowledgeEntry(${idx})">✕</button>
          </div>
          <div style="display:none;gap:4px;" id="kb-edit-btns-${idx}">
            <button class="btn btn-ghost btn-sm" onclick="cancelEditKnowledge(${idx})">Cancelar</button>
            <button class="btn btn-blue btn-sm" onclick="saveEditKnowledge(${idx})">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

export function editKnowledgeEntry(idx) {
  document.getElementById('kb-text-' + idx).style.display = 'none';
  document.getElementById('kb-edit-' + idx).style.display = 'block';
  document.getElementById('kb-btns-' + idx).style.display = 'none';
  document.getElementById('kb-edit-btns-' + idx).style.display = 'flex';
  document.getElementById('kb-edit-' + idx).focus();
}

export function cancelEditKnowledge(idx) {
  document.getElementById('kb-text-' + idx).style.display = 'block';
  document.getElementById('kb-edit-' + idx).style.display = 'none';
  document.getElementById('kb-btns-' + idx).style.display = 'flex';
  document.getElementById('kb-edit-btns-' + idx).style.display = 'none';
}

export async function saveEditKnowledge(idx) {
  const nuevo = document.getElementById('kb-edit-' + idx).value.trim();
  if (!nuevo) { showNotif('El texto no puede estar vacío', 'error'); return; }
  const items = DB.get('aluKnowledge', []);
  items[idx].texto = nuevo;
  items[idx].fecha = today();
  await DB.set('aluKnowledge', items);
  renderKnowledge();
  showNotif('✅ Entrada actualizada');
}

export async function saveKnowledgeEntry() {
  const input = document.getElementById('kb-nueva-entrada');
  const texto = input.value.trim();
  if (!texto) { showNotif('Escribí algo antes de agregar', 'error'); return; }
  const items = DB.get('aluKnowledge', []);
  items.push({ texto, fecha: today() });
  await DB.set('aluKnowledge', items);
  input.value = '';
  renderKnowledge();
  showNotif('✅ Entrada agregada a la base de conocimiento');
}

export async function deleteKnowledgeEntry(idx) {
  const items = DB.get('aluKnowledge', []);
  items.splice(idx, 1);
  await DB.set('aluKnowledge', items);
  renderKnowledge();
  showNotif('Entrada eliminada');
}

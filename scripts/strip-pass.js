// scripts/strip-pass.js
// Elimina el campo `pass` (texto plano) de cada registro de un dump de
// /alula/usuarios. NO toca Firebase directamente: opera sobre archivos JSON
// volcados con el firebase CLI. Pensado para correrse A MANO (no automático).
//
// Uso:
//   firebase database:get "/alula/usuarios" > /tmp/users-backup.json
//   node scripts/strip-pass.js /tmp/users-backup.json /tmp/users-clean.json
//   # revisar /tmp/users-clean.json y SOLO entonces, manualmente:
//   firebase database:set /alula/usuarios /tmp/users-clean.json

const fs = require('fs');
const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error('Uso: node scripts/strip-pass.js <input.json> <output.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
let removed = 0;
const strip = (o) => {
  if (o && typeof o === 'object' && 'pass' in o) { delete o.pass; removed++; }
  return o;
};

let cleaned;
if (Array.isArray(raw)) {
  cleaned = raw.map(u => (u ? strip({ ...u }) : u));
} else if (raw && typeof raw === 'object') {
  cleaned = {};
  for (const [k, v] of Object.entries(raw)) cleaned[k] = v ? strip({ ...v }) : v;
} else {
  cleaned = raw;
}

fs.writeFileSync(outFile, JSON.stringify(cleaned, null, 2));
console.log(`Listo. Campos 'pass' removidos: ${removed}. Salida: ${outFile}`);

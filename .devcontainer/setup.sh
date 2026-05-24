#!/usr/bin/env bash
# Setup del Codespace para Alula Hostel.
# Se ejecuta una sola vez en postCreateCommand del devcontainer.

set -euo pipefail

echo "🏨 Setup Alula Hostel — empezando..."

# ---------- Firebase CLI ----------
# Incluye el MCP server de Firebase (`firebase-tools mcp`).
echo "📦 Instalando firebase-tools..."
npm install -g firebase-tools

# ---------- Claude Code (instalador nativo) ----------
echo "🤖 Instalando Claude Code..."
curl -fsSL https://claude.ai/install.sh | bash

# Asegurar que ~/.local/bin esté en el PATH para esta sesión y futuras
export PATH="$HOME/.local/bin:$PATH"
if ! grep -q '.local/bin' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

# ---------- Playwright (browsers + deps del sistema) ----------
echo "🎭 Instalando Chromium para Playwright..."
sudo npx --yes playwright install --with-deps chromium || \
  echo "⚠️  Playwright deps falló — instalá manualmente si lo necesitás"

cat <<'EOF'

✅ Setup completo.

Próximos pasos:
  1. Si no usaste un Codespaces secret, autenticá Firebase:
        firebase login --no-localhost
  2. Iniciá Claude Code dentro del repo:
        claude
  3. Claude te va a pedir aprobar los MCPs definidos en .mcp.json
     (playwright + firebase). Aceptá y listo.

Servir Alula localmente para probar:
  python3 -m http.server 8080
  → se abre solo en el port forward 8080.

EOF

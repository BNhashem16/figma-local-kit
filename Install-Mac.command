#!/bin/bash
# Figma Local Bridge — installer for macOS. Double-click this file (first time: right-click > Open).
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.claude/local:$PATH"
SRC="$(cd "$(dirname "$0")" && pwd)"
KIT="$HOME/FigmaLocalKit"
say_step() { printf "\n\033[1;35m==> %s\033[0m\n" "$1"; }
ok() { printf "    \033[32m✓ %s\033[0m\n" "$1"; }
warn() { printf "    \033[33m! %s\033[0m\n" "$1"; }
pause_exit() { printf "\nPress Enter to close this window."; read -r _; exit "${1:-0}"; }

clear
echo "Figma Local Bridge — Installer"
echo "This sets up Claude to work on your Figma files locally."

# 1) Copy the kit to a fixed place
say_step "1/5  Copying files to $KIT"
if [ "$SRC" != "$KIT" ]; then
  mkdir -p "$KIT"
  rsync -a --delete --exclude ".git" --exclude "logs" --exclude ".bridge-token" "$SRC/" "$KIT/"
fi
chmod +x "$KIT"/*.command 2>/dev/null
ok "Files are in $KIT"

# 2) Node.js
say_step "2/5  Checking Node.js"
node_ok() { command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; }
if ! node_ok; then
  warn "Node.js is missing. Downloading the official installer from nodejs.org…"
  PKG_NAME=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/ | grep -o 'node-v22[0-9.]*\.pkg' | head -1)
  if [ -z "$PKG_NAME" ]; then warn "Could not reach nodejs.org. Check the internet and run this installer again."; pause_exit 1; fi
  curl -fL -o "$HOME/Downloads/$PKG_NAME" "https://nodejs.org/dist/latest-v22.x/$PKG_NAME"
  open "$HOME/Downloads/$PKG_NAME"
  echo "    The Node.js installer is open. Click Continue / Install until it finishes."
  printf "    When it says 'The installation was completed', come back here and press Enter… "
  read -r _
  export PATH="/usr/local/bin:$PATH"
  node_ok || { warn "Node.js is still not found. Restart the Mac and run this installer again."; pause_exit 1; }
fi
NODE="$(command -v node)"
ok "Node.js $(node -v) at $NODE"

# 3) Claude Code (the 'claude' command)
say_step "3/5  Checking Claude Code"
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code is missing. Installing it with the official installer…"
  curl -fsSL https://claude.ai/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi
if command -v claude >/dev/null 2>&1; then ok "Claude Code is installed"; else warn "Claude Code could not be installed. You can still use the Claude desktop app."; fi

# 4) Connect the bridge to Claude
say_step "4/5  Connecting the bridge to Claude"
if command -v claude >/dev/null 2>&1; then
  claude mcp remove figma-local -s user >/dev/null 2>&1
  claude mcp add figma-local -s user -- "$NODE" "$KIT/server/figma-local-mcp.mjs" >/dev/null && ok "Added to Claude Code"
  mkdir -p "$HOME/.claude/skills/figma-local"
  cp "$KIT/skill/SKILL.md" "$HOME/.claude/skills/figma-local/SKILL.md" && ok "Added the figma-local skill"
fi
DESK="$HOME/Library/Application Support/Claude"
if [ -d "$DESK" ]; then
  "$NODE" "$KIT/installer/claude-desktop-config.js" add "$DESK/claude_desktop_config.json" "$NODE" "$KIT/server/figma-local-mcp.mjs" && ok "Added to the Claude desktop app (restart the app to see it)"
fi

# 5) Figma plugin
say_step "5/5  Figma plugin"
printf "%s" "$KIT/plugin/manifest.json" | pbcopy
ok "The plugin path is copied. You will paste it in Figma."
cat <<MSG

Now do this in the Figma desktop app (one time only):
  1. Open your design file.
  2. Menu: Plugins > Development > Import plugin from manifest…
  3. Press Cmd+Shift+G, then Cmd+V, then Enter, then click Open.

Every time you work:
  - Figma: Plugins > Development > Figma Local Bridge   (keep its small window open)
  - Open Claude and ask, for example: "Check the connection to Figma"

Done ✓
MSG
pause_exit 0

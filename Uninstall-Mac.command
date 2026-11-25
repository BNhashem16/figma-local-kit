#!/bin/bash
# Figma Local Bridge — removes the Claude connections. Your Figma files are not touched.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
command -v claude >/dev/null 2>&1 && claude mcp remove figma-local -s user >/dev/null 2>&1 && echo "Removed from Claude Code"
rm -rf "$HOME/.claude/skills/figma-local" && echo "Removed the figma-local skill"
F="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$F" ] && command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"),f=process.argv[1];const c=JSON.parse(fs.readFileSync(f,"utf8"));if(c.mcpServers){delete c.mcpServers["figma-local"];}fs.writeFileSync(f,JSON.stringify(c,null,2));' "$F" && echo "Removed from the Claude desktop app"
fi
echo
echo "To remove the plugin from Figma: Plugins > Development > Manage plugins in development > Figma Local Bridge > Remove."
echo "You can delete the folder $HOME/FigmaLocalKit."
printf "\nPress Enter to close."; read -r _

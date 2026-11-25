// Adds or removes the figma-local server in a Claude desktop config file.
// node claude-desktop-config.js add <config.json> <node path> <server path>
// node claude-desktop-config.js remove <config.json>
const fs = require("fs");
const [action, file, nodePath, serverPath] = process.argv.slice(2);
let config = {};
try { config = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
if (action === "add") {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".before-figma-local");
  config.mcpServers = config.mcpServers || {};
  config.mcpServers["figma-local"] = { command: nodePath, args: [serverPath] };
} else if (config.mcpServers) {
  delete config.mcpServers["figma-local"];
}
fs.writeFileSync(file, JSON.stringify(config, null, 2));

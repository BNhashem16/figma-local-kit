// Smoke test: starts the MCP server like Claude does and calls read-only tools.
// Usage: node test/smoke.mjs   (Figma desktop open + "Figma Local Bridge" plugin running)
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const server = spawn(process.execPath, [fileURLToPath(new URL("../server/figma-local-mcp.mjs", import.meta.url))], { stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let next = 1;
createInterface({ input: server.stdout }).on("line", (l) => { const m = JSON.parse(l); pending.get(m.id)?.(m); pending.delete(m.id); });
const rpc = (method, params) => new Promise((res) => { const id = next++; pending.set(id, res); server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const tool = async (name, args = {}) => (await rpc("tools/call", { name, arguments: args })).result;
const show = (label, r) => console.log(label.padEnd(18), r.isError ? "ERROR " + r.content[0].text : r.content.map((c) => c.type === "image" ? `[image ${c.data.length} b64 chars]` : c.text.slice(0, 160).replace(/\s+/g, " ")).join(" "));

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
console.log("server", init.result.serverInfo.name, init.result.serverInfo.version);
console.log("tools ", (await rpc("tools/list", {})).result.tools.length);
for (let i = 0; i < 20; i++) { const s = await tool("figma_status"); if (!s.isError) break; await new Promise((r) => setTimeout(r, 1500)); }
show("figma_status", await tool("figma_status"));
const info = await tool("figma_file_info");
show("figma_file_info", info);
server.kill();

#!/usr/bin/env node
// Figma Local Bridge — MCP server for Claude (stdio) + local bridge for the Figma plugin (http://localhost:3846).
// Everything stays on this computer. No third-party packages.
import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const PORT = 3846;
const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGS = join(KIT, "logs");
const TOKEN_FILE = join(KIT, ".bridge-token");
mkdirSync(LOGS, { recursive: true });
const log = (file, entry) => appendFileSync(join(LOGS, file), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
const err = (...a) => process.stderr.write(a.join(" ") + "\n");

// ---------------------------------------------------------------- bridge (primary or forwarder)
const queue = [];
const waiters = new Map();
let pluginPoll = null;
let lastPluginSeen = 0;
let mode = "starting"; // "primary" | "forward"
let token = null;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const send = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let data = "";
  req.on("data", (c) => { data += c; if (data.length > 40_000_000) reject(new Error("body too large")); });
  req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
});
function deliver() { if (pluginPoll && queue.length) { const r = pluginPoll; pluginPoll = null; send(r, 200, queue.shift()); } }

function enqueue(op, args) {
  return new Promise((resolve) => {
    const cmd = { id: randomUUID(), op, args };
    const timer = setTimeout(() => { waiters.delete(cmd.id); resolve({ ok: false, error: "Figma did not answer in time. Check that the plugin window is open, then check the file before retrying." }); }, 180000);
    waiters.set(cmd.id, { resolve, timer });
    queue.push(cmd);
    deliver();
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return send(res, 204);
  if (url.pathname.startsWith("/plugin/")) {
    // The Figma plugin window has origin "null". Real websites have a real origin and are refused.
    if (origin && origin !== "null") return send(res, 403, { error: "forbidden origin" });
    if (url.pathname === "/plugin/next" && req.method === "GET") {
      lastPluginSeen = Date.now();
      if (pluginPoll) send(pluginPoll, 204);
      pluginPoll = res;
      const t = setTimeout(() => { if (pluginPoll === res) { pluginPoll = null; send(res, 204); } }, 20000);
      res.on("close", () => { clearTimeout(t); if (pluginPoll === res) pluginPoll = null; });
      return deliver();
    }
    if (url.pathname === "/plugin/result" && req.method === "POST") {
      lastPluginSeen = Date.now();
      const body = await readBody(req);
      const w = waiters.get(body.id);
      if (w) { clearTimeout(w.timer); waiters.delete(body.id); w.resolve(body); }
      return send(res, 200, { received: true });
    }
  }
  // Other Claude windows forward their commands here.
  if (origin || req.headers["x-bridge-token"] !== token) return send(res, 401, { error: "unauthorized" });
  if (url.pathname === "/status") return send(res, 200, { pluginConnected: Date.now() - lastPluginSeen < 30000 });
  if (url.pathname === "/command" && req.method === "POST") {
    const { op, args } = await readBody(req);
    if (Date.now() - lastPluginSeen > 30000) return send(res, 200, { ok: false, error: PLUGIN_MISSING });
    return send(res, 200, await enqueue(op, args));
  }
  send(res, 404, { error: "not found" });
}

function listen(host) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((q, r) => handle(q, r).catch((e) => send(r, 500, { error: String(e.message || e) })));
    srv.once("error", reject);
    srv.listen(PORT, host, () => resolve(srv));
  });
}

async function startBridge() {
  try {
    token = randomBytes(24).toString("hex");
    await listen("127.0.0.1");
    try { await listen("::1"); } catch { /* IPv6 not available — fine */ }
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    mode = "primary";
  } catch (e) {
    if (e.code !== "EADDRINUSE") throw e;
    mode = "forward";
    token = existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : null;
  }
  err(`figma-local: bridge mode = ${mode}`);
}

const PLUGIN_MISSING = "The Figma plugin is not connected. In Figma desktop: open your design file, then Plugins > Development > Figma Local Bridge, and keep its small window open.";

async function figmaCall(op, args = {}) {
  if (mode === "forward") {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/command`, { method: "POST", headers: { "Content-Type": "application/json", "x-bridge-token": token || "" }, body: JSON.stringify({ op, args }) });
      if (r.status === 401) { await startBridge(); return figmaCall(op, args); }
      return await r.json();
    } catch {
      await startBridge();   // the other Claude window closed — take over
      if (mode === "primary") return { ok: false, error: PLUGIN_MISSING };
      return { ok: false, error: "Could not reach the bridge. Close other Claude windows and try again." };
    }
  }
  if (Date.now() - lastPluginSeen > 30000) return { ok: false, error: PLUGIN_MISSING };
  log("ops.jsonl", { kind: "command", op, args: op === "screenshot" ? args : args });
  const result = await enqueue(op, args);
  log("ops.jsonl", { kind: "result", op, ok: result.ok, error: result.error });
  return result;
}

// ---------------------------------------------------------------- undo log
function recordUndo(op, results) {
  const batch = randomUUID();
  const inv = [];
  for (const r of results.filter((x) => x.status === "ok")) {
    if (op === "rename") inv.push({ op: "rename", args: { id: r.id, from: r.after, to: r.before } });
    if (op === "setVisibility") inv.push({ op: "setVisibility", args: { id: r.id, from: r.after, to: r.before } });
    if (op === "move") inv.push({ op: "move", args: { id: r.id, fromParentId: r.after.parentId, toParentId: r.before.parentId, x: r.before.x, y: r.before.y } });
  }
  if (inv.length) log("undo.jsonl", { batch, op, count: inv.length, inverse: inv });
  return inv.length ? batch : null;
}

function readUndo() {
  const f = join(LOGS, "undo.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

async function undoLast() {
  const entries = readUndo();
  const done = new Set(entries.filter((e) => e.undoneBatch).map((e) => e.undoneBatch));
  const last = [...entries].reverse().find((e) => e.batch && !done.has(e.batch));
  if (!last) return { ok: true, result: "Nothing to undo." };
  const byOp = {};
  for (const i of last.inverse) (byOp[i.op] = byOp[i.op] || []).push(i.args);
  const out = {};
  for (const [op, ops] of Object.entries(byOp)) {
    const r = await figmaCall(op, { ops });
    if (!r.ok) return r;
    out[op] = summarize(r.result);
    if (op === "move") await figmaCall("setPosition", { ops: ops.map((o) => ({ id: o.id, x: o.x, y: o.y })) });
  }
  log("undo.jsonl", { undoneBatch: last.batch });
  return { ok: true, result: { undid: last.op, count: last.count, details: out } };
}

const summarize = (results) => ({
  counts: results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {}),
  problems: results.filter((r) => r.status === "failed"),
});

// ---------------------------------------------------------------- MCP tools
const ids = { type: "array", items: { type: "string" }, description: "Figma node IDs like \"12:345\"" };
const pageId = { type: "string", description: "Page ID. Leave empty for the page that is open now." };
const TOOLS = [
  { name: "figma_status", description: "Check that the Figma plugin is connected. Call this first.", inputSchema: { type: "object", properties: {} } },
  { name: "figma_file_info", description: "File name, pages, the open page and the current selection.", inputSchema: { type: "object", properties: {} } },
  { name: "figma_find", description: "Find layers on a page by part of their name and/or type (FRAME, SECTION, TEXT, INSTANCE, COMPONENT, CONNECTOR …).", inputSchema: { type: "object", properties: { pageId, nameContains: { type: "string" }, types: { type: "array", items: { type: "string" } }, limit: { type: "number" } } } },
  { name: "figma_get_nodes", description: "Name, type, parent, page, position and size for node IDs.", inputSchema: { type: "object", properties: { ids }, required: ["ids"] } },
  { name: "figma_list_children", description: "Direct children of a page, section or frame.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "figma_get_texts", description: "Visible text inside screens (to understand what a screen is).", inputSchema: { type: "object", properties: { ids, max: { type: "number" } }, required: ["ids"] } },
  { name: "figma_screenshot", description: "PNG picture of one node. scale 0.5 is enough to read a mobile screen.", inputSchema: { type: "object", properties: { id: { type: "string" }, scale: { type: "number" } }, required: ["id"] } },
  { name: "figma_page_report", description: "Read-only health report of a page: duplicate screen names, default names (Frame 12, iPhone 13 - 4), version suffixes (- 02, v2, final), sections, prototype links.", inputSchema: { type: "object", properties: { pageId } } },
  { name: "figma_rename", description: "Rename layers. Each op needs the current name in 'from' (safety check). Max 60 per call. Logged for undo.", inputSchema: { type: "object", properties: { ops: { type: "array", items: { type: "object", properties: { id: { type: "string" }, from: { type: "string" }, to: { type: "string" } }, required: ["id", "from", "to"] } } }, required: ["ops"] } },
  { name: "figma_move", description: "Move layers into another section/frame on the same page (node IDs and prototype links are kept). Max 60 per call. Logged for undo.", inputSchema: { type: "object", properties: { ops: { type: "array", items: { type: "object", properties: { id: { type: "string" }, fromParentId: { type: "string" }, toParentId: { type: "string" } }, required: ["id", "fromParentId", "toParentId"] } } }, required: ["ops"] } },
  { name: "figma_set_visibility", description: "Show or hide layers. Each op needs the current state in 'from'. Max 60 per call. Logged for undo.", inputSchema: { type: "object", properties: { ops: { type: "array", items: { type: "object", properties: { id: { type: "string" }, from: { type: "boolean" }, to: { type: "boolean" } }, required: ["id", "from", "to"] } } }, required: ["ops"] } },
  { name: "figma_create_section", description: "Create an empty section on a page (skipped if one with that name exists).", inputSchema: { type: "object", properties: { pageId, name: { type: "string" }, x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, required: ["name"] } },
  { name: "figma_undo_last_change", description: "Undo the most recent rename / move / show-hide batch made through this bridge. Call again to go further back.", inputSchema: { type: "object", properties: {} } },
];

const OP = { figma_file_info: "fileInfo", figma_find: "find", figma_get_nodes: "getNodes", figma_list_children: "listChildren", figma_get_texts: "getTexts", figma_page_report: "pageReport", figma_create_section: "createSection" };
const WRITE = { figma_rename: "rename", figma_move: "move", figma_set_visibility: "setVisibility" };

const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 1) }] });
const fail = (m) => ({ content: [{ type: "text", text: m }], isError: true });

async function callTool(name, args = {}) {
  if (name === "figma_status") {
    if (mode === "forward") { const r = await figmaCall("fileInfo"); return r.ok ? text({ connected: true, file: r.result.fileName }) : fail(r.error); }
    const connected = Date.now() - lastPluginSeen < 30000;
    if (!connected) return fail(PLUGIN_MISSING);
    const r = await figmaCall("fileInfo");
    return r.ok ? text({ connected: true, file: r.result.fileName, page: r.result.currentPage.name }) : fail(r.error);
  }
  if (name === "figma_undo_last_change") { const r = await undoLast(); return r.ok ? text(r.result) : fail(r.error); }
  if (name === "figma_screenshot") {
    const r = await figmaCall("screenshot", args);
    if (!r.ok) return fail(r.error);
    return { content: [{ type: "text", text: `${r.result.name} (${r.result.id})` }, { type: "image", data: r.result.base64, mimeType: "image/png" }] };
  }
  if (WRITE[name]) {
    const op = WRITE[name];
    const r = await figmaCall(op, args);
    if (!r.ok) return fail(r.error);
    const batch = recordUndo(op, r.result);
    return text({ ...summarize(r.result), undoBatch: batch, note: batch ? "Undo with figma_undo_last_change." : "Nothing changed." });
  }
  if (OP[name]) { const r = await figmaCall(OP[name], args); return r.ok ? text(r.result) : fail(r.error); }
  return fail("Unknown tool: " + name);
}

// ---------------------------------------------------------------- MCP stdio loop
const out = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
async function onMessage(m) {
  if (m.method === "initialize") {
    return out({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "figma-local", version: "1.0.0" },
      instructions: "Local Figma bridge. Use only these figma_* tools for Figma work; never a remote Figma server. Never delete anything. Show the plan and get approval before any rename, move or show/hide batch." } });
  }
  if (m.method === "ping") return out({ jsonrpc: "2.0", id: m.id, result: {} });
  if (m.method === "tools/list") return out({ jsonrpc: "2.0", id: m.id, result: { tools: TOOLS } });
  if (m.method === "tools/call") {
    try { return out({ jsonrpc: "2.0", id: m.id, result: await callTool(m.params.name, m.params.arguments || {}) }); }
    catch (e) { return out({ jsonrpc: "2.0", id: m.id, result: fail(String(e.message || e)) }); }
  }
  if (m.id !== undefined && m.method) return out({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } });
}

await startBridge();
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let m; try { m = JSON.parse(line); } catch { return; }
  onMessage(m).catch((e) => err("figma-local error:", e.message));
}).on("close", () => process.exit(0));

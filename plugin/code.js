// Figma Local Bridge — safe operations only.
// Never deletes, never detaches instances, never swaps components, never edits fills/text/layout.
figma.showUI(__html__, { width: 300, height: 110 });

const MAX_OPS = 60;
const MOVE_TARGET_TYPES = ["PAGE", "SECTION", "FRAME"];
const DEFAULT_NAME = /^(Frame|Group|Rectangle|Ellipse|Vector|Section|Component|Instance|iPhone[^/]*|Android[^/]*|Desktop[^/]*)\s*\d*$/i;

function pageOf(n) { let p = n; while (p && p.type !== "PAGE") p = p.parent; return p; }
function insideInstance(n) { let p = n.parent; while (p) { if (p.type === "INSTANCE") return true; p = p.parent; } return false; }
function capOps(ops) {
  if (!Array.isArray(ops) || ops.length === 0) throw new Error("ops must be a non-empty array");
  if (ops.length > MAX_OPS) throw new Error("batch too large: " + ops.length + " > " + MAX_OPS + ". Split it into smaller batches.");
}
function brief(n) {
  const page = pageOf(n);
  return { id: n.id, name: n.name, type: n.type, visible: n.visible,
    parentId: n.parent ? n.parent.id : null, parentName: n.parent ? n.parent.name : null,
    pageId: page ? page.id : null, pageName: page ? page.name : null,
    x: "x" in n ? Math.round(n.x) : null, y: "y" in n ? Math.round(n.y) : null,
    width: "width" in n ? Math.round(n.width) : null, height: "height" in n ? Math.round(n.height) : null };
}
async function pageById(pageId) {
  const page = pageId ? await figma.getNodeByIdAsync(pageId) : figma.currentPage;
  if (!page || page.type !== "PAGE") throw new Error("page not found: " + pageId);
  await page.loadAsync();
  return page;
}
// Screens = frames whose parent is the page or a section.
function screensOf(page) {
  return page.findAllWithCriteria({ types: ["FRAME", "COMPONENT", "INSTANCE"] })
    .filter((f) => f.parent && (f.parent.type === "PAGE" || f.parent.type === "SECTION"));
}

const handlers = {
  async fileInfo() {
    return { fileName: figma.root.name, currentPage: { id: figma.currentPage.id, name: figma.currentPage.name },
      pages: figma.root.children.map((p) => ({ id: p.id, name: p.name })),
      selection: figma.currentPage.selection.map(brief) };
  },

  async find({ pageId, nameContains, types, limit = 200 }) {
    const page = await pageById(pageId);
    const q = (nameContains || "").toLowerCase();
    const crit = types && types.length ? { types } : {};
    const all = page.findAllWithCriteria(crit).filter((n) => !q || n.name.toLowerCase().includes(q));
    return { total: all.length, nodes: all.slice(0, limit).map(brief) };
  },

  async getNodes({ ids }) {
    const out = [];
    for (const id of ids) { const n = await figma.getNodeByIdAsync(id); out.push(n ? brief(n) : { id, missing: true }); }
    return out;
  },

  async listChildren({ id }) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) throw new Error("node not found: " + id);
    if (n.type === "PAGE") await n.loadAsync();
    if (!("children" in n)) throw new Error("node has no children: " + id);
    return n.children.map(brief);
  },

  async getTexts({ ids, max = 60 }) {
    const out = [];
    for (const id of ids) {
      const n = await figma.getNodeByIdAsync(id);
      if (!n || !("findAllWithCriteria" in n)) { out.push({ id, missing: true }); continue; }
      const texts = n.findAllWithCriteria({ types: ["TEXT"] }).filter((t) => t.visible)
        .map((t) => t.characters.trim().replace(/\s+/g, " ").slice(0, 80)).filter((t) => t.length > 1);
      out.push({ id, name: n.name, texts: [...new Set(texts)].slice(0, max) });
    }
    return out;
  },

  async screenshot({ id, scale = 1 }) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n || !("exportAsync" in n)) throw new Error("node cannot be exported: " + id);
    const s = Math.min(Math.max(Number(scale) || 1, 0.1), 2);
    const bytes = await n.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: s } });
    return { id, name: n.name, base64: figma.base64Encode(bytes) };
  },

  // Read-only hygiene report: duplicate screen names, default names, version suffixes, empty sections.
  async pageReport({ pageId }) {
    const page = await pageById(pageId);
    const screens = screensOf(page);
    const byName = {};
    for (const f of screens) (byName[f.name] = byName[f.name] || []).push(f.id);
    const duplicateNames = Object.entries(byName).filter(([, ids]) => ids.length > 1).map(([name, ids]) => ({ name, ids }));
    const defaultNames = screens.filter((f) => DEFAULT_NAME.test(f.name.trim())).map(brief);
    const versionSuffix = screens.filter((f) => /(\s-\s\d+|\bv\d+|\b(new|final|copy|old)\b)\s*$/i.test(f.name)).map(brief);
    const sections = page.children.filter((c) => c.type === "SECTION").map((s) => ({ id: s.id, name: s.name, screens: s.children.filter((c) => c.type === "FRAME").length }));
    let reactions = 0, broken = 0;
    for (const n of page.findAll((x) => "reactions" in x && x.reactions.length > 0)) {
      for (const r of n.reactions) for (const a of (r.actions || [])) {
        reactions++;
        if (a && a.destinationId && !(await figma.getNodeByIdAsync(a.destinationId))) broken++;
      }
    }
    return { page: page.name, totalLayers: page.findAll(() => true).length, screens: screens.length, sections,
      duplicateNames, defaultNames, versionSuffix, prototype: { links: reactions, brokenLinks: broken, flows: page.flowStartingPoints.length } };
  },

  // ops: [{ id, from, to }] — refuses when the current name is not 'from'.
  async rename({ ops }) {
    capOps(ops);
    const results = [];
    for (const op of ops) {
      const n = await figma.getNodeByIdAsync(op.id);
      let r;
      if (!n) r = { id: op.id, status: "failed", error: "node not found" };
      else if (n.type === "DOCUMENT") r = { id: op.id, status: "failed", error: "cannot rename document" };
      else if (insideInstance(n)) r = { id: op.id, status: "failed", error: "node is inside a component instance" };
      else if (n.name === op.to) r = { id: op.id, status: "skipped", reason: "already has target name" };
      else if (n.name !== op.from) r = { id: op.id, status: "failed", error: "current name does not match 'from'", current: n.name };
      else { n.name = op.to; r = { id: op.id, status: "ok", before: op.from, after: op.to }; }
      results.push(r);
      if (r.status === "failed") break;
    }
    return results;
  },

  // ops: [{ id, fromParentId, toParentId }] — same page only; node id is kept.
  async move({ ops }) {
    capOps(ops);
    const results = [];
    for (const op of ops) {
      const n = await figma.getNodeByIdAsync(op.id);
      const target = await figma.getNodeByIdAsync(op.toParentId);
      let r;
      if (!n) r = { id: op.id, status: "failed", error: "node not found" };
      else if (!target) r = { id: op.id, status: "failed", error: "target not found" };
      else if (!MOVE_TARGET_TYPES.includes(target.type)) r = { id: op.id, status: "failed", error: "target type not allowed: " + target.type };
      else if (insideInstance(n) || n.type === "PAGE" || n.type === "DOCUMENT") r = { id: op.id, status: "failed", error: "node cannot be moved" };
      else if (n.parent && n.parent.id === op.toParentId) r = { id: op.id, status: "skipped", reason: "already in target" };
      else if (!n.parent || n.parent.id !== op.fromParentId) r = { id: op.id, status: "failed", error: "current parent does not match 'fromParentId'", currentParentId: n.parent ? n.parent.id : null };
      else if (pageOf(n) !== pageOf(target)) r = { id: op.id, status: "failed", error: "moving between pages is not supported" };
      else {
        const before = { parentId: n.parent.id, x: n.x, y: n.y };
        const right = target.children.reduce((m, c) => Math.max(m, c.x + c.width), 0);
        target.appendChild(n);
        n.x = right + 200; n.y = 200;
        if (target.type === "SECTION" && target.width < n.x + n.width + 200) {
          target.resizeWithoutConstraints(n.x + n.width + 200, Math.max(target.height, n.y + n.height + 200));
        }
        r = { id: op.id, status: "ok", before, after: { parentId: target.id, x: n.x, y: n.y } };
      }
      results.push(r);
      if (r.status === "failed") break;
    }
    return results;
  },

  // Restores position after an undo of move.
  async setPosition({ ops }) {
    capOps(ops);
    const results = [];
    for (const op of ops) {
      const n = await figma.getNodeByIdAsync(op.id);
      if (!n || !("x" in n)) { results.push({ id: op.id, status: "failed", error: "node not found" }); break; }
      n.x = op.x; n.y = op.y; results.push({ id: op.id, status: "ok" });
    }
    return results;
  },

  // ops: [{ id, from, to }] — show/hide; refuses when the current state is not 'from'.
  async setVisibility({ ops }) {
    capOps(ops);
    const results = [];
    for (const op of ops) {
      const n = await figma.getNodeByIdAsync(op.id);
      let r;
      if (!n || !("visible" in n)) r = { id: op.id, status: "failed", error: "node not found" };
      else if (insideInstance(n)) r = { id: op.id, status: "failed", error: "node is inside a component instance" };
      else if (n.visible === op.to) r = { id: op.id, status: "skipped", reason: "already in target state" };
      else if (n.visible !== op.from) r = { id: op.id, status: "failed", error: "visibility does not match 'from'" };
      else { n.visible = op.to; r = { id: op.id, status: "ok", before: op.from, after: op.to }; }
      results.push(r);
      if (r.status === "failed") break;
    }
    return results;
  },

  // Idempotent by name on the page.
  async createSection({ pageId, name, x, y, width = 2000, height = 1000 }) {
    const page = await pageById(pageId);
    const existing = page.children.find((c) => c.type === "SECTION" && c.name === name);
    if (existing) return { status: "skipped", id: existing.id, reason: "section already exists" };
    const right = page.children.reduce((m, c) => Math.max(m, c.x + c.width), 0);
    const s = figma.createSection();
    s.name = name;
    page.appendChild(s);
    s.x = x !== undefined ? x : right + 500;
    s.y = y !== undefined ? y : 0;
    s.resizeWithoutConstraints(width, height);
    return { status: "ok", id: s.id, pageId: page.id };
  },
};

figma.ui.onmessage = async (msg) => {
  const h = handlers[msg.op];
  try {
    if (!h) throw new Error("unknown op: " + msg.op);
    const result = await h(msg.args || {});
    figma.ui.postMessage({ cmdId: msg.cmdId, ok: true, result });
  } catch (e) {
    figma.ui.postMessage({ cmdId: msg.cmdId, ok: false, error: String(e && e.message ? e.message : e) });
  }
};

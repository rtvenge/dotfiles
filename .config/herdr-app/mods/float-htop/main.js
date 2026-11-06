// float: one terminal tool in a floating dialog over Herdr. The key shows it; the same key
// hides it. The tool keeps running hidden, so the next press shows it as it was, until it has
// been hidden 30 minutes. Modeled on the lazygit mod (github.com/Nico-Mayer/lazygit-herdr, MIT).
//
// Every mods/float-* folder has this same main.js; its ./tool.js says which tool. Change this
// file in one folder, copy it to the others.
import { View, div } from "gpui-kit";
import { hc, exec, focused, machines, spaces, openOverlay, closeOverlay, notify, props, shared, setShared, run } from "herdr";
import TOOL from "./tool.js";

const NAME = TOOL.mod; // this folder's name: overlays and labels use it
const IDLE_MS = 30 * 60 * 1000;
const LEASE_MS = 15000;
const STATE = `${NAME}.v1`; // shared: { hiddenAt: { address: ms } }
const MEMORY = `__${NAME.replace(/-/g, "_")}_v1`;

// Runner copies close after one toggle, so what must outlive them lives here.
const memory = () => (globalThis[MEMORY] ??= { dialog: null, lease: null });

class Problem extends Error {
  constructor(level, title, body) { super(body); this.level = level; this.title = title; }
}

// Presses run one at a time, in order.
async function claim(cx, owner) {
  const m = memory();
  while (m.lease && m.lease.owner !== owner && Date.now() - m.lease.at < LEASE_MS) await cx.sleep(15);
  m.lease = { owner, at: Date.now() };
}
function release(owner) {
  const m = memory();
  if (m.lease?.owner === owner) m.lease = null;
}

function coreError(r) {
  try { return JSON.parse(r.stderr).error.message; } catch { return (r.stderr || "").trim() || `exit ${r.code}`; }
}
async function hcJSON(args) {
  const [command, ...rest] = args;
  const r = await hc([command, "--json", ...rest]);
  if (r.code !== 0) throw new Error(`${TOOL.title}: ${coreError(r)}`);
  return JSON.parse(r.stdout);
}

// This mod's terminals, with their labels.
async function instances() {
  const data = await hcJSON(["ls", "--label", `herdr.mod=${NAME}`]);
  const all = await Promise.all((data.terminals ?? []).map(async (t) => {
    try {
      const info = await hcJSON(["get", t.address]);
      return { address: t.address, state: info.state ?? t.state, labels: info.labels ?? {} };
    } catch { return null; }
  }));
  return all.filter((t) => t && t.state === "live" && t.labels["herdr.mod"] === NAME && !t.labels["herdr.space"]);
}

const hidden = () => shared(STATE)?.hiddenAt ?? {};
function saveHidden(next) {
  if (JSON.stringify(next) !== JSON.stringify(hidden())) setShared(STATE, { hiddenAt: next });
}

// Ends this mod's terminals whose space is gone, or that were hidden 30 minutes.
async function cleanup(terminals, keep) {
  const ids = new Set(spaces().map((s) => s.id));
  const ready = new Set(machines().filter((m) => m.layout === "ready").map((m) => m.name));
  const was = hidden(), next = {}, kill = [], now = Date.now();
  for (const t of terminals) {
    const a = t.address, machine = a.includes("/") ? a.split("/")[0] : null;
    if (!ready.has(machine)) { if (was[a] != null) next[a] = was[a]; continue; }
    if (ids.size && !ids.has(t.labels["float.space"])) kill.push(a);
    else if (a === keep) continue;
    else if (was[a] == null) next[a] = now;
    else if (now - was[a] >= IDLE_MS) kill.push(a);
    else next[a] = was[a];
  }
  saveHidden(next);
  await Promise.all(kill.map((a) => hc(["kill", a])));
}

// Where to open: the focused pane's folder (a tool with `repo` uses the repo's top), on its machine.
async function locate() {
  const f = focused();
  const space = spaces().find((s) => s.id === f?.space);
  if (!f || !space) throw new Problem("warning", "No active pane", "Focus a terminal pane and try again.");
  const cwd = f.cwd || space.folder;
  if (!cwd) throw new Problem("warning", "Folder unknown", "The active pane has no known folder.");
  const machine = space.machine ?? null;
  let root = cwd;
  if (TOOL.repo) {
    const r = await exec("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { on: machine }).catch(() => null);
    const top = r?.code === 0 ? r.stdout.trim().split("\n")[0] : "";
    if (!top) throw new Problem("warning", "Not a git repo", `${cwd} is not inside a git repository.`);
    root = top;
  }
  return { space: space.id, machine, root, previousPane: f.pane };
}

async function start(target) {
  // A login shell, so Homebrew's PATH is there, as in a terminal tab.
  const argv = target.machine ? ["sh", "-lc", TOOL.run] : ["zsh", "-lc", TOOL.run];
  const r = await hc([
    "run", "--json", "--bg", "--rm", "--no-parent",
    ...(target.machine ? ["--on", target.machine] : []),
    "--cwd", target.root,
    "--label", `herdr.mod=${NAME}`,
    "--label", `float.key=${target.root}`,
    "--label", `float.space=${target.space}`,
    "--", ...argv,
  ]);
  if (r.code !== 0) throw new Problem("error", `${TOOL.title} did not start`, coreError(r));
  return JSON.parse(r.stdout).address;
}

function show(target, address) {
  const overlay = openOverlay({
    kind: "dialog", width: TOOL.width ?? 0.8, height: TOOL.height ?? 0.8,
    layout: { type: "column", children: [
      // 0px: its close() runs however the dialog goes (key, click outside, tool exiting).
      { type: "block", size: { px: 0 }, content: { mod: NAME, props: { role: "sentinel", terminal: address } } },
      { type: "block", content: { terminal: address } },
    ] },
  });
  memory().dialog = { overlay, terminal: address, previousPane: target.previousPane };
}

function hide(dialog) {
  memory().dialog = null;
  closeOverlay(dialog.overlay);
  if (dialog.previousPane) run("pane.focus", { pane: dialog.previousPane });
}

async function toggle() {
  const dialog = memory().dialog;
  if (dialog) { hide(dialog); await cleanup(await instances(), null); return; }
  const [terminals, located] = await Promise.all([
    instances(),
    locate().then((target) => ({ target }), (problem) => ({ problem })),
  ]);
  if (located.problem) { await cleanup(terminals, null); throw located.problem; }
  const { target } = located;
  // A one-shot tool (a picker) starts fresh each time; the others are reused per folder and space.
  const existing = TOOL.oneshot ? null
    : terminals.find((t) => t.labels["float.key"] === target.root && t.labels["float.space"] === target.space);
  const address = existing?.address ?? (await start(target));
  show(target, address);
  await cleanup(terminals, address);
}

export default class Float extends View {
  init(_props, cx) {
    this.copy = props() ?? {};
    if (this.copy.role === "sentinel") return;
    const owner = this.copy.overlay;
    if (!owner) return;
    cx.spawn(async (cx) => {
      try { await claim(cx, owner); await toggle(); }
      catch (e) {
        const p = e instanceof Problem;
        notify({ title: p ? e.title : TOOL.title, body: String(e?.message ?? e), level: p ? e.level : "error" });
      } finally { release(owner); closeOverlay(owner); }
    });
  }

  async close() {
    if (this.copy.role !== "sentinel") { if (this.copy.overlay) release(this.copy.overlay); return; }
    const m = memory();
    if (m.dialog?.overlay === this.copy.overlay) m.dialog = null;
    saveHidden({ ...hidden(), [this.copy.terminal]: Date.now() });
  }

  render() { return div(); }
}

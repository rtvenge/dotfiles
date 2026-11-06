// session-bar: a bottom bar of chips for any Herdr layout. Left: the focused pane's folder,
// its branch, and git chips (↑ to push, ↓ to pull, changed, staged, conflicts, stashes).
// Right, while the focused pane runs Claude Code: model, effort, context window and the
// ctx / 5h / 7d meters, which this mod's Claude Code plugin (session-bar/claude-plugin in herdr-mods) writes to
// ~/.local/state/herdr-session-bar/<terminal>.json.
// Chips act: changed opens filetree's Changed view, ↑ ↓ open a push / pull menu, the
// Claude chips open a card with every number. Colors come from theme().
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, home, layout, props, run, notify, openOverlay, closeOverlay, setShared } from "herdr";

const NAME = "session-bar";
const ICON = (name) => `mods/${NAME}/${name}.svg`;
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];
const METER = { ctx: "ansi6", "5h": "ansi5", "7d": "ansi2", mem: "ansi4", gpu: "accent" };
// Local addition (not upstream): this Mac's memory and GPU, from the same script the herdr
// TUI's tab bar uses, so both bars agree. Prints "mem 48/64G +26G swap" and "gpu 12%".
const SYS = () => `${home()}/dotfiles/bin/herdr-status`;
const infoDir = () => `${home()}/.local/state/herdr-session-bar`;
// cc-model-router (a Claude Code plugin) writes its switch here, one file per terminal.
const routerDir = () => `${home()}/.local/state/herdr-model-router`;

function where() {
  const f = focused(), space = spaces().find((s) => s.active);
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd ?? f?.cwd ?? space?.folder ?? null, on, pane, terminal: pane?.terminal ?? f?.terminal ?? null, space };
}

const folderName = (cwd) => (!cwd ? null : cwd === home() ? "~" : cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "/");

// "claude-opus-4-8[1m]" → "Opus 4.8"; anything else as given.
function modelName(id) {
  const m = /(opus|sonnet|haiku|fable)[-_ ]?(\d+)?(?:[-.](\d+))?/i.exec(id ?? "");
  if (!m) return id ?? "";
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}${m[2] ? ` ${m[2]}${m[3] ? `.${m[3]}` : ""}` : ""}`;
}
const windowLabel = (n) => (!n ? null : n >= 1_000_000 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}k`);
const isClaude = (pane) => Boolean(pane && (pane.app === "claude-code" || pane.program?.key === "claude"));

// Corners follow the shown layout's pane frame: square in a flush layout, rounded in a card one.
function frameRadius() {
  let pane = null;
  const walk = (n) => {
    if (!n || pane) return;
    if (n.content?.tab && n.content.pane) pane = n.content.pane;
    for (const c of n.children ?? []) walk(c);
  };
  try { walk(layout()); } catch {}
  const r = Number(pane?.radius ?? 6);
  return Math.max(0, Math.min(6, Number.isFinite(r) ? r : 6));
}

function parseStatus(stdout) {
  const g = { branch: null, upstream: "", ahead: 0, behind: 0, changed: 0, staged: 0, untracked: 0, conflicts: 0 };
  for (const rec of stdout.split("\0")) {
    if (rec.startsWith("## ")) {
      const body = rec.slice(3);
      g.branch = body.startsWith("HEAD (no branch)") ? "detached" : body.match(/^(?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.|\s|$)/)?.[1] ?? body;
      g.upstream = body.match(/\.\.\.(\S+)/)?.[1] ?? "";
      g.ahead = Number(body.match(/ahead (\d+)/)?.[1] ?? 0);
      g.behind = Number(body.match(/behind (\d+)/)?.[1] ?? 0);
      continue;
    }
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    g.changed++;
    if (xy === "??") { g.untracked++; continue; }
    if (/U/.test(xy) || xy === "AA" || xy === "DD") { g.conflicts++; continue; }
    if (xy[0] !== " ") g.staged++;
  }
  return g;
}

// Finds the layout block that shows `mod` and makes it visible: selects it in every stack
// on the way and shows every node above it. False when the layout has no such block.
function revealMod(mod) {
  const path = [];
  const walk = (n) => {
    if (!n) return false;
    path.push(n);
    if (n.content?.mod === mod) return true;
    for (const c of n.children ?? []) if (walk(c)) return true;
    path.pop();
    return false;
  };
  let found = false;
  try { found = walk(layout()); } catch {}
  if (!found) return false;
  path.forEach((n, i) => {
    if (n.type === "stack" && path[i + 1]?.id) run("layout.select", { stack: n.id, child: path[i + 1].id });
    if (i > 0 && n.id) run("layout.show", { id: n.id });
  });
  return true;
}

export default class SessionBar extends View {
  init(_props, cx) {
    this.popup = props()?.popup ?? null;
    if (this.popup) return;
    this.git = null; this.info = null; this.width = 1000;
    cx.timer.every(8000, (cx) => this.refresh(cx));
    this.watchInfo(cx);
    this.sys = null;
    cx.timer.every(5000, (cx) => this.readSys(cx));
    this.readSys(cx);
  }

  // ── this Mac: memory and GPU (local addition) ────────────────────────────────────────
  readSys(cx) {
    if (this.sysLoading) return;
    this.sysLoading = true;
    cx.spawn(async (cx) => {
      try {
        const [m, g] = await Promise.all(["mem", "gpu"].map((a) => exec(SYS(), [a]).catch(() => null)));
        const mem = /mem (\d+)\/(\d+)G(?: \+(\d+)G swap)?/.exec(m?.stdout ?? "");
        const gpu = /gpu (\d+)%/.exec(g?.stdout ?? "");
        const next = {
          mem: mem ? { used: Number(mem[1]), total: Number(mem[2]), swap: mem[3] ? Number(mem[3]) : 0 } : null,
          gpu: gpu ? Number(gpu[1]) : null,
        };
        if (JSON.stringify(next) !== JSON.stringify(this.sys)) { this.sys = next; cx.notify(); }
      } finally { this.sysLoading = false; }
    });
  }

  // ── git ──────────────────────────────────────────────────────────────────────────────
  refresh(cx) {
    const { cwd, on } = where();
    if (!cwd) { this.git = null; return; }
    if (this.loading) { this.again = true; return; }
    const key = JSON.stringify([cwd, on]);
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const g = (args) => exec("git", [...READ, ...args], { cwd, on });
        const top = await g(["rev-parse", "--show-toplevel"]).catch(() => null);
        if (top?.code !== 0) { if (this.key === key) this.git = null; return; }
        const [status, stash] = await Promise.all([
          g(["status", "--porcelain=v1", "-z", "-b", "--untracked-files=normal"]),
          g(["rev-list", "--walk-reflogs", "--count", "refs/stash"]).catch(() => null),
        ]);
        if (this.key !== key || status.code !== 0) return;
        this.git = { ...parseStatus(status.stdout), stash: stash?.code === 0 ? Number(stash.stdout.trim()) || 0 : 0, top: top.stdout.trim(), cwd, on };
        this.watchRepo(this.git.top, on, cx);
      } catch { if (this.key === key) this.git = null; }
      finally {
        this.loading = false;
        if (this.again) { this.again = false; this.refresh(cx); }
        cx.notify();
      }
    });
  }

  watchRepo(top, on, cx) {
    if (on || this.watched === top) return;
    this.watched = top;
    cx.spawn(async (cx) => {
      try { while (this.watched === top) { await watchFolder(top); if (this.watched === top) this.refresh(cx); } }
      catch { if (this.watched === top) this.watched = null; }
    });
  }

  // ── Claude, from the session-bar plugin ──────────────────────────────────────────────
  watchInfo(cx) {
    cx.spawn(async (cx) => {
      try { await exec("mkdir", ["-p", infoDir(), routerDir()]); } catch {}
      this.readInfo(cx);
      try { for (;;) { await watchFolder(infoDir()); this.readInfo(cx); } } catch {}
    });
    cx.spawn(async (cx) => {
      try { await exec("mkdir", ["-p", routerDir()]); } catch {}
      try { for (;;) { await watchFolder(routerDir()); this.readInfo(cx); } } catch {}
    });
    // Whether the plugin is enabled at all lives in Claude Code's settings.
    cx.timer.every(30000, (cx) => this.readPlugin(cx));
    this.readPlugin(cx);
  }

  readPlugin(cx) {
    cx.spawn(async (cx) => {
      let enabled = null;
      try {
        const plugins = JSON.parse((await readTextFile(`${home()}/.claude/settings.json`)) ?? "{}").enabledPlugins ?? {};
        const key = Object.keys(plugins).find((k) => k.startsWith("cc-model-router@"));
        enabled = key ? plugins[key] === true : null;
      } catch {}
      if (enabled !== this.routerPlugin) { this.routerPlugin = enabled; cx.notify(); }
    });
  }

  readInfo(cx) {
    const { terminal, pane } = where();
    if (!terminal || terminal.includes("/") || !isClaude(pane)) { if (this.info || this.router) { this.info = null; this.router = null; cx.notify(); } return; }
    cx.spawn(async (cx) => {
      let info = null, router = null;
      try { info = JSON.parse((await readTextFile(`${infoDir()}/${terminal}.json`)) ?? "null"); } catch {}
      try { router = JSON.parse((await readTextFile(`${routerDir()}/${terminal}.json`)) ?? "null"); } catch {}
      if (where().terminal !== terminal) return;
      this.info = info; this.router = router?.ended ? null : router;
      cx.notify();
    });
  }

  // The popup has to be told its height: padding, the caption, the model line, the router
  // note at about 40 characters a line, a row per meter and the "updated" line, plus a
  // little room. The card also scrolls, should a theme's font run larger.
  claudeCardHeight(i, router) {
    const GAP = 9, LINE = 15;
    const routerLines = router ? Math.ceil(router.label.length / 40) : 0;
    return 24 + 14 + GAP + 18 + (routerLines ? GAP + routerLines * LINE : 0)
      + (i?.meters?.length ?? 0) * (GAP + 18) + (i?.at ? GAP + LINE : 0) + 12;
  }

  // cc-model-router for the focused Claude Code pane: the plugin's switch in Claude Code's
  // settings, then that session's own /router on|off. Null when the plugin isn't installed.
  routerState() {
    if (this.routerPlugin === null || this.routerPlugin === undefined) return null;
    if (!this.routerPlugin) return { on: false, word: "disabled", label: "cc-model-router plugin is disabled in Claude Code" };
    const r = this.router;
    if (!r) return { on: true, word: "on", label: "cc-model-router is enabled. This session reports its state after it restarts" };
    if (!r.on) return { on: false, word: "off", label: "Router off in this session · /router on turns it on" };
    return { on: true, word: "on", label: r.model ? `Router on · picked ${modelName(r.model)}${r.tier ? ` for a ${r.tier} prompt` : ""}` : "Router on · picks the model for each prompt" };
  }

  // ── actions ──────────────────────────────────────────────────────────────────────────
  openChanged() {
    setShared("filetree.view", { view: "changed", n: Date.now() });
    if (!revealMod("filetree")) run("pane.split", { direction: "right", mod: "filetree" });
  }

  openPopup(kind, height) {
    openOverlay({ mod: NAME, kind: "popup", width: 280, height, props: { popup: { kind, git: this.git, info: this.info, router: this.routerState() } } });
  }

  // ── drawing ──────────────────────────────────────────────────────────────────────────
  chip(id, t, R, { icon, iconColor, color, tip, onClick }, ...kids) {
    return h_flex().id(id).h(20).px(7).gap(5).flex_none().items_center().rounded(R)
      .text_size(11.5).text_color(color ?? t.muted)
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => { onClick(cx); cx.notify(); }))
      .when(Boolean(icon), (el) => el.child(svg(ICON(icon)).size(11).flex_none().text_color(iconColor ?? color ?? t.dim)))
      .children(kids.filter((k) => k !== null && k !== undefined && k !== ""));
  }

  meterColor(t, label, pct) {
    return pct >= 95 ? t.ansi1 : pct >= 80 ? t.ansi3 : t[METER[label] ?? "accent"] ?? t.accent;
  }

  track(t, pct, color, w = 46, h = 4) {
    return div().w(w).h(h).flex_none().bg(t.raised).child(div().h_full().w(Math.max(pct > 0 ? 2 : 0, (w * pct) / 100)).bg(color));
  }

  renderPopup() {
    const t = theme(), p = this.popup, close = () => closeOverlay(props().overlay);
    const item = (id, label, sub, act) => v_flex().id(id).px(10).py(6).gap(1).rounded(frameRadius()).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => { close(); act(); }).child(div().text_size(12.5).text_color(t.foreground).child(label)).when(Boolean(sub), (el) => el.child(div().text_size(11).text_color(t.dim).child(sub)));
    const gitRun = (args, doing, done) => {
      const g = p.git;
      notify({ title: `${doing}…`, level: "info", timeout: 1500 });
      exec("git", args, { cwd: g.cwd, on: g.on })
        .then((r) => notify(r.code === 0 ? { title: done, body: (r.stderr || r.stdout).trim().split("\n").pop(), level: "success", timeout: 3000 } : { title: `${doing} failed`, body: (r.stderr || r.stdout).trim(), level: "error", timeout: 6000 }))
        .catch((e) => notify({ title: `${doing} failed`, body: String(e?.message ?? e), level: "error", timeout: 6000 }));
    };
    if (p.kind === "git") {
      const g = p.git, up = g.upstream || "its upstream";
      return v_flex().id("sb-git").size_full().p(5).bg(t.popover ?? t.surface).children([
        g.ahead ? item("sb-push", `Push ${g.ahead} commit${g.ahead === 1 ? "" : "s"}`, `to ${up}`, () => gitRun(["push"], "Pushing", "Pushed")) : null,
        g.behind ? item("sb-pull", `Pull ${g.behind} commit${g.behind === 1 ? "" : "s"}`, `from ${up}`, () => gitRun(["pull", "--ff-only"], "Pulling", "Pulled")) : null,
        item("sb-fetch", "Fetch", "update ↑ ↓ from the remote", () => gitRun(["fetch"], "Fetching", "Fetched")),
      ].filter(Boolean));
    }
    const i = p.info ?? {};
    return v_flex().id("sb-claude").size_full().overflow_y_scrollbar().px(14).py(12).gap(9).bg(t.popover ?? t.surface).text_size(12).text_color(t.muted)
      .child(div().text_size(10.5).font_semibold().text_color(t.dim).child("CLAUDE CODE"))
      .child(h_flex().gap(8).items_center()
        .child(svg(ICON("sparkles")).size(13).text_color(t.ansi3))
        .child(div().text_color(t.foreground).font_medium().child(modelName(i.model)))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child([i.effort, windowLabel(i.window) && `${windowLabel(i.window)} context`].filter(Boolean).join(" · "))))
      .when(Boolean(p.router), (el) => el.child(div().text_size(11).text_color(t.dim).child(p.router.label)))
      .children((i.meters ?? []).map((m) => h_flex().gap(8).items_center()
        .child(div().w(26).flex_none().text_color(t.dim).child(m.label))
        .child(div().flex_1().child(this.track(t, m.percent, this.meterColor(t, m.label, m.percent), 170, 5)))
        .child(div().w(34).flex_none().text_right().child(`${m.percent}%`))))
      .when(Boolean(i.at), (el) => el.child(div().text_size(11).text_color(t.dim).child(`updated ${Math.max(0, Math.round((Date.now() - i.at) / 60000))} min ago`)));
  }

  render(cx) {
    if (this.popup) return this.renderPopup();
    const t = theme(), w = where();
    const key = JSON.stringify([w.cwd, w.on]);
    if (key !== this.key) { this.key = key; this.git = null; this.refresh(cx); }
    if (w.terminal !== this.infoFor) { this.infoFor = w.terminal; this.info = null; this.readInfo(cx); }
    const R = frameRadius(), g = this.git, i = this.info, wide = this.width >= 900, mid = this.width >= 620;
    const ink = t.accent, name = folderName(w.cwd);
    const branch = g?.branch ?? w.pane?.branch ?? w.space?.branch ?? null;
    const chip = (id, opts, ...kids) => this.chip(id, t, R, opts, ...kids);
    const left = [
      name ? h_flex().id("sb-folder").gap(6).flex_none().items_center().tooltip(w.cwd ?? "").child(svg(ICON("folder")).size(13).text_color(ink)).child(div().max_w(180).truncate().child(name)) : null,
      branch ? chip("sb-branch", { icon: "git-branch", iconColor: ink, color: t.foreground, tip: g?.upstream ? `Tracks ${g.upstream} · click to copy` : "Click to copy", onClick: (cx) => { cx.write_to_clipboard(branch); notify({ title: "Copied", body: branch, timeout: 1500 }); } }, div().max_w(wide ? 260 : 160).truncate().child(branch)) : null,
      g?.ahead ? chip("sb-ahead", { icon: "arrow-up", color: t.ansi6, tip: `${g.ahead} to push`, onClick: () => this.openPopup("git", g.behind ? 3 * 44 + 10 : 2 * 44 + 10) }, String(g.ahead)) : null,
      g?.behind ? chip("sb-behind", { icon: "arrow-down", color: t.ansi4, tip: `${g.behind} to pull`, onClick: () => this.openPopup("git", g.ahead ? 3 * 44 + 10 : 2 * 44 + 10) }, String(g.behind)) : null,
      g?.changed ? chip("sb-changed", { icon: "pencil", color: t.ansi11 ?? t.ansi3, tip: `${g.changed} uncommitted (${g.untracked} untracked) · open Changed`, onClick: () => this.openChanged() }, String(g.changed)) : null,
      g?.staged && mid ? chip("sb-staged", { icon: "plus", color: t.ansi2, tip: `${g.staged} staged` }, String(g.staged)) : null,
      g?.conflicts ? chip("sb-conflicts", { icon: "triangle-alert", color: t.ansi1, tip: `${g.conflicts} with conflicts · open Changed`, onClick: () => this.openChanged() }, String(g.conflicts)) : null,
      g?.stash && mid ? chip("sb-stash", { icon: "archive", color: t.dim, tip: `${g.stash} stash${g.stash === 1 ? "" : "es"}` }, String(g.stash)) : null,
    ].filter(Boolean);
    const meters = (i?.meters ?? []).filter((m) => wide || m.label === "ctx");
    const router = isClaude(w.pane) ? this.routerState() : null;
    const claudeCard = () => this.openPopup("claude", this.claudeCardHeight(i, router));
    const routerChip = router ? chip("sb-router", { icon: "route", iconColor: router.on ? t.ansi2 : t.dim, color: router.on ? t.foreground : t.dim, tip: router.label, onClick: i ? claudeCard : null },
      div().child("Router"), div().text_color(router.on ? t.ansi2 : t.dim).child(router.word)) : null;
    const right = i && isClaude(w.pane) ? [
      routerChip,
      chip("sb-model", { icon: "sparkles", iconColor: t.ansi3, color: t.foreground, tip: i.model, onClick: claudeCard },
        div().child(modelName(i.model)),
        mid ? div().text_color(t.dim).child([i.effort, wide ? windowLabel(i.window) : null].filter(Boolean).join(" · ")) : null),
      ...meters.map((m) => chip(`sb-m-${m.label}`, { onClick: claudeCard, tip: `${m.label}: ${m.percent}% used` },
        div().text_color(t.dim).child(m.label), this.track(t, m.percent, this.meterColor(t, m.label, m.percent)), div().child(`${m.percent}%`))),
    ].filter(Boolean) : [routerChip].filter(Boolean);
    return h_flex().id(NAME).size_full().px(14).gap(8).items_center().overflow_hidden().bg(t.chrome).border_t(1).border_color(t.border).text_size(12).text_color(t.muted)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.width) > 8) { this.width = size.width; cx.notify(); } })
      .children(left)
      .child(div().flex_1().min_w(8))
      .children(this.sysChips(t, chip))
      .children(right);
  }

  // Memory (used/total, plus swap once it spills) and GPU busy, as meters like ctx/5h/7d.
  sysChips(t, chip) {
    const s = this.sys;
    if (!s) return [];
    const memPct = s.mem ? Math.round((s.mem.used / s.mem.total) * 100) : 0;
    return [
      s.mem ? chip("sb-mem", { tip: `Memory used: ${s.mem.used} of ${s.mem.total} GB${s.mem.swap ? ` · ${s.mem.swap} GB in swap` : ""}` },
        div().text_color(t.dim).child("mem"), this.track(t, memPct, this.meterColor(t, "mem", memPct)),
        div().child(`${s.mem.used}/${s.mem.total}G`),
        s.mem.swap ? div().text_color(t.ansi3).child(`+${s.mem.swap}G swap`) : null) : null,
      s.gpu !== null ? chip("sb-gpu", { tip: `GPU busy: ${s.gpu}%` },
        div().text_color(t.dim).child("gpu"), this.track(t, s.gpu, this.meterColor(t, "gpu", s.gpu)),
        div().child(`${s.gpu}%`)) : null,
    ].filter(Boolean);
  }
}

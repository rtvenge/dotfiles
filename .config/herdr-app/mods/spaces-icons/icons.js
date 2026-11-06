// A project's own icon: the first file found from CANDIDATES, in the project
// folder, then one folder down (apps/desktop, frontend, site, ...). Copied into
// data/spaces-icons/ in the Herdr home, since image() reads only from there:
// SVGs as text, PNGs with the system's copy (`cp`, or `cmd /c copy` on Windows).
import * as fs from "fs/promises";
import { appHome, exec } from "herdr";

const slash = (p) => p.split("\\").join("/");

async function copy(src, dest) {
  if (src.endsWith(".svg")) return fs.writeFile(dest, await fs.readFile(src, "utf8"));
  const windows = /^[a-z]:\//i.test(src);
  const r = windows
    ? await exec("cmd", ["/c", "copy", "/y", src.split("/").join("\\"), dest.split("/").join("\\")])
    : await exec("cp", [src, dest]);
  if (r.code !== 0) throw new Error(r.stderr || "copy failed");
}

// Most specific first: an explicit override, app icons, logos, then favicons.
// PNG and SVG only (GPUI doesn't draw .ico).
export const CANDIDATES = [
  ".herdr/icon.svg", ".herdr/icon.png",
  "src-tauri/icons/128x128@2x.png", "src-tauri/icons/128x128.png", "src-tauri/icons/icon.png",
  "icon.svg", "icon.png", "logo.svg", "logo.png",
  "assets/icon.svg", "assets/icon.png", "assets/logo.svg", "assets/logo.png",
  "build/icon.png", "resources/icon.png",
  "src/app/icon.svg", "src/app/icon.png", "app/icon.svg", "app/icon.png",
  "public/icon.svg", "public/icon.png", "public/logo.svg", "public/logo.png",
  "src/assets/icon.svg", "src/assets/logo.svg", "src/assets/logo.png",
  "src/lib/assets/icon.svg", "src/lib/assets/logo.svg",
  ".github/logo.svg", ".github/logo.png", "docs/logo.svg", "docs/logo.png",
  "public/favicon.svg", "public/favicon.png", "static/favicon.svg", "static/favicon.png",
  "src/lib/assets/favicon.svg", "favicon.svg", "favicon.png",
];

const SKIP = new Set(["node_modules", "target", "dist", "build", "out", "vendor", ".git", ".venv", "venv", "coverage", "test-results", ".next", ".svelte-kit"]);
const MAX_DIRS = 40;

async function dirs(path) {
  try {
    const all = await fs.readdir(path, { withFileTypes: true });
    return all.filter((d) => d.isDirectory() && !SKIP.has(d.name) && !d.name.startsWith(".")).map((d) => d.name);
  } catch { return []; }
}

// The folders to look in: the root, its subfolders, and apps/* and packages/* one more down.
async function places(root) {
  const out = [root];
  const top = await dirs(root);
  for (const d of top) out.push(`${root}/${d}`);
  for (const group of ["apps", "packages"]) if (top.includes(group)) for (const d of await dirs(`${root}/${group}`)) out.push(`${root}/${group}/${d}`);
  return out.slice(0, MAX_DIRS);
}

// A PNG's width from its header (bytes 16-19), 0 when it isn't one.
async function pngWidth(file) {
  try {
    const b = await fs.readFile(file);
    if (b.length < 24 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return 0;
    return ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
  } catch { return 0; }
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// Resolves with a path image() can show, or null.
export async function findIcon(root) {
  const where = await places(root);
  // What each folder holds, read once: a candidate whose first part isn't there is skipped
  // without touching the disk (most of them, in most folders).
  const holds = {};
  for (const p of where) { try { holds[p] = new Set(await fs.readdir(p)); } catch { holds[p] = new Set(); } }
  for (const c of CANDIDATES) for (const p of where) {
    if (!holds[p].has(c.split("/")[0])) continue;
    const file = `${p}/${c}`;
    if (!(await fs.exists(file))) continue;
    if (c.endsWith(".png") && (await pngWidth(file)) < 16) continue; // a placeholder, not an icon
    const ext = c.endsWith(".svg") ? "svg" : "png";
    const dir = `${slash(appHome())}/data/spaces-icons`;
    // Named by its path: a new icon at the same path shows on the next start.
    const name = `${hash(file)}.${ext}`;
    if (!(await fs.exists(`${dir}/${name}`))) {
      await fs.mkdir(dir, { recursive: true });
      await copy(file, `${dir}/${name}`);
    }
    return `data/spaces-icons/${name}`;
  }
  return null;
}

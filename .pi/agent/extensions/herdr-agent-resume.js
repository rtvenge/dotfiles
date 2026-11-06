// herdr-agent-resume pi session hook
// Notes this Pi session on its Herdr terminal. The installer writes the script path.
import { spawnSync } from "node:child_process";

const script = "/Users/ryantvenge/dotfiles/.config/herdr-app/mods/agent-resume/agent_resume.py";
let noted = "";

function note(_event, ctx) {
  let file = "";
  let id = "";
  let cwd = "";
  try {
    file = ctx.sessionManager.getSessionFile() || "";
    id = ctx.sessionManager.getSessionId() || "";
    cwd = ctx.sessionManager.getCwd() || ctx.cwd || "";
  } catch {
    return;
  }
  // A new session has no file until the first message. Nothing to resume before that.
  if (!file || !id) return;
  const key = id + "\0" + file;
  if (key === noted) return;
  let result;
  try {
    result = spawnSync("python3", [script, "hook", "pi"], {
      input: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: id,
        transcript_path: file,
        cwd,
      }),
      timeout: 8000,
      encoding: "utf8",
    });
  } catch {
    return;
  }
  if (result && result.status === 0 && String(result.stdout || "").trim()) noted = key;
}

export default function (pi) {
  pi.on("session_start", note);
  // The session file appears with the first message, after session_start.
  pi.on("agent_end", note);
}

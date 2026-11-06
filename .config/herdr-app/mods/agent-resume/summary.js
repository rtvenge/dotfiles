// What the toast says after a pass. No `herdr` imports, so `node --test` can check it.
// The shipped toast shows the body on one truncated line: keep it short, most useful first.

// Sessions open in another terminal are fine: nobody needs to hear about them.
const QUIET = new Set(["open in another terminal", "resumed in another terminal", "resumed by its shell"]);

const place = (item) => item.where || item.terminal;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The notification for `agent_resume.py resume` output. */
export function summary(out) {
  if (out.busy) return { title: "Already resuming agents", level: "info", timeout: 2000 };
  const resumed = out.resumed || [];
  const missed = (out.skipped || []).filter((s) => !QUIET.has(s.reason));
  const why = missed.map((s) => `${place(s)}: ${s.reason}`).join("; ");
  if (resumed.length && missed.length) {
    return {
      title: `Resumed ${resumed.length} of ${plural(resumed.length + missed.length, "agent")}`,
      body: `Not resumed: ${why}`,
      level: "warning",
      timeout: 8000,
    };
  }
  if (resumed.length) {
    return { title: `Resumed ${plural(resumed.length, "agent")}`, body: resumed.map(place).join(", "), level: "success", timeout: 5000 };
  }
  if (missed.length) {
    return { title: `Couldn't resume ${plural(missed.length, "agent")}`, body: why, level: "warning", timeout: 8000 };
  }
  return { title: "No agent to resume", body: "No terminal lost its agent.", level: "info", timeout: 3000 };
}

// Agent resume: opened by mod.open:agent-resume (Ctrl+Shift+R) as a small popup.
// It runs one pass of agent_resume.py, which types `claude --resume <id>` /
// `codex resume <id>` into each terminal that lost its agent and sits at a shell,
// then says what came back in a toast and closes.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, appHome, theme, props, closeOverlay, notify } from "herdr";
import { summary } from "./summary.js";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default class AgentResume extends View {
  init(_props, cx) {
    this.text = "Looking for agents to resume…";
    cx.spawn(async (cx) => {
      try {
        const script = `${appHome()}/mods/agent-resume/agent_resume.py`;
        const r = await exec("python3", [script, "resume"]);
        let out;
        try {
          out = JSON.parse(r.stdout);
        } catch {
          throw new Error((r.stderr || r.stdout).trim() || `agent_resume.py exited with ${r.code}`);
        }
        if (out.error) throw new Error(out.error);
        notify(summary(out));
      } catch (e) {
        notify({ title: "Couldn't resume agents", body: String(e?.message || e), level: "error" });
      } finally {
        closeOverlay(props().overlay);
      }
    });
  }

  render() {
    const t = theme();
    return h_flex().id("agent-resume").w_full().h(40).px(14).gap(10).items_center()
      .rounded(10).bg(t.popover).border(1).border_color(t.border)
      .text_size(13).text_color(t.foreground)
      .children([
        div().w(12).text_color(t.accent).frames(SPIN, 80),
        div().flex_1().min_w(0).truncate().child(this.text),
      ]);
  }
}

#!/usr/bin/env python3
"""Agent resume for the Herdr app.

herdr-core brings a terminal that lost its program (reboot, logout, a core
restart) back as a shell in its last folder, but never runs the program again.
This brings agent sessions back, the way the Herdr TUI did:

  hook <agent>        note the session on its terminal (an `agent-resume` label
                      kept by herdr-core). Agents: claude, codex, grok, agy, pi, kiro
  resume              type that agent's resume command into each terminal that
                      lost its agent and sits at a shell
  status              what `resume` would do, without typing anything
  here                run by a shell as it starts (opt-in, see the installer's
                      --auto): when this terminal lost its agent, start it again
                      in place of typing anything
  after CODE          run by the same shell when that agent exits with CODE:
                      says so when it didn't come back (exited right away)
  launch-kiro <id>    internal: supervise a resumed V3 job before its first hook
  adopt               note Claude Code sessions already running before the hook
                      was installed (from ~/.claude/sessions/<pid>.json)
  watch ...           internal: forget a session once its agent exits while the
                      terminal lives on, so a session you quit stays quit

Standard library only (Python 3.8+). `resume` and `status` print JSON.
"""
import glob
import hashlib
import json
import os
import re
import select
import shutil
import subprocess
import sys
import time
from urllib.parse import quote

LABEL = "agent-resume"
AGENTS = {
    "claude": {"names": {"claude"}, "argv": lambda session: ["claude", "--resume", session]},
    "codex": {"names": {"codex"}, "argv": lambda session: ["codex", "resume", session]},
    "grok": {"names": {"grok"}, "argv": lambda session: ["grok", "--resume", session]},
    "agy": {"names": {"agy"}, "argv": lambda session: ["agy", "--conversation", session]},
    "pi": {"names": {"pi"}, "argv": lambda session: ["pi", "--session", session]},
    "kiro": {"names": {"kiro", "kiro-cli", "kiro-cli-chat"},
             "argv": lambda session: ["kiro-cli", "chat", "--v3", "--resume-id", session]},
}
# Launch flags carried over to the resume command, with how many values each takes
# ("+": one or more, up to the next flag). Only flags that set up how the agent runs
# and that its resume command accepts; never ones that pick or start a session
# (--resume, --continue, -p, --session-id, --worktree, a prompt, ...).
KEEP_FLAGS = {
    "claude": {
        "--dangerously-skip-permissions": 0, "--allow-dangerously-skip-permissions": 0,
        "--ide": 0, "--verbose": 0, "--strict-mcp-config": 0, "--chrome": 0, "--no-chrome": 0,
        "--brief": 0, "--disable-slash-commands": 0,
        "--model": 1, "--fallback-model": 1, "--permission-mode": 1, "--agent": 1, "--agents": 1,
        "--settings": 1, "--setting-sources": 1, "--append-system-prompt": 1, "--system-prompt": 1,
        "--effort": 1, "--autocompact": 1, "--plugin-dir": 1,
        "--add-dir": "+", "--allowedTools": "+", "--allowed-tools": "+", "--disallowedTools": "+",
        "--disallowed-tools": "+", "--mcp-config": "+", "--tools": "+", "--betas": "+",
    },
    "codex": {
        "--oss": 0, "--search": 0, "--dangerously-bypass-approvals-and-sandbox": 0,
        "--no-alt-screen": 0, "--approve-for-me": 0,
        "-c": 1, "--config": 1, "-m": 1, "--model": 1, "-p": 1, "--profile": 1, "-s": 1, "--sandbox": 1,
        "-a": 1, "--ask-for-approval": 1, "--add-dir": 1, "--enable": 1, "--disable": 1,
        "--local-provider": 1,
    },
    "grok": {
        "--always-approve": 0, "--debug": 0, "--disable-web-search": 0, "--fullscreen": 0,
        "--minimal": 0, "--no-alt-screen": 0, "--no-plan": 0, "--no-subagents": 0, "--verbatim": 0,
        "--add-dir": "+", "--allow": "+", "--deny": "+",
        "--agent": 1, "--agents": 1, "--debug-file": 1, "--disallowed-tools": 1,
        "-m": 1, "--model": 1, "--permission-mode": 1, "--reasoning-effort": 1, "--effort": 1,
        "--rules": 1, "--sandbox": 1, "--system-prompt-override": 1, "--tools": 1, "--cwd": 1,
    },
    "agy": {
        "--dangerously-skip-permissions": 0, "--disable-slash-commands": 0, "--sandbox": 0,
        "--remote-control": 0,
        "--add-dir": "+",
        "--agent": 1, "--effort": 1, "--log-file": 1, "--mode": 1, "--model": 1,
        "--project": 1, "--settings": 1,
    },
    "pi": {
        "--no-extensions": 0, "-ne": 0, "--no-mcp": 0, "--no-skills": 0, "-ns": 0,
        "--no-prompt-templates": 0, "-np": 0, "--no-themes": 0, "--no-context-files": 0, "-nc": 0,
        "--no-tools": 0, "-nt": 0, "--no-builtin-tools": 0, "-nbt": 0,
        "--approve": 0, "-a": 0, "--no-approve": 0, "-na": 0, "--offline": 0, "--verbose": 0,
        "--provider": 1, "--model": 1, "--system-prompt": 1, "--thinking": 1, "--use-theme": 1,
        "--tools": 1, "-t": 1, "--exclude-tools": 1, "-xt": 1, "--models": 1, "--tui-mode": 1,
        "--session-dir": 1, "--name": 1, "-n": 1,
        "--append-system-prompt": "+", "--extension": "+", "-e": "+", "--skill": "+",
        "--prompt-template": "+", "--theme": "+",
    },
    "kiro": {
        "--trust-all-tools": 0, "-a": 0,
        "--agent": 1, "--model": 1, "--effort": 1, "--trust-tools": 1, "--mode": 1,
    },
}
MAX_ARGS = 64
MAX_ARG_LEN = 1024
AGENT_NAMES = set().union(*(a["names"] for a in AGENTS.values()))
SHELLS = {"fish", "bash", "zsh", "sh", "dash", "ksh", "mksh"}
# 8–128 characters. Pi custom ids may contain "_" and "."; Kiro V3 ids look like sess_<uuid>.
SESSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$")
# Typed into a shell between single quotes: no quotes, backslashes or control characters.
TYPABLE_PATH_RE = re.compile(r"^/[^'\\\x00-\x1f\x7f]*$")
TYPABLE_ARG_RE = re.compile(r"^[^'\\\x00-\x1f\x7f]*$")

SEND_GAP = 0.15      # seconds between two terminals, like the Herdr TUI's spacing
SHELL_SETTLE = 1.5   # a restored shell runs this long before anything is typed into it
START_WAIT = 12.0    # how long `resume` waits for restored shells that haven't started yet
EXIT_GRACE = 2.0     # after an agent exits, wait this long before deciding it quit by itself
VERIFY_WAIT = 5.0    # after typing, how long `resume` gives agents before checking they started
QUICK_EXIT = 10.0    # an agent `here` started that exits sooner than this, with an error, failed
HOOK_HC_TIMEOUT = 3  # the agent waits for its hook: never hold it up long
LOG_LIMIT = 256 * 1024

NOT_STARTED = "shell not started yet"
BY_SHELL = "resumed by its shell"
EXITED = "exited right away"


class HcError(Exception):
    pass


# ---------------------------------------------------------------- processes

def _proc_linux(pid):
    try:
        with open(f"/proc/{pid}/stat", "rb") as f:
            stat = f.read().decode("utf-8", "replace")
    except OSError:
        return None
    comm = stat[stat.index("(") + 1:stat.rindex(")")]
    fields = stat[stat.rindex(")") + 2:].split()
    argv0 = ""
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            argv0 = f.read().split(b"\0", 1)[0].decode("utf-8", "replace")
    except OSError:
        pass
    # fields[0] is stat field 3 (state): ppid is field 4, starttime field 22.
    return {"ppid": int(fields[1]), "names": _names(comm, argv0), "start": int(fields[19])}


def _proc_ps(pid):
    try:
        out = subprocess.run(["ps", "-o", "ppid=", "-o", "comm=", "-p", str(pid)],
                             capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None
    parts = out.split(None, 1)
    if len(parts) != 2 or not parts[0].isdigit():
        return None
    return {"ppid": int(parts[0]), "names": _names(parts[1]), "start": None}


def _names(*raw):
    return {os.path.basename(n.strip()).lstrip("-") for n in raw if n and n.strip()}


def proc(pid):
    """{ppid, names, start} of a process, or None when it's gone."""
    if not isinstance(pid, int) or pid <= 0:
        return None
    if os.path.isdir("/proc/self"):
        return _proc_linux(pid)
    return _proc_ps(pid)


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def find_agent(agent, pid, lookup=proc):
    """The nearest process at or above `pid` that is this agent."""
    names = AGENTS[agent]["names"]
    for _ in range(64):
        info = lookup(pid) if pid and pid > 1 else None
        if not info:
            return None
        if info["names"] & names:
            return pid
        pid = info["ppid"]
    return None


def kiro_launcher(pid, lookup=proc):
    """Collapse helper/runtime processes to the nearest Kiro CLI launcher.

    A shell, another agent or a second launcher is a boundary, not a wrapper.
    A tool-launched Kiro must never become its parent's session.
    """
    original = pid
    for _ in range(64):
        info = lookup(pid) if pid and pid > 1 else None
        if not info:
            break
        names = info["names"]
        if names & {"kiro", "kiro-cli"}:
            return pid
        if not names & {"kiro-cli-chat", "bun", "node"} or names & (AGENT_NAMES - AGENTS["kiro"]["names"]):
            break
        pid = info["ppid"]
    return original


def placement(agent_pid, shell_pid, lookup=proc):
    """Where the agent runs: "direct" in the terminal's own program, "nested" under
    another agent (a one-off run from an agent's tool), "outside" when the terminal's
    program isn't above it (tmux, ssh, ...)."""
    if agent_pid == shell_pid:
        return "direct"
    info = lookup(agent_pid)
    pid = info["ppid"] if info else None
    for _ in range(64):
        if pid == shell_pid:
            return "direct"
        info = lookup(pid) if pid and pid > 1 else None
        if not info:
            return "outside"
        if info["names"] & AGENT_NAMES:
            return "nested"
        pid = info["ppid"]
    return "outside"


def shell_age(pid):
    """Seconds since the process started, or None when unknown."""
    info = proc(pid)
    if not info or info.get("start") is None:
        return None
    try:
        with open("/proc/stat") as f:
            btime = next(int(line.split()[1]) for line in f if line.startswith("btime "))
        return time.time() - (btime + info["start"] / os.sysconf("SC_CLK_TCK"))
    except (OSError, StopIteration, ValueError):
        return None


def wait_exit(pid):
    """Block until `pid` exits."""
    if hasattr(os, "pidfd_open"):
        try:
            fd = os.pidfd_open(pid)
        except OSError:
            return
        try:
            poller = select.poll()
            poller.register(fd, select.POLLIN)
            while not poller.poll(None):
                pass
        finally:
            os.close(fd)
        return
    while alive(pid):
        time.sleep(2)


def boot_id():
    """Something that changes with every boot, or None."""
    try:
        with open("/proc/sys/kernel/random/boot_id") as f:
            return f.read().strip() or None
    except OSError:
        pass
    try:
        out = subprocess.run(["sysctl", "-n", "kern.boottime"], capture_output=True, text=True, timeout=5).stdout
        match = re.search(r"sec = (\d+)", out)
        if match:
            return "boottime:" + match.group(1)
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def proc_argv(pid):
    """A process's argv, or None where it can't be read exactly (only Linux has
    /proc/<pid>/cmdline; `ps` joins the words with spaces)."""
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            raw = f.read()
    except OSError:
        return None
    return [a.decode("utf-8", "replace") for a in raw.split(b"\0")[:-1]] or None


def launch_flags(agent, args):
    """The launch flags in `args` (an argv without argv[0]) worth keeping on resume, as
    groups: [flag, value, ...]. Everything else (session pickers, prompts, unknown
    flags and their values) is left out."""
    keep = KEEP_FLAGS[agent]
    groups, i = [], 0
    args = [a for a in (args or []) if isinstance(a, str)]
    while i < len(args):
        arg = args[i]
        i += 1
        if arg == "--":
            break
        name, eq, inline = arg.partition("=")
        arity = keep.get(name) if name.startswith("-") else None
        if arity is None:
            continue
        if eq:
            if arity != 0:
                groups.append([arg])
            continue
        if arity == 0:
            groups.append([arg])
            continue
        count = 1 if arity == 1 else len(args)
        values = []
        while i < len(args) and len(values) < count and not args[i].startswith("-"):
            values.append(args[i])
            i += 1
        if values:
            groups.append([arg, *values])
    kept, size = [], 0
    for group in groups:
        if size + len(group) > MAX_ARGS or any(len(a) > MAX_ARG_LEN for a in group):
            continue
        kept.append(group)
        size += len(group)
    return kept


def flat(groups):
    return [a for group in groups for a in group]


# ---------------------------------------------------------------- herdr-core

def hc_path():
    return shutil.which("hc") or os.path.expanduser("~/.local/bin/hc")


def hc(args, plain=False, timeout=10):
    """Runs hc. `plain`: as an outsider, so `hc send` types exactly the text (from inside
    a Herdr terminal it would wrap it in <hc from="tN">, which is meant for agents)."""
    env = dict(os.environ)
    if plain:
        env.pop("HC_TERMINAL_ID", None)
        env.pop("HC_SCOPE", None)
    try:
        r = subprocess.run([hc_path(), *args], capture_output=True, text=True, timeout=timeout, env=env)
    except (OSError, subprocess.SubprocessError) as error:
        raise HcError(f"hc {args[0]}: {error}") from error
    if r.returncode != 0:
        raise HcError(f"hc {args[0]}: {(r.stderr or r.stdout).strip() or 'exit ' + str(r.returncode)}")
    return r.stdout


def hc_json(args, timeout=10):
    try:
        return json.loads(hc([*args, "--json"], timeout=timeout))
    except ValueError as error:
        raise HcError(f"hc {args[0]}: not JSON") from error


def valid_session(value):
    return isinstance(value, str) and bool(SESSION_RE.fullmatch(value))


def parse_label(labels):
    """(saved session, problem). Missing and unsupported legacy labels are quiet."""
    raw = labels.get(LABEL) if isinstance(labels, dict) else None
    if raw is None or raw == "":
        return None, None
    if not isinstance(raw, str):
        return None, "invalid session label: expected JSON text"
    try:
        value = json.loads(raw)
    except ValueError:
        return None, "invalid session label: malformed JSON"
    if not isinstance(value, dict):
        return None, "invalid session label: expected an object"
    agent = value.get("agent")
    if not isinstance(agent, str) or agent not in AGENTS:
        return None, "invalid session label: unsupported agent"
    if not valid_session(value.get("session")):
        return None, "invalid session label: invalid session id"
    if agent == "kiro" and not value["session"].startswith("sess_"):
        return None, None  # Legacy V2 labels must not silently migrate a conversation.
    for field in ("cwd", "transcript"):
        path = value.get(field)
        if not isinstance(path, str) or not os.path.isabs(path) or "\0" in path:
            return None, f"invalid session label: {field} must be an absolute path"
    for field in ("pid", "shell"):
        pid = value.get(field)
        if type(pid) is not int or pid <= 0:
            return None, f"invalid session label: {field} must be a positive process id"
    at = value.get("at")
    if at is not None and (type(at) is not int or at < 0):
        return None, "invalid session label: at must be a non-negative timestamp"
    if value.get("boot") is not None and not isinstance(value["boot"], str):
        return None, "invalid session label: boot must be text"
    raw_args = value.get("args")
    value["args"] = flat(launch_flags(agent, raw_args)) if isinstance(raw_args, list) else []
    return value, None


def read_label(labels):
    """The validated saved session in a terminal's labels, or None."""
    return parse_label(labels)[0]


# ---------------------------------------------------------------- log

def data_dir():
    app = os.environ.get("HERDR_APP_HOME") or os.path.expanduser("~/.config/herdr-app")
    return os.path.join(app, "data", "agent-resume")


def log(event, **fields):
    try:
        os.makedirs(data_dir(), exist_ok=True)
        path = os.path.join(data_dir(), "log.jsonl")
        line = json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "event": event, **fields}, ensure_ascii=False)
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        if os.path.getsize(path) > LOG_LIMIT:
            with open(path, "rb") as f:
                f.seek(-LOG_LIMIT // 2, os.SEEK_END)
                tail = f.read().split(b"\n", 1)[-1]
            with open(path, "wb") as f:
                f.write(tail)
    except OSError:
        pass


def runtime_dir():
    base = os.environ.get("XDG_RUNTIME_DIR") or "/tmp"
    folder = os.path.join(base, f"herdr-agent-resume-{os.getuid()}")
    os.makedirs(folder, mode=0o700, exist_ok=True)
    return folder


def runtime_lock(name):
    """An exclusive lock held until this process exits, or None if someone holds it."""
    import fcntl
    fd = os.open(os.path.join(runtime_dir(), name + ".lock"), os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(fd)
        return None
    return fd


# ---------------------------------------------------------------- hook

def _text(data, *keys):
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _event_key(value):
    return re.sub(r"[\s_-]", "", str(value or "")).lower()


def is_session_event(agent, data):
    """True for the events that mean "this session is the one in this terminal".

    Kiro V3 also reports UserPromptSubmit after switching conversations.
    Antigravity's SessionStart fires for a
    new conversation; PreInvocation fires on every model call, including a resumed one."""
    raw = data.get("hook_event_name") or data.get("hookEventName")
    if not raw:
        return True
    key = _event_key(raw)
    if key == "sessionstart":
        return True
    if agent == "agy" and key == "preinvocation":
        return True
    return agent == "kiro" and key == "userpromptsubmit"


def default_transcript(agent, session, cwd, home=None):
    """Where this agent stores the conversation, when the hook didn't say."""
    home = home or os.path.expanduser("~")
    if agent == "grok" and isinstance(cwd, str) and cwd:
        return os.path.join(home, ".grok", "sessions", quote(cwd, safe=""), session, "updates.jsonl")
    if agent == "agy":
        return os.path.join(home, ".gemini", "antigravity-cli", "brain", session,
                            ".system_generated", "logs", "transcript.jsonl")
    if agent == "kiro":
        # V3 persists metadata even before the first message. Existing sessions
        # may have multiple workspace roots: find their actual bucket first.
        root = os.path.join(home, ".kiro", "sessions")
        found = glob.glob(os.path.join(root, "*", glob.escape(session), "session.json"))
        if len(found) == 1:
            return found[0]
        if found or not isinstance(cwd, str) or not os.path.isabs(cwd):
            return None
        bucket = hashlib.sha256(os.path.normpath(cwd.replace("\\", "/")).encode("utf-8")).hexdigest()[:16]
        return os.path.join(root, bucket, session, "session.json")
    return None


def hook(agent, raw, env=None):
    """SessionStart: note the session on this terminal. Returns what it did, for the log."""
    env = os.environ if env is None else env
    term = env.get("HC_TERMINAL_ID")
    if not term:
        return "not in a Herdr terminal"
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        return "input is not JSON"
    if not isinstance(data, dict):
        return "input is not an object"
    if not is_session_event(agent, data):
        return "not SessionStart"
    if data.get("agent_id") or data.get("agentId") or _text(data, "subagentType", "subagent_type"):
        return "subagent"
    if agent == "agy":
        session = _text(data, "conversationId", "conversation_id", "session_id", "sessionId")
        paths = data.get("workspacePaths") if isinstance(data.get("workspacePaths"), list) else []
        cwd = paths[0] if paths and isinstance(paths[0], str) else _text(data, "cwd")
    else:
        session = _text(data, "session_id", "sessionId")
        if agent == "grok":
            session = session or (env.get("GROK_SESSION_ID") if isinstance(env.get("GROK_SESSION_ID"), str) else None)
        cwd = _text(data, "cwd")
    if not valid_session(session):
        return "no usable session id"
    if agent == "kiro" and not session.startswith("sess_"):
        return "Kiro V2 is not supported"
    if agent == "codex" and env.get("CODEX_THREAD_ID") not in (None, "", session):
        return "codex sub-thread"
    if isinstance(cwd, str) and cwd.startswith("~"):
        cwd = os.path.expanduser(cwd)
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()
    transcript = _text(data, "transcript_path", "transcriptPath")
    if isinstance(transcript, str) and transcript.startswith("~"):
        transcript = os.path.expanduser(transcript)
    if not transcript:
        transcript = default_transcript(agent, session, cwd)
    if not isinstance(transcript, str) or not transcript:
        return "no transcript: the session can't be resumed"

    agent_pid = find_agent(agent, os.getppid())
    if agent_pid is None and agent == "claude" and str(env.get("CLAUDE_PID", "")).isdigit():
        agent_pid = int(env["CLAUDE_PID"])
    terminal = hc_json(["get", term], timeout=HOOK_HC_TIMEOUT)
    shell = terminal.get("pid")
    if terminal.get("state") != "live" or not shell:
        return "terminal not live"
    if not agent_pid:
        return "agent process not found"
    if agent == "kiro":
        agent_pid = kiro_launcher(agent_pid)
    where = placement(agent_pid, shell)
    if where != "direct":
        return f"agent runs {where}"
    label = read_label(terminal.get("labels"))
    if (label and label.get("agent") == agent and label.get("session") == session
            and label.get("pid") == agent_pid and label.get("shell") == shell):
        return "already noted"

    remember(term, agent, session, cwd, transcript, agent_pid, shell)
    return "saved"


def remember(term, agent, session, cwd, transcript, agent_pid, shell, watcher=True, launch_args=None):
    """Label the terminal with the session (and the agent's launch flags) and start its watcher."""
    label = {"agent": agent, "session": session, "cwd": cwd, "transcript": transcript,
             "pid": agent_pid, "shell": shell, "boot": boot_id(), "at": int(time.time() * 1000)}
    argv = proc_argv(agent_pid) if launch_args is None else None
    if launch_args is not None or argv:
        label["args"] = flat(launch_flags(agent, launch_args if launch_args is not None else argv[1:]))
    hc(["label", term, f"{LABEL}={json.dumps(label, separators=(',', ':'), ensure_ascii=False)}"], timeout=HOOK_HC_TIMEOUT)
    if watcher:
        subprocess.Popen([sys.executable, os.path.abspath(__file__), "watch", term, str(agent_pid), str(shell)],
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         close_fds=True, start_new_session=True)


def claude_session_of(pid, home=None):
    """(session, cwd, transcript) of a running interactive Claude Code process, from the
    registry it keeps in ~/.claude/sessions/<pid>.json, or None."""
    home = home or os.path.expanduser("~")
    try:
        with open(os.path.join(home, ".claude", "sessions", f"{pid}.json"), encoding="utf-8") as f:
            info = json.load(f)
    except (OSError, ValueError):
        return None
    session, cwd = info.get("sessionId"), info.get("cwd")
    if info.get("pid") != pid or info.get("kind") not in (None, "interactive") or not valid_session(session):
        return None
    found = glob.glob(os.path.join(home, ".claude", "projects", "*", f"{session}.jsonl"))
    if not found or not isinstance(cwd, str):
        return None
    return session, cwd, found[0]


def adopt():
    """Label Claude Code sessions that were already running before the hook was installed.
    (Codex sessions are picked up the next time they start or resume.)"""
    adopted, skipped = [], []
    for terminal in gather():
        fg, shell = terminal.get("foreground") or {}, terminal.get("pid")
        agent_pid = fg.get("pid")
        if not shell or not agent_pid or not (_names(fg.get("name") or "") & AGENTS["claude"]["names"]):
            continue
        item = {"terminal": terminal["address"], "where": (terminal.get("labels") or {}).get("where"), "agent": "claude"}
        label = read_label(terminal.get("labels"))
        if label and label.get("pid") == agent_pid:
            skipped.append({**item, "reason": "already noted"})
            continue
        found = claude_session_of(agent_pid)
        if not found:
            skipped.append({**item, "reason": "session not found"})
            continue
        if placement(agent_pid, shell) != "direct":
            skipped.append({**item, "reason": "not run by the terminal's shell"})
            continue
        session, cwd, transcript = found
        remember(terminal["address"], "claude", session, cwd, transcript, agent_pid, shell)
        adopted.append({**item, "session": session})
        log("adopt", terminal=terminal["address"], agent="claude", session=session)
    return {"adopted": adopted, "skipped": skipped}


def watch(term, agent_pid, shell):
    """Runs detached beside an agent. When the agent exits and its terminal's program is
    still the same one, the person quit it: forget the session. When the terminal went
    with it (reboot, logout, core restart, pane closed), keep it for `resume`."""
    lock = runtime_lock(f"watch-{agent_pid}")
    if lock is None:
        return "already watched"
    wait_exit(agent_pid)
    time.sleep(EXIT_GRACE)
    if not alive(shell):
        return "terminal went with it"
    terminal = hc_json(["get", term])
    if terminal.get("state") != "live" or terminal.get("pid") != shell:
        return "terminal was replaced"
    label = read_label(terminal.get("labels"))
    if not label or label.get("pid") != agent_pid:
        return "a newer session took over"
    hc(["label", term, f"{LABEL}="])
    return "forgot " + label["session"]


# ---------------------------------------------------------------- resume

def lost(terminal, label, boot):
    """True when the program the agent ran under is gone: another boot, or another process."""
    if boot and label.get("boot") and label["boot"] != boot:
        return True
    return terminal.get("pid") != label.get("shell")


def at_shell(terminal):
    fg = terminal.get("foreground") or {}
    return bool(terminal.get("pid")) and fg.get("pid") == terminal.get("pid") and _names(fg.get("name") or "") & SHELLS


def starting_agent(terminal, agent):
    """True when the terminal's foreground is this agent, or `agent_resume.py here` about
    to become it: the shell brought it back by itself."""
    fg = terminal.get("foreground") or {}
    argv = [a for a in (fg.get("argv") or [])[:3] if isinstance(a, str)]
    names = _names(fg.get("name") or "", *argv)
    return bool(names & AGENTS[agent]["names"]) or "agent_resume.py" in names


def resume_argv(label, typable_only=False):
    """The resume command as an argv: the agent's own resume words, then its launch
    flags. `typable_only` leaves out flags with a value that can't go between single
    quotes (a quote, a backslash, a control character)."""
    groups = launch_flags(label["agent"], label.get("args") or [])
    if typable_only:
        groups = [g for g in groups if all(TYPABLE_ARG_RE.match(a) for a in g)]
    return AGENTS[label["agent"]]["argv"](label["session"]) + flat(groups)


def _quote(arg):
    return arg if re.match(r"^[A-Za-z0-9_@%+=:,./-]+$", arg) else f"'{arg}'"


def command(label):
    """What to type, or None when the folder can't be typed safely."""
    cwd = label.get("cwd")
    if not isinstance(cwd, str) or not TYPABLE_PATH_RE.match(cwd):
        return None
    if label["agent"] == "kiro":
        script = os.path.abspath(__file__)
        if not TYPABLE_PATH_RE.match(script) or not TYPABLE_PATH_RE.match(sys.executable):
            return None
        return f"cd '{cwd}' && " + " ".join(_quote(a) for a in
            [sys.executable, script, "launch-kiro", label["session"]])
    return f"cd '{cwd}' && " + " ".join(_quote(a) for a in resume_argv(label, typable_only=True))


def plan(terminals, boot, folder_ok=os.path.isdir, file_ok=os.path.isfile):
    """Which terminals to resume. Pure: `terminals` are `hc get` records."""
    entries, skipped = [], []
    for terminal in terminals:
        if terminal.get("state") != "live":
            continue
        label, problem = parse_label(terminal.get("labels"))
        if problem:
            skipped.append({"terminal": terminal["address"], "where": terminal["labels"].get("where"),
                            "agent": None, "session": None, "cwd": None, "reason": problem})
        if label:
            entries.append((terminal, label, lost(terminal, label, boot)))
    still_open = {(label["agent"], label["session"]) for _, label, gone in entries if not gone}
    todo, taken = [], set()
    for terminal, label, gone in sorted(entries, key=lambda e: -(e[1].get("at") or 0)):
        if not gone:
            continue
        key = (label["agent"], label["session"])
        item = {"terminal": terminal["address"], "where": (terminal.get("labels") or {}).get("where"),
                "agent": label["agent"], "session": label["session"], "cwd": label.get("cwd")}
        typed = command(label)
        if key in still_open:
            reason = "open in another terminal"
        elif key in taken:
            reason = "resumed in another terminal"
        elif not terminal.get("pid"):
            reason = NOT_STARTED
        elif not at_shell(terminal):
            reason = BY_SHELL if starting_agent(terminal, label["agent"]) else "something else is running there"
        elif not folder_ok(label.get("cwd")):
            reason = "its folder is gone"
        elif not file_ok(label.get("transcript")):
            reason = "no saved conversation to resume"
        elif typed is None:
            reason = "its folder name can't be typed safely"
        else:
            reason = None
        if reason:
            skipped.append({**item, "reason": reason})
        else:
            taken.add(key)
            todo.append({**item, "command": typed})
    return todo, skipped


def gather():
    """`hc get` of every live local terminal."""
    from concurrent.futures import ThreadPoolExecutor
    listed = hc_json(["ls"])
    rows = listed.get("terminals", []) if isinstance(listed, dict) else listed
    live = [t["address"] for t in rows if t.get("state") == "live" and "/" not in str(t.get("address"))]

    def get(address):
        try:
            return hc_json(["get", address])
        except HcError:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        return [t for t in pool.map(get, live) if t]


def last_words(screen):
    """The last line an agent printed before the shell's prompt came back, or None."""
    lines = [line.strip() for line in (screen or "").splitlines() if line.strip()]
    return lines[-2][:160] if len(lines) >= 2 else None


def start_failed(terminal, label, boot):
    """True when a resume typed into this terminal is over without the agent coming up:
    the shell is in front again and no hook noted the session under it."""
    return at_shell(terminal) and (label is None or lost(terminal, label, boot))


def failed_start(address, boot):
    """Why the agent typed into `address` didn't start, or None when it did (or still runs)."""
    try:
        terminal = hc_json(["get", address])
    except HcError:
        return None
    if not start_failed(terminal, read_label(terminal.get("labels")), boot):
        return None
    try:
        said = last_words(hc(["read", address]))
    except HcError:
        said = None
    return f"{EXITED}: {said}" if said else EXITED


def resume(dry_run=False, wait=START_WAIT):
    lock = runtime_lock("resume")
    if lock is None:
        return {"busy": True, "resumed": [], "skipped": []}
    boot = boot_id()
    deadline = time.monotonic() + wait
    while True:
        todo, skipped = plan(gather(), boot)
        if dry_run or time.monotonic() >= deadline or not any(s["reason"] == NOT_STARTED for s in skipped):
            break
        time.sleep(0.5)
    if dry_run:
        return {"resumed": todo, "skipped": skipped, "dry_run": True}

    resumed = []
    for index, item in enumerate(todo):
        if index:
            time.sleep(SEND_GAP)
        try:
            terminal = hc_json(["get", item["terminal"]])
            if claim_holder(item["agent"], item["session"]):
                skipped.append({**item, "reason": BY_SHELL})
                continue
            if not at_shell(terminal):
                skipped.append({**item, "reason": "something else is running there"})
                continue
            age = shell_age(terminal["pid"])
            if age is not None and age < SHELL_SETTLE:
                time.sleep(SHELL_SETTLE - age)
            hc(["send", item["terminal"], item["command"]], plain=True)
        except HcError as error:
            skipped.append({**item, "reason": f"couldn't type into it: {error}"})
            continue
        resumed.append(item)
        log("resume", terminal=item["terminal"], where=item["where"], agent=item["agent"], session=item["session"])
    if resumed:
        time.sleep(VERIFY_WAIT)
        for item in list(resumed):
            why = failed_start(item["terminal"], boot)
            if why:
                resumed.remove(item)
                skipped.append({**item, "reason": why})
    for item in skipped:
        log("skip", terminal=item["terminal"], agent=item["agent"], session=item["session"], reason=item["reason"])
    return {"resumed": resumed, "skipped": skipped}


# ---------------------------------------------------------------- here (auto-resume)

def _claim_path(agent, session):
    return os.path.join(runtime_dir(), f"claim-{agent}-{session}")


def _stamp(pid):
    info = proc(pid)
    return f"{pid} {info.get('start')}" if info else None


def claim_holder(agent, session):
    """The live process a shell started this session in (it exec'd into the agent), or None."""
    try:
        with open(_claim_path(agent, session)) as f:
            saved = f.read().strip()
        pid = int(saved.split()[0])
    except (OSError, ValueError, IndexError):
        return None
    return pid if _stamp(pid) == saved else None


def claim(agent, session):
    """Mark the session as being resumed by this process (which becomes the agent).
    False when another writer or live agent already holds it."""
    # Separate names: a session ending in '.lock' must not be another claim's lock.
    lock = runtime_lock(f"claim-guard-{agent}-{session}")
    if lock is None:
        return False
    try:
        path = _claim_path(agent, session)
        if claim_holder(agent, session):
            return False
        # Checking stale ownership and publishing a new owner share one lock.
        # An empty file while this writer starts is never treated as a stale claim.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            stamp = _stamp(os.getpid())
            if stamp is None:
                return False
            f.write(stamp)
        return True
    finally:
        os.close(lock)


def decide_here(terminal, shell_pid, boot, folder_ok=os.path.isdir, file_ok=os.path.isfile):
    """(label, None) when this shell should bring its terminal's agent back, else
    (None, why not). Pure, like `plan`."""
    if terminal.get("state") != "live" or terminal.get("pid") != shell_pid:
        return None, "not the terminal's own shell"
    label, problem = parse_label(terminal.get("labels"))
    if problem:
        return None, problem
    if not label:
        return None, "no session noted"
    if not lost(terminal, label, boot):
        return None, "agent not lost"
    if not folder_ok(label.get("cwd")):
        return None, "its folder is gone"
    if not file_ok(label.get("transcript")):
        return None, "no saved conversation to resume"
    return label, None


def _exit_code(status):
    if os.WIFEXITED(status):
        return os.WEXITSTATUS(status)
    return 128 + os.WTERMSIG(status) if os.WIFSIGNALED(status) else 1


def _default_signals():
    """Python ignores SIGPIPE and SIGXFSZ; an exec'd program would inherit that."""
    import signal
    for name in ("SIGPIPE", "SIGXFSZ"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), signal.SIG_DFL)


def run_as_job(argv, cwd, started=None):
    """Run the agent as the terminal's foreground job and wait for it. For shells that
    run startup code without job control (fish does, from its prompt event): there the
    agent would share the shell's process group, so Herdr would see the shell in front
    and Ctrl+Z couldn't work. Returns the agent's exit code."""
    import signal
    tty = sys.stdin.fileno()
    shell_group = os.getpgrp()
    pid = os.fork()
    if pid == 0:
        try:
            os.setpgid(0, 0)
            signal.signal(signal.SIGTTOU, signal.SIG_IGN)
            os.tcsetpgrp(tty, os.getpgrp())
            signal.signal(signal.SIGTTOU, signal.SIG_DFL)
            _default_signals()
            os.chdir(cwd)
            os.execvp(argv[0], argv)
        except OSError as error:
            sys.stderr.write(f"agent-resume: couldn't start {argv[0]}: {error}\n")
        os._exit(127)
    signal.signal(signal.SIGTTOU, signal.SIG_IGN)
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    try:
        os.setpgid(pid, pid)
    except OSError:
        pass
    try:
        os.tcsetpgrp(tty, pid)
    except OSError:
        pass
    if started:
        try:
            started(pid)
        except Exception as error:
            log("launch", outcome=f"couldn't note the child: {error}")
    while True:
        _, status = os.waitpid(pid, os.WUNTRACED)
        if os.WIFSTOPPED(status):  # Ctrl+Z: there's no shell job to park it in, so go on
            try:
                os.tcsetpgrp(tty, pid)
                os.killpg(pid, signal.SIGCONT)
            except OSError:
                pass
            continue
        break
    try:
        os.tcsetpgrp(tty, shell_group)
    except OSError:
        pass
    return _exit_code(status)


def needs_own_job():
    """True when this process shares the shell's process group, i.e. the shell runs it
    without job control."""
    try:
        return os.isatty(0) and os.getpgrp() == os.getpgid(os.getppid())
    except OSError:
        return False


def kiro_finished(term, original, shell, pid, code, elapsed):
    """Forget a completed Kiro job, or retain its old label for a failed-start retry.

    The wrapper owns this child even when Kiro defers hooks until the first prompt.
    A stopped core kills the wrapper too, leaving the persisted label for next boot.
    """
    terminal = hc_json(["get", term])
    current = read_label(terminal.get("labels"))
    if terminal.get("pid") != shell or not current or current.get("pid") != pid:
        return
    if code not in (0, 130, 143) and elapsed < QUICK_EXIT and current["session"] == original["session"]:
        value = json.dumps(original, separators=(',', ':'))
    else:
        value = ""
    hc(["label", term, f"{LABEL}={value}"])


def run_kiro(term, label, shell):
    child = []
    began = time.monotonic()

    def started(pid):
        child.append(pid)
        remember(term, "kiro", label["session"], label["cwd"], label["transcript"], pid, shell,
                 watcher=False, launch_args=label.get("args", []))

    code = run_as_job(resume_argv(label), label["cwd"], started=started)
    try:
        if child:
            kiro_finished(term, label, shell, child[0], code, time.monotonic() - began)
    except HcError as error:
        log("launch", terminal=term, outcome=str(error))
    return code


def launch_kiro(session, env=None):
    env = os.environ if env is None else env
    term = env.get("HC_TERMINAL_ID")
    if not term:
        return 1
    terminal = hc_json(["get", term])
    label = read_label(terminal.get("labels"))
    shell = terminal.get("pid")
    if (not label or label["agent"] != "kiro" or label["session"] != session
            or placement(os.getpid(), shell) != "direct"):
        return 1
    if not claim("kiro", session):
        return 1
    return run_kiro(term, label, shell)


def here(env=None, shell_pid=None):
    """Called by a starting shell. Starts the agent when its terminal lost one and
    returns its exit code; returns why not otherwise."""
    env = os.environ if env is None else env
    term = env.get("HC_TERMINAL_ID")
    if not term:
        return "not in a Herdr terminal"
    if env.get("AGENT_RESUME_AUTO") == "0":
        return "turned off"
    terminal = hc_json(["get", term], timeout=HOOK_HC_TIMEOUT)
    label, why = decide_here(terminal, shell_pid or os.getppid(), boot_id())
    if why:
        return why
    if not claim(label["agent"], label["session"]):
        return "resumed in another terminal"
    argv = resume_argv(label)
    where = (terminal.get("labels") or {}).get("where")
    log("here", terminal=term, where=where, agent=label["agent"], session=label["session"])
    sys.stderr.write(f"\033[2magent-resume: {' '.join(_quote(a) for a in argv)} in {label['cwd']}\033[0m\n")
    sys.stderr.flush()
    try:
        if label["agent"] == "kiro":
            return run_kiro(term, label, terminal["pid"])
        if needs_own_job():
            return run_as_job(argv, label["cwd"])
        _default_signals()
        os.chdir(label["cwd"])
        os.execvp(argv[0], argv)
    except OSError as error:
        # This process is about to exit; its stale claim can be reclaimed under
        # the claim lock. Do not unlink a claim another process could replace.
        return f"couldn't start {argv[0]}: {error}"


def after(code, env=None):
    """The shell runs this when the agent `here` started exits with an error. When that
    was quick and no hook noted the session, the resume failed: say so in the terminal
    and the log. Returns the line printed, or None."""
    env = os.environ if env is None else env
    term = env.get("HC_TERMINAL_ID")
    if not term or not code or code in ("0", "130", "143"):  # fine, Ctrl+C, SIGTERM: quit on purpose
        return None
    terminal = hc_json(["get", term], timeout=HOOK_HC_TIMEOUT)
    label = read_label(terminal.get("labels"))
    if not label or not lost(terminal, label, boot_id()):
        return None
    lock = runtime_lock(f"claim-guard-{label['agent']}-{label['session']}")
    if lock is None:
        return None  # A new owner is publishing its claim.
    try:
        path = _claim_path(label["agent"], label["session"])
        ran = time.time() - os.path.getmtime(path)
        if claim_holder(label["agent"], label["session"]):
            return None
        os.unlink(path)
    except OSError:
        return None
    finally:
        os.close(lock)
    if ran > QUICK_EXIT:
        return None
    log("failed", terminal=term, agent=label["agent"], session=label["session"], code=code)
    return (f"agent-resume: {label['agent']} exited right away (code {code}), so session "
            f"{label['session']} didn't come back. Ctrl+Shift+R tries again.")


# ---------------------------------------------------------------- CLI

def main(argv):
    command_name = argv[1] if len(argv) > 1 else "status"
    if command_name == "launch-kiro":
        try:
            return launch_kiro(argv[2] if len(argv) > 2 else "")
        except (HcError, OSError) as error:
            log("launch", outcome=str(error))
            return 1
    if command_name == "hook":
        agent = argv[2] if len(argv) > 2 else ""
        raw = sys.stdin.read()
        outcome = "ignored"
        if agent in AGENTS:
            try:
                outcome = hook(agent, raw)
            except Exception as error:  # a hook must never get in the agent's way
                outcome = f"error: {error}"
            if outcome != "not in a Herdr terminal":
                log("hook", agent=agent, terminal=os.environ.get("HC_TERMINAL_ID"), outcome=outcome)
        # Antigravity reads stdout as JSON. Pi's extension reads this one line and
        # shows it to nobody. Every other agent would treat stdout as context, so stay quiet.
        if agent == "agy":
            sys.stdout.write("{}\n")
        elif agent == "pi":
            sys.stdout.write(outcome + "\n")
        return 0
    if command_name == "watch":
        term, agent_pid, shell = argv[2], int(argv[3]), int(argv[4])
        try:
            outcome = watch(term, agent_pid, shell)
        except Exception as error:
            outcome = f"error: {error}"
        if outcome.startswith(("forgot", "error")):
            log("watch", terminal=term, outcome=outcome)
        return 0
    if command_name == "here":
        try:
            outcome = here()
        except Exception as error:  # never break the shell starting up
            outcome = f"error: {error}"
        if isinstance(outcome, int):
            return outcome  # the agent ran as a job: its exit code, for `after`
        if outcome.startswith(("couldn't", "error", "invalid session label:")):
            log("here", terminal=os.environ.get("HC_TERMINAL_ID"), outcome=outcome)
            sys.stderr.write(f"agent-resume: {outcome}\n")
        return 0
    if command_name == "after":
        try:
            line = after(argv[2] if len(argv) > 2 else "")
        except Exception as error:
            line = None
            log("after", terminal=os.environ.get("HC_TERMINAL_ID"), outcome=f"error: {error}")
        if line:
            sys.stderr.write(f"\033[33m{line}\033[0m\n")
        return 0
    if command_name in ("resume", "status", "adopt"):
        try:
            if command_name == "adopt":
                out = adopt()
            else:
                out = resume(dry_run=command_name == "status" or "--dry-run" in argv)
        except HcError as error:
            print(json.dumps({"error": str(error)}))
            return 1
        print(json.dumps(out, indent=2 if sys.stdout.isatty() else None, ensure_ascii=False))
        return 0
    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env bash
set -euo pipefail

payload="$(cat || true)"

if [[ -z "${payload//[[:space:]]/}" ]]; then
  echo "claude"
  exit 0
fi

if ! command -v oh-my-posh >/dev/null 2>&1; then
  echo "claude"
  exit 0
fi

read_status() {
  PAYLOAD="$payload" python3 - <<'PY'
import json
import os

def duration(ms):
    if ms is None:
        return "00:00:00"
    try:
        total_seconds = max(0, int(float(ms) / 1000))
    except Exception:
        return "00:00:00"
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def token_count(value):
    try:
        value = float(value)
    except Exception:
        return None
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}m"
    if value >= 1_000:
        return f"{value / 1_000:.1f}k"
    return str(int(value))

def cost_str(usd):
    try:
        usd = float(usd)
    except Exception:
        return ""
    if usd == 0:
        return ""
    if usd < 0.01:
        return f"{usd:.4f}"
    return f"{usd:.2f}"

raw = os.environ.get("PAYLOAD", "")
try:
    data = json.loads(raw)
except Exception:
    print("cwd\t.")
    print("model\t")
    print("context\t")
    print("cost\t")
    print("duration\t00:00:00")
    print("changes\t")
    raise SystemExit(0)

workspace = data.get("workspace", {}) if isinstance(data.get("workspace", {}), dict) else {}
cost = data.get("cost", {}) if isinstance(data.get("cost", {}), dict) else {}
model = data.get("model", {}) if isinstance(data.get("model", {}), dict) else {}
context = data.get("context_window", {}) if isinstance(data.get("context_window", {}), dict) else {}

cwd = data.get("cwd") or workspace.get("current_dir") or "."

model_name = model.get("display_name") or model.get("id") or ""

used_pct = context.get("used_percentage")
try:
    pct_str = f"{float(used_pct):.0f}%" if used_pct is not None else ""
except Exception:
    pct_str = ""

current_usage = context.get("current_usage", {}) if isinstance(context.get("current_usage", {}), dict) else {}
current_tokens = (
    context.get("total_input_tokens", 0) + context.get("total_output_tokens", 0)
    if context.get("total_input_tokens") is not None
    else sum(v for v in current_usage.values() if isinstance(v, (int, float)))
)
context_limit = context.get("context_window_size")

tokens_str = ""
if current_tokens:
    limit_str = token_count(context_limit) if context_limit else "?"
    tokens_str = f"{token_count(current_tokens)}/{limit_str}"

context_display = " ".join(part for part in (tokens_str, pct_str) if part)

added = cost.get("total_lines_added") or 0
removed = cost.get("total_lines_removed") or 0
try:
    added = int(added)
except Exception:
    added = 0
try:
    removed = int(removed)
except Exception:
    removed = 0
changes = f"+{added}/-{removed}" if (added or removed) else ""

print(f"cwd\t{cwd}")
print(f"model\t{model_name}")
print(f"context\t{context_display}")
print(f"cost\t{cost_str(cost.get('total_cost_usd'))}")
print(f"duration\t{duration(cost.get('total_duration_ms'))}")
print(f"changes\t{changes}")
PY
}

cwd="."
model=""
context=""
cost=""
duration="00:00:00"
changes=""

while IFS=$'\t' read -r key value; do
  case "$key" in
    cwd) cwd="$value" ;;
    model) model="$value" ;;
    context) context="$value" ;;
    cost) cost="$value" ;;
    duration) duration="$value" ;;
    changes) changes="$value" ;;
  esac
done < <(printf '%s' "$payload" | read_status)

export CLAUDE_STATUS_MODEL="$model"
export CLAUDE_STATUS_CONTEXT="$context"
export CLAUDE_STATUS_COST="$cost"
export CLAUDE_STATUS_DURATION="$duration"
export CLAUDE_STATUS_CHANGES="$changes"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
theme_path="$script_dir/statusline.omp.json"

if [[ ! -f "$theme_path" ]]; then
  echo "claude"
  exit 0
fi

oh-my-posh print primary --config "$theme_path" --pwd "$cwd" 2>/dev/null || echo "claude"

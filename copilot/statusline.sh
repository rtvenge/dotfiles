#!/usr/bin/env bash
set -euo pipefail

payload="$(cat || true)"

cache_dir="${COPILOT_HOME:-$HOME/.copilot}"
cache_file="$cache_dir/statusline.payload.json"

# Compatibility fallbacks: some runtimes may provide the payload as an arg or env var.
if [[ -z "${payload//[[:space:]]/}" && $# -gt 0 ]]; then
  payload="$1"
fi
if [[ -z "${payload//[[:space:]]/}" && -n "${COPILOT_STATUS_PAYLOAD:-}" ]]; then
  payload="$COPILOT_STATUS_PAYLOAD"
fi
if [[ -z "${payload//[[:space:]]/}" && -f "$cache_file" ]]; then
  payload="$(cat "$cache_file" || true)"
fi

if [[ -z "${payload//[[:space:]]/}" ]]; then
  echo "copilot"
  exit 0
fi

if ! command -v oh-my-posh >/dev/null 2>&1; then
  echo "copilot"
  exit 0
fi

read_status() {
  PAYLOAD="$payload" python3 - <<'PY'
import json
import math
import os
import sys

def token_count(value):
    if value is None:
        return "?"
    try:
        value = float(value)
    except Exception:
        return "?"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}m"
    if value >= 1_000:
        return f"{value / 1_000:.1f}k"
    return str(int(value))

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

def gauge(percent):
    if percent is None:
        return ".........."
    try:
        p = max(0.0, min(100.0, float(percent)))
    except Exception:
        return ".........."
    filled = int(math.floor(p / 10))
    return ("#" * filled) + ("." * (10 - filled))

def as_number(value):
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None

def first_number(*values):
    for value in values:
        number = as_number(value)
        if number is not None:
            return number
    return None

def first_text(*values):
    for value in values:
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return ""

raw = os.environ.get("PAYLOAD", "")
try:
    data = json.loads(raw)
except Exception:
    print("cwd\t.")
    print("context\t?/ ?")
    print("gauge\t..........")
    print("duration\t00:00:00")
    print("changes\t")
    print("agent\t")
    print("quota\t")
    print("remaining\t")
    print("remaining_requests\t")
    raise SystemExit(0)

context = data.get("context_window", {}) if isinstance(data.get("context_window", {}), dict) else {}
cost = data.get("cost", {}) if isinstance(data.get("cost", {}), dict) else {}
quota = data.get("quota", {}) if isinstance(data.get("quota", {}), dict) else {}
model = data.get("model", {}) if isinstance(data.get("model", {}), dict) else {}

cwd = data.get("cwd") or "."

current_tokens = context.get("current_context_tokens")
context_limit = context.get("displayed_context_limit")
context_percent = context.get("current_context_used_percentage")
if context_percent is None:
    context_percent = context.get("used_percentage")

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
agent_value = first_text(
    data.get("agent"),
    data.get("agent_name"),
    model.get("display_name"),
    model.get("id"),
)

quota_used_percent = first_number(
    quota.get("used_percentage"),
    quota.get("used_percent"),
    quota.get("usage_percentage"),
    quota.get("usage_percent"),
    data.get("quota_used_percentage"),
    data.get("quota_usage_percentage"),
)

if quota_used_percent is not None:
    quota_value = f"{quota_used_percent:.0f}%"
else:
    quota_used = first_number(quota.get("used"), quota.get("consumed"), data.get("quota_used"))
    quota_limit = first_number(quota.get("limit"), quota.get("total"), data.get("quota_limit"))
    if quota_used is not None and quota_limit not in (None, 0):
        quota_value = f"{token_count(quota_used)}/{token_count(quota_limit)}"
    else:
        quota_value = first_text(data.get("quota"), quota.get("value"), quota.get("label"))
        if not quota_value:
            quota_value = f"{token_count(current_tokens)}/{token_count(context_limit)}"

remaining_percent = first_number(
    quota.get("remaining_percentage"),
    quota.get("remaining_percent"),
    data.get("quota_remaining_percentage"),
    context.get("remaining_percentage"),
)

if remaining_percent is not None:
    remaining_value = f"{remaining_percent:.0f}%"
else:
    remaining_amount = first_number(
        quota.get("remaining"),
        quota.get("remaining_tokens"),
        quota.get("left"),
        data.get("remaining"),
        data.get("quota_remaining"),
    )
    if remaining_amount is not None:
        remaining_value = token_count(remaining_amount)
    else:
        remaining_value = first_text(
            quota.get("remaining_text"),
            data.get("remaining"),
            data.get("quota_remaining"),
        )
        if not remaining_value and current_tokens is not None and context_limit not in (None, 0):
            try:
                remaining_value = token_count(max(0, float(context_limit) - float(current_tokens)))
            except Exception:
                remaining_value = ""

remaining_requests_number = first_number(
    quota.get("remaining_requests"),
    quota.get("requests_remaining"),
    quota.get("remaining_request_count"),
    data.get("remaining_requests"),
    data.get("requests_remaining"),
)
if remaining_requests_number is not None:
    remaining_requests_value = str(int(remaining_requests_number))
else:
    requests_used = first_number(
        cost.get("total_premium_requests"),
        cost.get("premium_requests"),
        data.get("total_premium_requests"),
        data.get("premium_requests"),
    )
    requests_limit = first_number(
        quota.get("request_limit"),
        quota.get("requests_limit"),
        data.get("request_limit"),
        data.get("requests_limit"),
        os.environ.get("COPILOT_STATUS_REQUEST_LIMIT"),
    )
    if requests_limit is not None and requests_used is not None:
        remaining_requests_value = str(max(0, int(requests_limit - requests_used)))
    elif requests_used is not None:
        remaining_requests_value = f"{int(requests_used)} used"
    else:
        remaining_requests_value = ""
if not remaining_requests_value:
    remaining_requests_value = first_text(
        quota.get("remaining_requests"),
        quota.get("requests_remaining"),
        data.get("remaining_requests"),
        data.get("requests_remaining"),
    )

print(f"cwd\t{cwd}")
print(f"context\t{token_count(current_tokens)}/{token_count(context_limit)}")
print(f"gauge\t{gauge(context_percent)}")
print(f"duration\t{duration(cost.get('total_duration_ms'))}")
print(f"changes\t{changes}")
print(f"agent\t{agent_value}")
print(f"quota\t{quota_value}")
print(f"remaining\t{remaining_value}")
print(f"remaining_requests\t{remaining_requests_value}")
PY
}

cwd="."
context="?/ ?"
gauge=".........."
total_duration="00:00:00"
changes=""
agent=""
quota=""
remaining=""
remaining_requests=""

while IFS=$'\t' read -r key value; do
  case "$key" in
    cwd) cwd="$value" ;;
    context) context="$value" ;;
    gauge) gauge="$value" ;;
    duration) total_duration="$value" ;;
    changes) changes="$value" ;;
    agent) agent="$value" ;;
    quota) quota="$value" ;;
    remaining) remaining="$value" ;;
    remaining_requests) remaining_requests="$value" ;;
  esac
done < <(printf '%s' "$payload" | read_status)

# Keep the last known-good payload so transient empty updates don't blank the statusline.
if PAYLOAD="$payload" python3 - <<'PY'
import json
import os
import sys
try:
    json.loads(os.environ.get("PAYLOAD", ""))
except Exception:
    sys.exit(1)
sys.exit(0)
PY
then
  mkdir -p "$cache_dir"
  printf '%s' "$payload" >"$cache_file"
fi

export COPILOT_STATUS_CONTEXT="$context"
export COPILOT_STATUS_GAUGE="$gauge"
export COPILOT_STATUS_DURATION="$total_duration"
export COPILOT_STATUS_CHANGES="$changes"
export COPILOT_STATUS_AGENT="$agent"
export COPILOT_STATUS_QUOTA="$quota"
export COPILOT_STATUS_REMAINING="$remaining"
export COPILOT_STATUS_REMAINING_REQUESTS="$remaining_requests"

home_theme="${COPILOT_HOME:-$HOME/.copilot}/statusline.omp.json"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
local_theme="$script_dir/statusline.omp.json"

if [[ -f "$home_theme" ]]; then
  theme_path="$home_theme"
elif [[ -f "$local_theme" ]]; then
  theme_path="$local_theme"
else
  echo "copilot"
  exit 0
fi

oh-my-posh print primary --config "$theme_path" --pwd "$cwd" 2>/dev/null || echo "copilot"

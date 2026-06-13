#!/bin/sh
# Guard fallback for hook contexts (design §4). When Node is available it runs the
# real bundled Guard. When Node is absent it does a reduced run: execute the loop's
# verifiers and append a minimal, schema-valid RunRecord. Stall/budget/token
# attribution require the Node Guard and are skipped here.

# --- prefer the real Node Guard ---
if command -v node >/dev/null 2>&1; then
  guard_js="${LOOPMD_GUARD_JS:-$(dirname "$0")/guard.js}"
  if [ -f "$guard_js" ]; then
    exec node "$guard_js" "$@"
  fi
fi

# --- reduced fallback (no Node) ---
loop=""
cwd="$(pwd)"
while [ $# -gt 0 ]; do
  case "$1" in
    --loop) loop="$2"; shift 2 ;;
    --cwd) cwd="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$loop" ]; then
  echo "guard(sh): --loop <name> is required" >&2
  exit 2
fi

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

verifiers_json=""
all_pass=1
vfile="$cwd/loopmd/$loop.verifiers"
if [ -f "$vfile" ]; then
  while IFS= read -r cmd || [ -n "$cmd" ]; do
    [ -z "$cmd" ] && continue
    if ( cd "$cwd" && sh -c "$cmd" >/dev/null 2>&1 ); then
      passed=true
    else
      passed=false
      all_pass=0
    fi
    entry="{\"name\":\"$(json_escape "$cmd")\",\"passed\":$passed,\"durationMs\":0}"
    if [ -z "$verifiers_json" ]; then verifiers_json="$entry"; else verifiers_json="$verifiers_json,$entry"; fi
  done < "$vfile"
fi

if [ "$all_pass" -eq 1 ]; then outcome="done"; code=0; else outcome="failed"; code=1; fi

records_dir="${LOOPMD_HOME:-$HOME/.loopmd}/records"
mkdir -p "$records_dir"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
runid="sh-$(date +%s)-$$"
printf '{"loop":"%s","runId":"%s","target":"claude-code","startedAt":"%s","endedAt":"%s","iterations":1,"tokens":{"input":0,"output":0,"total":0},"outcome":"%s","verifiers":[%s],"diffsTouched":[],"irreversibleActions":[],"needsHuman":false}\n' \
  "$loop" "$runid" "$ts" "$ts" "$outcome" "$verifiers_json" >> "$records_dir/$loop.jsonl"

echo "guard(sh): $outcome"
exit $code

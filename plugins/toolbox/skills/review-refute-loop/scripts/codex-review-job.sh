#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  codex-review-job.sh start <prompt-file> [cwd]
  codex-review-job.sh status <job-id> [cwd]
  codex-review-job.sh result <job-id> <output-file> [cwd]
  codex-review-job.sh cancel <job-id> [cwd]
USAGE
  exit 2
}

for required_command in node jq find stat git shasum awk; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "$required_command is required" >&2
    exit 2
  }
done

review_timeout_seconds="${CODEX_REVIEW_TIMEOUT_SECONDS:-600}"
[[ "$review_timeout_seconds" =~ ^[0-9]+$ ]] || {
  echo "CODEX_REVIEW_TIMEOUT_SECONDS must be a non-negative integer" >&2
  exit 2
}
review_timeout_seconds="$((10#$review_timeout_seconds))"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
output_validator="$script_dir/validate-review-output.sh"
[[ -x "$output_validator" ]] || { echo "review output validator is missing or not executable: $output_validator" >&2; exit 2; }

resolve_companion() {
  local companion
  companion="$(find "$HOME/.claude/plugins/cache/openai-codex/codex" -mindepth 3 -maxdepth 3 \
    -path '*/scripts/codex-companion.mjs' -print 2>/dev/null | sort -V | tail -1)"
  if [[ -z "$companion" || ! -f "$companion" ]]; then
    echo "codex companion not installed" >&2
    exit 2
  fi
  printf '%s\n' "$companion"
}

absolute_file() {
  local input="$1"
  local dir base
  dir="$(cd "$(dirname "$input")" && pwd -P)"
  base="$(basename "$input")"
  printf '%s/%s\n' "$dir" "$base"
}

file_mtime() {
  local file="$1"
  if stat -f '%m' "$file" >/dev/null 2>&1; then
    stat -f '%m' "$file"
  else
    stat -c '%Y' "$file"
  fi
}

iso_to_epoch() {
  local iso="$1"
  local normalized
  normalized="${iso%%.*}"
  normalized="${normalized%Z}"

  if date -j -u -f '%Y-%m-%dT%H:%M:%S' "$normalized" '+%s' >/dev/null 2>&1; then
    date -j -u -f '%Y-%m-%dT%H:%M:%S' "$normalized" '+%s'
  elif date -u -d "$iso" '+%s' >/dev/null 2>&1; then
    date -u -d "$iso" '+%s'
  else
    return 1
  fi
}

canonical_workspace_root() {
  local cwd="$1"
  local root
  if root="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"; then
    (cd "$root" && pwd -P)
  else
    (cd "$cwd" && pwd -P)
  fi
}

workspace_lock_dir() {
  local cwd="$1"
  local root digest lock_root
  root="$(canonical_workspace_root "$cwd")"
  digest="$(printf '%s' "$root" | shasum -a 256 | awk '{print $1}')"
  lock_root="${TMPDIR:-/tmp}/codex-review-job-locks"
  mkdir -p "$lock_root"
  printf '%s/%s.lock\n' "$lock_root" "$digest"
}

write_lock_metadata() {
  local lock_dir="$1"
  local cwd="$2"
  local job_id="$3"
  local process_group_id="${4:-}"
  local tmp_file
  tmp_file="$lock_dir/metadata.json.tmp.$$"
  jq -n \
    --arg cwd "$(canonical_workspace_root "$cwd")" \
    --arg job_id "$job_id" \
    --arg process_group_id "$process_group_id" \
    --argjson owner_pid "$$" \
    --argjson acquired_at "$(date +%s)" \
    '{cwd:$cwd,job_id:$job_id,process_group_id:$process_group_id,owner_pid:$owner_pid,acquired_at:$acquired_at}' > "$tmp_file"
  mv "$tmp_file" "$lock_dir/metadata.json"
}

release_workspace_lock() {
  local cwd="$1"
  local expected_job_id="${2:-}"
  local lock_dir metadata_job_id=""
  lock_dir="$(workspace_lock_dir "$cwd")"
  [[ -d "$lock_dir" ]] || return 0

  if [[ -f "$lock_dir/metadata.json" ]]; then
    metadata_job_id="$(jq -r '.job_id // ""' "$lock_dir/metadata.json" 2>/dev/null || true)"
  fi
  if [[ -n "$expected_job_id" && -n "$metadata_job_id" && "$metadata_job_id" != "$expected_job_id" ]]; then
    return 0
  fi
  rm -f "$lock_dir/metadata.json" "$lock_dir"/metadata.json.tmp.*
  rmdir "$lock_dir" 2>/dev/null || true
}

acquire_workspace_lock() {
  local cwd="$1"
  local lock_dir metadata_job_id="" process_group_id="" owner_pid="" snapshot existing_status="" age now mtime
  lock_dir="$(workspace_lock_dir "$cwd")"

  if mkdir "$lock_dir" 2>/dev/null; then
    write_lock_metadata "$lock_dir" "$cwd" ""
    printf '%s\n' "$lock_dir"
    return 0
  fi

  if [[ -f "$lock_dir/metadata.json" ]]; then
    metadata_job_id="$(jq -r '.job_id // ""' "$lock_dir/metadata.json" 2>/dev/null || true)"
    process_group_id="$(jq -r '.process_group_id // ""' "$lock_dir/metadata.json" 2>/dev/null || true)"
    owner_pid="$(jq -r '.owner_pid // ""' "$lock_dir/metadata.json" 2>/dev/null || true)"
  fi

  if [[ -n "$metadata_job_id" ]]; then
    if snapshot="$(cd "$cwd" && node "$companion" status "$metadata_job_id" --json 2>/dev/null)"; then
      existing_status="$(printf '%s' "$snapshot" | jq -r '.job.status // "unknown"')"
      case "$existing_status" in
        queued|running)
          echo "another Codex review job is active in this workspace: $metadata_job_id" >&2
          return 1
          ;;
        completed)
          echo "completed Codex review job is awaiting result recovery: $metadata_job_id" >&2
          return 1
          ;;
        failed|cancelled)
          if [[ "$process_group_id" =~ ^[0-9]+$ ]] && ! process_group_is_alive "$process_group_id"; then
            release_workspace_lock "$cwd" "$metadata_job_id"
          else
            echo "terminal Codex job process group is not verified as stopped; refusing to steal its workspace lock: $metadata_job_id" >&2
            return 1
          fi
          ;;
        *)
          echo "existing Codex review job has an unknown status; refusing to steal its workspace lock: $metadata_job_id ($existing_status)" >&2
          return 1
          ;;
      esac
    else
      echo "cannot verify existing Codex review job; refusing to steal its workspace lock: $metadata_job_id" >&2
      return 1
    fi
  elif [[ -n "$owner_pid" ]] && kill -0 "$owner_pid" 2>/dev/null; then
    echo "another Codex review job is being launched in this workspace" >&2
    return 1
  else
    now="$(date +%s)"
    mtime="$(file_mtime "$lock_dir" 2>/dev/null || printf '%s' "$now")"
    age="$((now - mtime))"
    if (( age < 60 )); then
      echo "Codex review workspace lock is initializing; retry status shortly" >&2
      return 1
    fi
    release_workspace_lock "$cwd"
  fi

  if ! mkdir "$lock_dir" 2>/dev/null; then
    echo "failed to acquire Codex review workspace lock" >&2
    return 1
  fi
  write_lock_metadata "$lock_dir" "$cwd" ""
  printf '%s\n' "$lock_dir"
}

process_group_is_alive() {
  local process_group_id="$1"
  [[ "$process_group_id" =~ ^[0-9]+$ ]] || return 1
  kill -0 -- "-$process_group_id" 2>/dev/null
}

ensure_process_group_stopped() {
  local process_group_id="$1"
  [[ "$process_group_id" =~ ^[0-9]+$ ]] || return 1

  sleep 1
  if process_group_is_alive "$process_group_id"; then
    kill -KILL -- "-$process_group_id" 2>/dev/null || true
    sleep 1
  fi
  ! process_group_is_alive "$process_group_id"
}

latest_rollout_for_thread() {
  local thread_id="$1"
  local candidate candidate_mtime latest="" latest_mtime=-1

  while IFS= read -r -d '' candidate; do
    candidate_mtime="$(file_mtime "$candidate" 2>/dev/null || printf '0')"
    if (( candidate_mtime > latest_mtime )); then
      latest="$candidate"
      latest_mtime="$candidate_mtime"
    fi
  done < <(find "$HOME/.codex/sessions" -type f -name "*${thread_id}*.jsonl" -print0 2>/dev/null)

  printf '%s\n' "$latest"
}

review_output_is_valid() {
  local output_file="$1"
  "$output_validator" "$output_file"
}

command="${1:-}"
[[ -n "$command" ]] || usage
shift

companion="$(resolve_companion)"

case "$command" in
  start)
    [[ $# -ge 1 && $# -le 2 ]] || usage
    prompt_file="$(absolute_file "$1")"
    cwd="${2:-$PWD}"
    cwd="$(cd "$cwd" && pwd -P)"
    [[ -s "$prompt_file" ]] || { echo "prompt file is missing or empty: $prompt_file" >&2; exit 2; }

    lock_dir="$(acquire_workspace_lock "$cwd")" || exit 1
    trap 'release_workspace_lock "$cwd"' EXIT

    workspace_snapshot="$(cd "$cwd" && node "$companion" status --json)"
    running_count="$(printf '%s' "$workspace_snapshot" | jq '.running | length')"
    if (( running_count > 0 )); then
      echo "another companion job is already active in this workspace" >&2
      exit 1
    fi

    launch_output="$(cd "$cwd" && node "$companion" task --background --write --fresh --json \
      --prompt-file "$prompt_file" < /dev/null)"
    job_id="$(printf '%s' "$launch_output" | jq -r '.jobId // empty')"
    [[ -n "$job_id" ]] || { printf '%s\n' "$launch_output" >&2; echo "failed to parse Codex job id" >&2; exit 1; }
    launched_process_group=""
    if launched_snapshot="$(cd "$cwd" && node "$companion" status "$job_id" --json 2>/dev/null)"; then
      launched_process_group="$(printf '%s' "$launched_snapshot" | jq -r '.job.pid // empty')"
    fi
    write_lock_metadata "$lock_dir" "$cwd" "$job_id" "$launched_process_group"
    trap - EXIT
    printf '%s\n' "$job_id"
    ;;

  status)
    [[ $# -ge 1 && $# -le 2 ]] || usage
    job_id="$1"
    cwd="${2:-$PWD}"
    snapshot="$(cd "$cwd" && node "$companion" status "$job_id" --json)"

    job_status="$(printf '%s' "$snapshot" | jq -r '.job.status // "unknown"')"
    phase="$(printf '%s' "$snapshot" | jq -r '.job.phase // "unknown"')"
    pid="$(printf '%s' "$snapshot" | jq -r '.job.pid // empty')"
    log_file="$(printf '%s' "$snapshot" | jq -r '.job.logFile // empty')"
    thread_id="$(printf '%s' "$snapshot" | jq -r '.job.threadId // empty')"
    created_at="$(printf '%s' "$snapshot" | jq -r '.job.createdAt // empty')"

    runtime_age_seconds=null
    if [[ -n "$created_at" ]]; then
      if created_epoch="$(iso_to_epoch "$created_at")"; then
        now="$(date +%s)"
        runtime_age_seconds="$((now - created_epoch))"
        if (( runtime_age_seconds < 0 )); then
          runtime_age_seconds=0
        fi
      fi
    fi

    pid_alive=false
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      pid_alive=true
    fi

    log_age_seconds=null
    if [[ -n "$log_file" && -f "$log_file" ]]; then
      now="$(date +%s)"
      mtime="$(file_mtime "$log_file")"
      log_age_seconds="$((now - mtime))"
    fi

    rollout=""
    rollout_age_seconds=null
    terminal_event=""
    turn_aborted=null
    rollout_parse_ok=null
    if [[ -n "$thread_id" ]]; then
      rollout="$(latest_rollout_for_thread "$thread_id")"
      if [[ -n "$rollout" && -f "$rollout" ]]; then
        now="$(date +%s)"
        mtime="$(file_mtime "$rollout")"
        rollout_age_seconds="$((now - mtime))"

        set +e
        terminal_event="$(jq -rs '[.[] | select(.type == "event_msg" and (.payload.type == "turn_aborted" or .payload.type == "task_complete")) | .payload.type] | last // ""' "$rollout" 2>/dev/null)"
        jq_status=$?
        set -e
        if [[ $jq_status -eq 0 ]]; then
          rollout_parse_ok=true
          if [[ "$terminal_event" == "turn_aborted" ]]; then
            turn_aborted=true
          else
            turn_aborted=false
          fi
        else
          rollout_parse_ok=false
        fi
      fi
    fi

    activity_age_seconds=null
    if [[ "$log_age_seconds" != "null" && "$rollout_age_seconds" != "null" ]]; then
      if (( log_age_seconds < rollout_age_seconds )); then
        activity_age_seconds="$log_age_seconds"
      else
        activity_age_seconds="$rollout_age_seconds"
      fi
    elif [[ "$log_age_seconds" != "null" ]]; then
      activity_age_seconds="$log_age_seconds"
    elif [[ "$rollout_age_seconds" != "null" ]]; then
      activity_age_seconds="$rollout_age_seconds"
    fi

    case "$job_status" in
      completed)
        verdict="done"
        ;;
      failed|cancelled)
        verdict="failed"
        ;;
      queued|running)
        if [[ "$runtime_age_seconds" == "null" ]]; then
          verdict="unknown"
        elif (( runtime_age_seconds >= review_timeout_seconds )); then
          verdict="timed_out"
        elif [[ "$turn_aborted" == "true" || "$pid_alive" == "false" ]]; then
          verdict="stuck"
        elif [[ "$rollout_parse_ok" == "false" || "$activity_age_seconds" == "null" ]]; then
          verdict="unknown"
        elif (( activity_age_seconds >= 300 )); then
          verdict="stuck"
        else
          verdict="healthy"
        fi
        ;;
      *)
        verdict="unknown"
        ;;
    esac

    jq -n \
      --arg job_id "$job_id" \
      --arg status "$job_status" \
      --arg phase "$phase" \
      --arg verdict "$verdict" \
      --arg thread_id "$thread_id" \
      --arg log_file "$log_file" \
      --arg rollout_file "$rollout" \
      --arg terminal_event "$terminal_event" \
      --argjson review_timeout_seconds "$review_timeout_seconds" \
      --argjson runtime_age_seconds "$runtime_age_seconds" \
      --argjson pid_alive "$pid_alive" \
      --argjson log_age_seconds "$log_age_seconds" \
      --argjson rollout_age_seconds "$rollout_age_seconds" \
      --argjson activity_age_seconds "$activity_age_seconds" \
      --argjson turn_aborted "$turn_aborted" \
      --argjson rollout_parse_ok "$rollout_parse_ok" \
      '{job_id:$job_id,status:$status,phase:$phase,verdict:$verdict,review_timeout_seconds:$review_timeout_seconds,runtime_age_seconds:$runtime_age_seconds,pid_alive:$pid_alive,activity_age_seconds:$activity_age_seconds,log_age_seconds:$log_age_seconds,rollout_age_seconds:$rollout_age_seconds,turn_aborted:$turn_aborted,rollout_parse_ok:$rollout_parse_ok,terminal_event:$terminal_event,thread_id:$thread_id,log_file:$log_file,rollout_file:$rollout_file}'
    ;;

  result)
    [[ $# -ge 2 && $# -le 3 ]] || usage
    job_id="$1"
    output_file="$2"
    cwd="${3:-$PWD}"
    output_dir="$(dirname "$output_file")"
    mkdir -p "$output_dir"
    output_dir="$(cd "$output_dir" && pwd -P)"
    output_file="$output_dir/$(basename "$output_file")"

    snapshot="$(cd "$cwd" && node "$companion" status "$job_id" --json)"
    job_status="$(printf '%s' "$snapshot" | jq -r '.job.status // "unknown"')"
    case "$job_status" in
      completed)
        ;;
      failed|cancelled)
        terminal_lock_dir="$(workspace_lock_dir "$cwd")"
        terminal_process_group=""
        if [[ -f "$terminal_lock_dir/metadata.json" ]]; then
          terminal_process_group="$(jq -r '.process_group_id // empty' "$terminal_lock_dir/metadata.json" 2>/dev/null || true)"
        fi
        if [[ "$terminal_process_group" =~ ^[0-9]+$ ]] && ! process_group_is_alive "$terminal_process_group"; then
          release_workspace_lock "$cwd" "$job_id"
        else
          echo "terminal job process group is not verified as stopped; keeping workspace lock: $job_id" >&2
        fi
        echo "job terminated without a recoverable result: $job_id ($job_status)" >&2
        exit 1
        ;;
      *)
        # Keep the lock: queued/running/unknown jobs may still need recovery.
        echo "job is not completed: $job_id ($job_status)" >&2
        exit 1
        ;;
    esac

    tmp_file=""
    cleanup_result() {
      [[ -z "$tmp_file" ]] || rm -f "$tmp_file"
      release_workspace_lock "$cwd" "$job_id"
    }
    trap cleanup_result EXIT

    tmp_file="$(mktemp "${output_file}.tmp.XXXXXX")"
    (cd "$cwd" && node "$companion" result "$job_id") > "$tmp_file"
    if ! review_output_is_valid "$tmp_file"; then
      invalid_file="${output_file}.invalid.md"
      mv "$tmp_file" "$invalid_file"
      tmp_file=""
      echo "Invalid result preserved at: $invalid_file" >&2
      echo "Codex result does not satisfy the review output contract: $job_id" >&2
      exit 1
    fi
    mv "$tmp_file" "$output_file"
    tmp_file=""
    printf '%s\n' "$output_file"
    ;;

  cancel)
    [[ $# -ge 1 && $# -le 2 ]] || usage
    job_id="$1"
    cwd="${2:-$PWD}"
    cd "$cwd"

    # companion marks a job cancelled after sending SIGTERM without waiting.
    # Preserve the detached worker's process-group id before that metadata is
    # cleared so the runner can verify termination independently.
    set +e
    pre_cancel_snapshot="$(node "$companion" status "$job_id" --json 2>/dev/null)"
    pre_cancel_status=$?
    set -e
    cancel_process_group=""
    if [[ $pre_cancel_status -eq 0 ]]; then
      cancel_process_group="$(printf '%s' "$pre_cancel_snapshot" | jq -r '.job.pid // empty')"
    fi
    if [[ ! "$cancel_process_group" =~ ^[0-9]+$ ]]; then
      cancel_lock_dir="$(workspace_lock_dir "$cwd")"
      if [[ -f "$cancel_lock_dir/metadata.json" ]]; then
        cancel_process_group="$(jq -r '.process_group_id // empty' "$cancel_lock_dir/metadata.json" 2>/dev/null || true)"
      fi
    fi

    set +e
    node "$companion" cancel "$job_id"
    cancel_status=$?
    set -e
    if [[ $cancel_status -eq 0 ]]; then
      if ! ensure_process_group_stopped "$cancel_process_group"; then
        echo "cancel returned success but the Codex process group could not be verified as stopped; keeping workspace lock: $job_id" >&2
        exit 1
      fi
      release_workspace_lock "$cwd" "$job_id"
      exit 0
    fi

    # A terminal job is not cancelable. Release only its matching lock; keep
    # the lock when status is unknown or the job may still be active.
    set +e
    snapshot="$(node "$companion" status "$job_id" --json 2>/dev/null)"
    status_status=$?
    set -e
    if [[ $status_status -eq 0 ]]; then
      job_status="$(printf '%s' "$snapshot" | jq -r '.job.status // "unknown"')"
      case "$job_status" in
        completed)
          echo "job completed before cancellation; recover it with result: $job_id" >&2
          exit 3
          ;;
        failed|cancelled)
          if ensure_process_group_stopped "$cancel_process_group"; then
            release_workspace_lock "$cwd" "$job_id"
          else
            echo "terminal job process group could not be verified as stopped; keeping workspace lock: $job_id" >&2
          fi
          ;;
      esac
    fi
    exit "$cancel_status"
    ;;

  *)
    usage
    ;;
esac

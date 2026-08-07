#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  claude-review-job.sh start <prompt-file> <output-file> [cwd]
  claude-review-job.sh status <job-id>
  claude-review-job.sh result <job-id>
  claude-review-job.sh cancel <job-id>
USAGE
  exit 2
}

for required_command in claude node jq pgrep stat ps; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "$required_command is required" >&2
    exit 2
  }
done

review_timeout_seconds="${CLAUDE_REVIEW_TIMEOUT_SECONDS:-600}"
[[ "$review_timeout_seconds" =~ ^[0-9]+$ ]] || {
  echo "CLAUDE_REVIEW_TIMEOUT_SECONDS must be a non-negative integer" >&2
  exit 2
}
review_timeout_seconds="$((10#$review_timeout_seconds))"

state_root="${TMPDIR:-/tmp}/claude-review-jobs"
mkdir -p "$state_root"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
output_validator="$script_dir/validate-review-output.sh"
[[ -x "$output_validator" ]] || { echo "review output validator is missing or not executable: $output_validator" >&2; exit 2; }

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

review_output_is_valid() {
  local output_file="$1"
  "$output_validator" "$output_file"
}

job_dir_for() {
  printf '%s/%s\n' "$state_root" "$1"
}

read_metadata() {
  local job_id="$1"
  local metadata_file
  metadata_file="$(job_dir_for "$job_id")/metadata.json"
  [[ -f "$metadata_file" ]] || { echo "Claude review job not found: $job_id" >&2; return 1; }
  printf '%s\n' "$metadata_file"
}

pid_is_alive() {
  local pid="$1"
  local state
  kill -0 "$pid" 2>/dev/null || return 1
  state="$(ps -p "$pid" -o state= 2>/dev/null | tr -d '[:space:]')"
  [[ "$state" != Z* ]]
}

collect_tree_pids() {
  local pid="$1"
  local child
  while IFS= read -r child; do
    [[ -n "$child" ]] || continue
    collect_tree_pids "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  printf '%s\n' "$pid"
}

signal_process_list() {
  local signal="$1"
  local process_list="$2"
  local process_pid
  while IFS= read -r process_pid; do
    [[ -n "$process_pid" ]] || continue
    kill "-$signal" "$process_pid" 2>/dev/null || true
  done <<< "$process_list"
}

process_list_has_live_process() {
  local process_list="$1"
  local process_pid
  while IFS= read -r process_pid; do
    [[ -n "$process_pid" ]] || continue
    if pid_is_alive "$process_pid"; then
      return 0
    fi
  done <<< "$process_list"
  return 1
}

command="${1:-}"
[[ -n "$command" ]] || usage
shift

case "$command" in
  start)
    [[ $# -ge 2 && $# -le 3 ]] || usage
    prompt_file="$(absolute_file "$1")"
    output_file="$2"
    cwd="${3:-$PWD}"
    cwd="$(cd "$cwd" && pwd -P)"
    [[ -s "$prompt_file" ]] || { echo "prompt file is missing or empty: $prompt_file" >&2; exit 2; }

    output_dir="$(dirname "$output_file")"
    mkdir -p "$output_dir"
    output_dir="$(cd "$output_dir" && pwd -P)"
    output_file="$output_dir/$(basename "$output_file")"

    job_id="claude-$(date +%s)-$$-${RANDOM}"
    job_dir="$(job_dir_for "$job_id")"
    mkdir "$job_dir"
    raw_file="$job_dir/raw-output.md"
    error_file="$job_dir/stderr.log"
    exit_file="$job_dir/exit-code"
    cancelled_file="$job_dir/cancelled"
    claude_bin="$(command -v claude)"

    worker_script="$script_dir/claude-review-worker.mjs"
    [[ -f "$worker_script" ]] || { echo "Claude review worker is missing: $worker_script" >&2; exit 2; }
    worker_pid="$(node "$worker_script" launch "$claude_bin" "$prompt_file" "$raw_file" "$error_file" "$exit_file" "$cwd")"
    [[ "$worker_pid" =~ ^[0-9]+$ ]] || { echo "failed to parse Claude worker pid" >&2; exit 1; }

    jq -n \
      --arg job_id "$job_id" \
      --arg prompt_file "$prompt_file" \
      --arg output_file "$output_file" \
      --arg raw_file "$raw_file" \
      --arg error_file "$error_file" \
      --arg exit_file "$exit_file" \
      --arg cancelled_file "$cancelled_file" \
      --arg cwd "$cwd" \
      --argjson pid "$worker_pid" \
      --argjson created_epoch "$(date +%s)" \
      '{job_id:$job_id,prompt_file:$prompt_file,output_file:$output_file,raw_file:$raw_file,error_file:$error_file,exit_file:$exit_file,cancelled_file:$cancelled_file,cwd:$cwd,pid:$pid,created_epoch:$created_epoch}' \
      > "$job_dir/metadata.json"
    printf '%s\n' "$job_id"
    ;;

  status)
    [[ $# -eq 1 ]] || usage
    job_id="$1"
    metadata_file="$(read_metadata "$job_id")"
    pid="$(jq -r '.pid' "$metadata_file")"
    created_epoch="$(jq -r '.created_epoch' "$metadata_file")"
    raw_file="$(jq -r '.raw_file' "$metadata_file")"
    error_file="$(jq -r '.error_file' "$metadata_file")"
    exit_file="$(jq -r '.exit_file' "$metadata_file")"
    cancelled_file="$(jq -r '.cancelled_file' "$metadata_file")"
    output_file="$(jq -r '.output_file' "$metadata_file")"
    runtime_age_seconds="$(($(date +%s) - created_epoch))"
    (( runtime_age_seconds >= 0 )) || runtime_age_seconds=0

    pid_alive=false
    if pid_is_alive "$pid"; then
      pid_alive=true
    fi
    exit_code=null
    if [[ -f "$exit_file" ]]; then
      exit_code="$(tr -dc '0-9' < "$exit_file")"
      [[ -n "$exit_code" ]] || exit_code=1
    fi

    output_age_seconds=null
    if [[ -f "$raw_file" ]]; then
      output_age_seconds="$(($(date +%s) - $(file_mtime "$raw_file")))"
    fi

    if [[ -f "$cancelled_file" ]]; then
      verdict="failed"
    elif [[ "$exit_code" != "null" ]]; then
      if [[ "$exit_code" == "0" ]] && review_output_is_valid "$raw_file"; then
        verdict="done"
      else
        verdict="failed"
      fi
    elif (( runtime_age_seconds >= review_timeout_seconds )); then
      verdict="timed_out"
    elif [[ "$pid_alive" == "true" ]]; then
      verdict="healthy"
    else
      verdict="stuck"
    fi

    jq -n \
      --arg job_id "$job_id" \
      --arg verdict "$verdict" \
      --arg output_file "$output_file" \
      --arg raw_file "$raw_file" \
      --arg error_file "$error_file" \
      --argjson pid_alive "$pid_alive" \
      --argjson exit_code "$exit_code" \
      --argjson review_timeout_seconds "$review_timeout_seconds" \
      --argjson runtime_age_seconds "$runtime_age_seconds" \
      --argjson output_age_seconds "$output_age_seconds" \
      '{job_id:$job_id,verdict:$verdict,review_timeout_seconds:$review_timeout_seconds,runtime_age_seconds:$runtime_age_seconds,pid_alive:$pid_alive,exit_code:$exit_code,output_age_seconds:$output_age_seconds,output_file:$output_file,raw_file:$raw_file,error_file:$error_file}'
    ;;

  result)
    [[ $# -eq 1 ]] || usage
    job_id="$1"
    metadata_file="$(read_metadata "$job_id")"
    raw_file="$(jq -r '.raw_file' "$metadata_file")"
    output_file="$(jq -r '.output_file' "$metadata_file")"
    exit_file="$(jq -r '.exit_file' "$metadata_file")"
    [[ -f "$exit_file" && "$(tr -dc '0-9' < "$exit_file")" == "0" ]] || {
      echo "Claude review job is not successfully completed: $job_id" >&2
      exit 1
    }
    review_output_is_valid "$raw_file" || {
      echo "Claude result does not satisfy the review output contract: $job_id" >&2
      exit 1
    }
    tmp_file="$(mktemp "${output_file}.tmp.XXXXXX")"
    trap 'rm -f "$tmp_file"' EXIT
    cp "$raw_file" "$tmp_file"
    mv "$tmp_file" "$output_file"
    trap - EXIT
    printf '%s\n' "$output_file"
    ;;

  cancel)
    [[ $# -eq 1 ]] || usage
    job_id="$1"
    metadata_file="$(read_metadata "$job_id")"
    pid="$(jq -r '.pid' "$metadata_file")"
    cancelled_file="$(jq -r '.cancelled_file' "$metadata_file")"
    process_tree="$(collect_tree_pids "$pid")"
    signal_process_list TERM "$process_tree"
    sleep 1
    if process_list_has_live_process "$process_tree"; then
      signal_process_list KILL "$process_tree"
      sleep 1
    fi
    if process_list_has_live_process "$process_tree"; then
      echo "failed to terminate the complete Claude review process tree: $job_id" >&2
      exit 1
    fi
    printf '%s\n' "$(date +%s)" > "$cancelled_file"
    printf 'Cancelled %s.\n' "$job_id"
    ;;

  *)
    usage
    ;;
esac

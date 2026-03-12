#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log_info() {
  echo "[INFO] $*"
}

log_warn() {
  echo "[WARN] $*"
}

log_error() {
  echo "[ERROR] $*" >&2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command not found: $1"
    exit 1
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    log_error "Required file not found: $1"
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    log_error "Required environment variable is missing: $name"
    exit 1
  fi
}

load_env_file() {
  local env_file="$1"
  require_file "$env_file"
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

ensure_docker_compose() {
  require_command docker
  require_command curl
  require_command sed
  if ! docker compose version >/dev/null 2>&1; then
    log_error "docker compose is not available"
    exit 1
  fi
}

compose_ec2() {
  local node_dir="$1"
  shift
  (
    cd "$node_dir"
    docker compose -f docker-compose.yml -f compose.ec2.yml "$@"
  )
}

update_env_var() {
  local env_file="$1"
  local key="$2"
  local value="$3"

  require_file "$env_file"

  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}

extract_image_tag() {
  local image="$1"
  echo "$image" | awk -F: '{print $NF}'
}

verify_http_health() {
  local url="$1"
  local max_attempts="${2:-10}"
  local sleep_seconds="${3:-5}"

  log_info "Checking health endpoint: ${url}"

  for attempt in $(seq 1 "$max_attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log_info "Health check passed on attempt ${attempt}/${max_attempts}"
      return 0
    fi
    log_warn "Health check failed on attempt ${attempt}/${max_attempts}"
    sleep "$sleep_seconds"
  done

  log_error "Health check failed after ${max_attempts} attempts: ${url}"
  return 1
}

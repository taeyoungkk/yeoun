#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/common.sh"

PREVIOUS_TAG="${1:-}"
if [ -z "$PREVIOUS_TAG" ]; then
  log_error "Usage: $0 <previous-worker-image-tag>"
  exit 1
fi

NODE_DIR="${INFRA_ROOT}/docker/node2"
ENV_FILE="${NODE_DIR}/.env"

ensure_docker_compose
load_env_file "$ENV_FILE"

CURRENT_IMAGE_REPO="${WORKER_IMAGE%%:*}"
if [ "$CURRENT_IMAGE_REPO" = "$WORKER_IMAGE" ]; then
  CURRENT_IMAGE_REPO="$WORKER_IMAGE"
fi
NEW_IMAGE="${CURRENT_IMAGE_REPO}:${PREVIOUS_TAG}"

log_warn "Rolling back node2 to ${NEW_IMAGE}"
update_env_var "$ENV_FILE" "WORKER_IMAGE" "$NEW_IMAGE"
load_env_file "$ENV_FILE"
compose_ec2 "$NODE_DIR" pull worker nginx
compose_ec2 "$NODE_DIR" up -d worker nginx
compose_ec2 "$NODE_DIR" ps

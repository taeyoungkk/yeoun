#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/common.sh"

PREVIOUS_TAG="${1:-}"
if [ -z "$PREVIOUS_TAG" ]; then
  log_error "Usage: $0 <previous-api-image-tag>"
  exit 1
fi

NODE_DIR="${INFRA_ROOT}/docker/node1"
ENV_FILE="${NODE_DIR}/.env"

ensure_docker_compose
load_env_file "$ENV_FILE"

CURRENT_IMAGE_REPO="${API_IMAGE%%:*}"
if [ "$CURRENT_IMAGE_REPO" = "$API_IMAGE" ]; then
  CURRENT_IMAGE_REPO="$API_IMAGE"
fi
NEW_IMAGE="${CURRENT_IMAGE_REPO}:${PREVIOUS_TAG}"

log_warn "Rolling back node1 to ${NEW_IMAGE}"
update_env_var "$ENV_FILE" "API_IMAGE" "$NEW_IMAGE"
load_env_file "$ENV_FILE"
compose_ec2 "$NODE_DIR" pull api nginx
compose_ec2 "$NODE_DIR" up -d api nginx
compose_ec2 "$NODE_DIR" ps

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/common.sh"

NODE_DIR="${INFRA_ROOT}/docker/node2"
ENV_FILE="${NODE_DIR}/.env"

ensure_docker_compose
load_env_file "$ENV_FILE"
require_var WORKER_IMAGE

HEALTHCHECK_URL="${NODE2_HEALTHCHECK_URL:-http://localhost/}"

log_info "Deploying node2 with worker image: ${WORKER_IMAGE}"
compose_ec2 "$NODE_DIR" pull worker nginx
compose_ec2 "$NODE_DIR" up -d worker nginx
verify_http_health "$HEALTHCHECK_URL"
compose_ec2 "$NODE_DIR" ps

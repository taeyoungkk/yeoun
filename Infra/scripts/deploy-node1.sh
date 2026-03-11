#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/common.sh"

NODE_DIR="${INFRA_ROOT}/docker/node1"
ENV_FILE="${NODE_DIR}/.env"

ensure_docker_compose
load_env_file "$ENV_FILE"
require_var API_IMAGE

HEALTHCHECK_URL="${NODE1_HEALTHCHECK_URL:-http://localhost/actuator/health}"

log_info "Deploying node1 with API image: ${API_IMAGE}"
compose_ec2 "$NODE_DIR" pull api nginx
compose_ec2 "$NODE_DIR" up -d api nginx
verify_http_health "$HEALTHCHECK_URL"
compose_ec2 "$NODE_DIR" ps

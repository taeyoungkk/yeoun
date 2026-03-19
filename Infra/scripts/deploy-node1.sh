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
compose_ec2 "$NODE_DIR" up -d api

# Nginx DNS 캐싱 초기화 (502/504 강제 다운타임 방지를 위한 무중단 Graceful Reload)
log_info "Gracefully reloading Nginx to update DNS cache and route to the new api container..."
compose_ec2 "$NODE_DIR" exec -T nginx nginx -s reload
verify_http_health "$HEALTHCHECK_URL"
compose_ec2 "$NODE_DIR" ps

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/common.sh"

TARGET_NODE="${1:-}"
if [ -z "$TARGET_NODE" ]; then
  log_error "Usage: $0 <node1|node2>"
  exit 1
fi

ensure_docker_compose

case "$TARGET_NODE" in
  node1)
    NODE_DIR="${INFRA_ROOT}/docker/node1"
    ENV_FILE="${NODE_DIR}/.env"
    require_file "${NODE_DIR}/docker-compose.yml"
    require_file "${NODE_DIR}/compose.ec2.yml"
    require_file "${NODE_DIR}/compose.local.yml"
    require_file "${NODE_DIR}/nginx/default.local.conf"
    require_file "${NODE_DIR}/nginx/default.ec2.conf"
    load_env_file "$ENV_FILE"
    require_var POSTGRES_USER
    require_var POSTGRES_PASSWORD
    require_var POSTGRES_DB
    require_var REDIS_PASSWORD
    require_var API_IMAGE
    ;;
  node2)
    NODE_DIR="${INFRA_ROOT}/docker/node2"
    ENV_FILE="${NODE_DIR}/.env"
    require_file "${NODE_DIR}/docker-compose.yml"
    require_file "${NODE_DIR}/compose.ec2.yml"
    require_file "${NODE_DIR}/compose.local.yml"
    require_file "${NODE_DIR}/nginx/default.local.conf"
    require_file "${NODE_DIR}/nginx/default.ec2.conf"
    load_env_file "$ENV_FILE"
    require_var KAFKA_CLUSTER_ID
    require_var KAFKA_ADVERTISED_HOST
    require_var KAFKA_EXTERNAL_PORT
    require_var WORKER_IMAGE
    ;;
  *)
    log_error "Unknown node: $TARGET_NODE"
    exit 1
    ;;
esac

log_info "Environment check passed for ${TARGET_NODE}"

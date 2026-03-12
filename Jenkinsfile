pipeline {
  agent any

  parameters {
    string(name: 'DOCKERHUB_NAMESPACE', defaultValue: '', description: 'Docker Hub namespace. Leave blank to use Jenkins env var.')
  }

  environment {
    // 하드코딩된 패스워드, IP HOST 등은 보안상 모두 삭제! 
    // Jenkins 웹의 Global Environment Variables 및 Credentials를 참조합니다.
    PROJECT_PATH = '/opt/yeoun'

    // ============================================================
    // [CI - PostgreSQL(PostGIS)/Redis (MR 테스트용)]
    // ============================================================
    CI_REDIS_CONTAINER    = 'ci-redis'
    CI_REDIS_IMAGE        = 'redis:7.4-alpine'
    CI_POSTGRES_CONTAINER = 'ci-postgres'
    CI_POSTGRES_IMAGE     = 'postgis/postgis:17-3.5'
    CI_TEST_LOG           = 'ci_test_backend.log'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout & Detect Context') {
      steps {
        checkout scm
        script {
          def pick = { List<String> keys ->
            for (k in keys) {
              def v = env."${k}"
              if (v != null && v.toString().trim()) return v.toString().trim()
            }
            return ''
          }

          env.EVENT_KIND = pick(['OBJECT_KIND','object_kind','objectKind','X_GITLAB_EVENT','gitlabEventType','event_type']).trim()
          if (env.EVENT_KIND.toLowerCase().contains('merge')) env.EVENT_KIND = 'merge_request'
          if (env.EVENT_KIND.toLowerCase().contains('push'))  env.EVENT_KIND = 'push'

          env.ACTOR = pick([
            'MR_USER_NAME','MR_USER_USERNAME',
            'PUSH_USER_NAME','PUSH_USER_USERNAME',
            'user_name','user_username',
            'GITLAB_USER_NAME','GITLAB_USER_USERNAME',
            'gitlabUserName','gitlabUserUsername'
          ]).trim()
          if (!env.ACTOR) env.ACTOR = 'unknown'

          def refRaw = pick(['REF','ref','GIT_REF','gitRef','refChanges_0_refId'])
          env.PUSH_BRANCH = (refRaw ?: '').replace('refs/heads/', '').trim()
          env.MR_SOURCE = pick(['MR_SOURCE','mr_source','SOURCE_BRANCH','source_branch','sourceBranch','gitlabSourceBranch']).trim()
          env.MR_TARGET = pick(['MR_TARGET','mr_target','TARGET_BRANCH','target_branch','targetBranch','gitlabTargetBranch']).trim()

          env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}"

          def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: env.PUSH_BRANCH ?: sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
          env.IS_DEVELOP = (branchName == 'develop' || branchName.endsWith('/develop')).toString()
          env.DOCKERHUB_NAMESPACE_EFFECTIVE = (params.DOCKERHUB_NAMESPACE?.trim()) ? params.DOCKERHUB_NAMESPACE.trim() : (env.DOCKERHUB_NAMESPACE ?: '').trim()

          def diffOutput = sh(
            script: '''
              if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
                git diff --name-only HEAD~1 HEAD
              else
                git ls-files
              fi
            ''',
            returnStdout: true
          ).trim()

          def changedFiles = diffOutput ? diffOutput.split('\n') as List : []
          env.CHANGED_API = changedFiles.any { it == 'Jenkinsfile' || it.startsWith('Backend/') || it.startsWith('Infra/docker/node1/') || it == 'Infra/scripts/common.sh' || it == 'Infra/scripts/check-env.sh' || it == 'Infra/scripts/deploy-node1.sh' || it == 'Infra/scripts/rollback-node1.sh' }.toString()
          env.CHANGED_WORKER = changedFiles.any { it == 'Jenkinsfile' || it.startsWith('Worker/') || it.startsWith('Infra/docker/node2/') || it == 'Infra/scripts/common.sh' || it == 'Infra/scripts/check-env.sh' || it == 'Infra/scripts/deploy-node2.sh' || it == 'Infra/scripts/rollback-node2.sh' }.toString()

          echo "Event Kind: ${env.EVENT_KIND}"
          echo "Branch: ${branchName}"
          echo "CHANGED_API: ${env.CHANGED_API}"
          echo "CHANGED_WORKER: ${env.CHANGED_WORKER}"
        }
      }
    }

    stage('Backend Test (MR only)') {
      when {
        expression { env.EVENT_KIND == 'merge_request' && env.CHANGED_API == 'true' && fileExists('Backend/pom.xml') }
      }
      steps {
        // Jenkins Credentials 플러그인을 사용하여 보안에 민감한 패스워드를 런타임에 주입받음
        withCredentials([
          string(credentialsId: 'ci-postgres-db', variable: 'CI_POSTGRES_DB'),
          string(credentialsId: 'ci-postgres-user', variable: 'CI_POSTGRES_USER'),
          string(credentialsId: 'ci-postgres-password', variable: 'CI_POSTGRES_PASSWORD')
        ]) {
          dir('Backend') {
            sh '''#!/usr/bin/env bash
              set -euo pipefail
              : > "../../${CI_TEST_LOG}"

              docker rm -f "${CI_REDIS_CONTAINER}" >/dev/null 2>&1 || true
              docker rm -f "${CI_POSTGRES_CONTAINER}" >/dev/null 2>&1 || true

              # 1. 임시 PostgreSQL(PostGIS) 컨테이너 구동
              docker pull "${CI_POSTGRES_IMAGE}" >/dev/null 2>&1 || true
              docker run -d --name "${CI_POSTGRES_CONTAINER}" \
                -e POSTGRES_DB="${CI_POSTGRES_DB}" \
                -e POSTGRES_USER="${CI_POSTGRES_USER}" \
                -e POSTGRES_PASSWORD="${CI_POSTGRES_PASSWORD}" \
                -e TZ=Asia/Seoul \
                -p 0:5432 "${CI_POSTGRES_IMAGE}" >/dev/null

              POSTGRES_HOST_PORT="$(docker port "${CI_POSTGRES_CONTAINER}" 5432/tcp | sed -E 's/.*:([0-9]+)$/\\1/' | tail -n 1)"
              
              # PostgreSQL 구동 대기 Health Check
              for i in $(seq 1 90); do
                if docker exec "${CI_POSTGRES_CONTAINER}" pg_isready -U "${CI_POSTGRES_USER}" -d "${CI_POSTGRES_DB}" --quiet >/dev/null 2>&1; then
                  break
                fi
                sleep 1
              done

              # 2. 임시 Redis 컨테이너 구동
              docker pull "${CI_REDIS_IMAGE}" >/dev/null 2>&1 || true
              docker run -d --name "${CI_REDIS_CONTAINER}" -p 0:6379 "${CI_REDIS_IMAGE}" redis-server --appendonly yes >/dev/null

              REDIS_HOST_PORT="$(docker port "${CI_REDIS_CONTAINER}" 6379/tcp | sed -E 's/.*:([0-9]+)$/\\1/' | tail -n 1)"
              
              # Redis 구동 대기 Health Check
              for i in $(seq 1 30); do
                if docker exec "${CI_REDIS_CONTAINER}" redis-cli ping 2>/dev/null | grep -q PONG; then
                  break
                fi
                sleep 1
              done

              chmod +x mvnw || true
              
              # 3. .env.example 기준 테스트 환경 변수(.env) 더미 생성
              cat <<EOT > .env
DB_URL=jdbc:postgresql://127.0.0.1:${POSTGRES_HOST_PORT}/${CI_POSTGRES_DB}
DB_USERNAME=${CI_POSTGRES_USER}
DB_PASSWORD=${CI_POSTGRES_PASSWORD}
REDIS_HOST=127.0.0.1
REDIS_PORT=${REDIS_HOST_PORT}
JWT_SECRET=c2VjcmV0LWtleS1mb3ItdGVzdGluZy1wdXJwb3Nlcw==
JWT_ACCESS_EXPIRE_SECONDS=1800
JWT_REFRESH_EXPIRE_SECONDS=1209600
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=dummy@gmail.com
MAIL_PASSWORD=dummy
MAIL_FROM=dummy@gmail.com
GOOGLE_CLIENT_ID=dummy.apps.googleusercontent.com
GOOGLE_JWK_SET_URI=https://www.googleapis.com/oauth2/v3/certs
EOT

              # 주입받은 패스워드 변수들을 스프링부트 테스트 환경에 전달
              ./mvnw -q clean test \
                -Dspring.profiles.active=ci \
                2>&1 | tee -a "../../${CI_TEST_LOG}"
            '''
          }
        }
      }
      post {
        always {
          sh '''#!/usr/bin/env bash
            set +e
            docker rm -f "${CI_REDIS_CONTAINER}" >/dev/null 2>&1 || true
            docker rm -f "${CI_POSTGRES_CONTAINER}" >/dev/null 2>&1 || true
          '''
        }
      }
    }

    stage('Build API Image') {
      when { expression { env.EVENT_KIND != 'merge_request' && env.CHANGED_API == 'true' && fileExists('Backend/Dockerfile') } }
      steps {
        script {
          if (!env.DOCKERHUB_NAMESPACE_EFFECTIVE?.trim()) {
            error('DOCKERHUB_NAMESPACE is not set in Jenkins Global Environment Variable.')
          }
          env.API_IMAGE = "${env.DOCKERHUB_NAMESPACE_EFFECTIVE}/yeoun-api:${env.IMAGE_TAG}"
        }
        dir('Backend') { sh 'docker build -t "$API_IMAGE" .' }
      }
    }

    stage('Build Worker Image') {
      when { expression { env.EVENT_KIND != 'merge_request' && env.CHANGED_WORKER == 'true' && fileExists('Worker/Dockerfile') } }
      steps {
        script {
          env.WORKER_IMAGE = "${env.DOCKERHUB_NAMESPACE_EFFECTIVE}/yeoun-worker:${env.IMAGE_TAG}"
        }
        dir('Worker') { sh 'docker build -t "$WORKER_IMAGE" .' }
      }
    }

    stage('Push Images') {
      when { expression { env.EVENT_KIND != 'merge_request' && (env.API_IMAGE?.trim() || env.WORKER_IMAGE?.trim()) } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
          sh '''
            if [ -n "${API_IMAGE:-}" ]; then docker push "$API_IMAGE"; fi
            if [ -n "${WORKER_IMAGE:-}" ]; then docker push "$WORKER_IMAGE"; fi
          '''
        }
      }
    }

    stage('Deploy Node1') {
      when { expression { env.EVENT_KIND != 'merge_request' && env.IS_DEVELOP == 'true' && env.API_IMAGE?.trim() } }
      steps {
        script {
          if (!env.NODE1_HOST) error("NODE1_HOST Global Environment Variable is missing.")
          
          env.PREVIOUS_API_IMAGE = sshagent(credentials: ['ec2-node1-ssh']) {
            sh(script: "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"grep '^API_IMAGE=' '${PROJECT_PATH}/Infra/docker/node1/.env' | cut -d= -f2-\"", returnStdout: true).trim()
          }

          try {
            sshagent(credentials: ['ec2-node1-ssh']) {
              sh "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"cd '${PROJECT_PATH}' && sed -i 's|^API_IMAGE=.*|API_IMAGE=${env.API_IMAGE}|' Infra/docker/node1/.env && bash Infra/scripts/deploy-node1.sh\""
            }
          } catch (Exception err) {
            if (env.PREVIOUS_API_IMAGE?.trim()) {
              env.PREVIOUS_API_TAG = env.PREVIOUS_API_IMAGE.tokenize(':')[-1]
              sshagent(credentials: ['ec2-node1-ssh']) {
                sh "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"cd '${PROJECT_PATH}' && bash Infra/scripts/rollback-node1.sh '${env.PREVIOUS_API_TAG}'\""
              }
            }
            throw err
          }
        }
      }
    }

    stage('Deploy Node2') {
      when { expression { env.EVENT_KIND != 'merge_request' && env.IS_DEVELOP == 'true' && env.WORKER_IMAGE?.trim() } }
      steps {
        script {
          if (!env.NODE2_HOST) error("NODE2_HOST Global Environment Variable is missing.")

          env.PREVIOUS_WORKER_IMAGE = sshagent(credentials: ['ec2-node2-ssh']) {
            sh(script: "ssh -o StrictHostKeyChecking=no \"${env.NODE2_HOST}\" \"grep '^WORKER_IMAGE=' '${PROJECT_PATH}/Infra/docker/node2/.env' | cut -d= -f2-\"", returnStdout: true).trim()
          }

          try {
            sshagent(credentials: ['ec2-node2-ssh']) {
              sh "ssh -o StrictHostKeyChecking=no \"${env.NODE2_HOST}\" \"cd '${PROJECT_PATH}' && sed -i 's|^WORKER_IMAGE=.*|WORKER_IMAGE=${env.WORKER_IMAGE}|' Infra/docker/node2/.env && bash Infra/scripts/deploy-node2.sh\""
            }
          } catch (Exception err) {
            if (env.PREVIOUS_WORKER_IMAGE?.trim()) {
              env.PREVIOUS_WORKER_TAG = env.PREVIOUS_WORKER_IMAGE.tokenize(':')[-1]
              sshagent(credentials: ['ec2-node2-ssh']) {
                sh "ssh -o StrictHostKeyChecking=no \"${env.NODE2_HOST}\" \"cd '${PROJECT_PATH}' && bash Infra/scripts/rollback-node2.sh '${env.PREVIOUS_WORKER_TAG}'\""
              }
            }
            throw err
          }
        }
      }
    }
  }

  post {
    always {
      script {
        def success = (currentBuild.currentResult == 'SUCCESS')
        def kind = env.EVENT_KIND ?: 'unknown'
        def branch = (kind == 'merge_request') ? (env.MR_SOURCE ?: 'unknown') : (env.PUSH_BRANCH ?: env.BRANCH_NAME ?: 'unknown')
        def target = env.MR_TARGET ?: ''
        
        def jobName = (env.JOB_NAME ?: '').trim()
        def buildNo = (env.BUILD_NUMBER ?: '').trim()
        def jobPath = jobName ? jobName.split('/').collect { "job/${it}" }.join('/') : ''
        def buildUrl = jobPath && env.JENKINS_URL ? "${env.JENKINS_URL}${jobPath}/${buildNo}/" : (env.BUILD_URL ?: 'url-not-found')

        def title = success ? ":white_check_mark: [S14P21B105] Jenkins 파이프라인 무사고 통과!" : ":x: [S14P21B105] Jenkins 파이프라인 에러 발생"
        def icon  = success ? ":rocket:" : ":warning:"
        
        def lines = []
        if (kind)    lines << "**이벤트:** `${kind}`"
        if (env.ACTOR) lines << "**실행자:** `${env.ACTOR}`"
        if (branch)  lines << "**브랜치:** `${branch}`"
        if (target)  lines << "**타겟:** `${target}`"
        if (buildUrl) lines << "**Jenkins:** [Build Log](${buildUrl})"

        def payload = groovy.json.JsonOutput.toJson([
          username  : "Jenkins Operator",
          icon_emoji: icon,
          text      : title + "\\n" + lines.join("\\n")
        ])

        writeFile file: 'mm_payload.json', text: payload

        withCredentials([string(credentialsId: 'mattermost-webhook-url', variable: 'MM_URL')]) {
          sh '''#!/usr/bin/env bash
            curl -sS -X POST -H 'Content-Type: application/json' \
              --data-binary @mm_payload.json \
              "$MM_URL" >/dev/null || true
          '''
        }
      }
    }
  }
}

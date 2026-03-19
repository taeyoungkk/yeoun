pipeline {
  agent any
 
  parameters {
    string(name: 'DOCKERHUB_NAMESPACE', defaultValue: '', description: 'Docker Hub namespace. Leave blank to use Jenkins env var.')
  }

  environment {
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
          // 💡 GitLab Plugin 기본 환경변수를 활용하여 복잡한 로직 제거
          
          // 1. 이벤트 종류 판단
          // 'gitlabActionType'이 MERGE이거나, MR 제목 변수(gitlabMergeRequestTitle)가 존재하면 Merge Request 이벤트로 간주합니다.
          env.EVENT_KIND = (env.gitlabActionType == 'MERGE' || env.gitlabMergeRequestTitle != null) ? 'merge_request' : 'push'
          
          // 2. 실행자(액터) 추출
          // GitLab Webhook이 보내주는 유저 이름(gitlabUserName)을 최우선으로 쓰되, 누락된 경우(수동 빌드 등) Git 로그의 최신 커밋 작성자 이름으로 폴백합니다.
          env.ACTOR = env.gitlabUserName ?: sh(script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()

          // 3. 브랜치명 및 타겟 추출
          if (env.EVENT_KIND == 'merge_request') {
              // MR 이벤트의 경우 source(출발지)와 target(도착지) 브랜치가 명확하게 웹훅 변수로 들어옵니다.
              env.PUSH_BRANCH = env.gitlabSourceBranch
              env.MR_TARGET = env.gitlabTargetBranch
              // 타겟이 develop 브랜치인지 boolean 문자열('true'/'false')로 저장하여 이후 Deploy 스테이지 조건문에 활용합니다.
              env.IS_DEVELOP = (env.gitlabTargetBranch == 'develop').toString()
          } else {
              // Push나 수동 빌드의 경우: gitlabBranch -> BRANCH_NAME -> GIT_BRANCH(origin/ 제외) 순으로 안전하게 찾습니다.
              env.PUSH_BRANCH = env.gitlabBranch ?: env.BRANCH_NAME ?: (env.GIT_BRANCH ? env.GIT_BRANCH.replace('origin/', '') : sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim())
              env.MR_TARGET = ''
              env.IS_DEVELOP = (env.PUSH_BRANCH == 'develop').toString()
          }

          env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}"
          env.DOCKERHUB_NAMESPACE_EFFECTIVE = ((params.DOCKERHUB_NAMESPACE?.trim()) ? params.DOCKERHUB_NAMESPACE.trim() : (env.DOCKERHUB_NAMESPACE ?: '').trim()).toLowerCase()

          // 변경된 파일 감지 (API / Worker 분리 빌드용)
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

          echo "✅ Event Kind: ${env.EVENT_KIND}"
          echo "✅ Branch: ${env.PUSH_BRANCH}"
          echo "✅ CHANGED_API: ${env.CHANGED_API}"
          echo "✅ CHANGED_WORKER: ${env.CHANGED_WORKER}"
        }
      }
    }

    stage('Backend Test (MR only)') {
      when { expression { env.EVENT_KIND == 'merge_request' && env.CHANGED_API == 'true' && fileExists('Backend/pom.xml') } }
      steps {
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

              # 1. 임시 DB 컨테이너 실행
              docker pull "${CI_POSTGRES_IMAGE}" >/dev/null 2>&1 || true
              docker run -d --name "${CI_POSTGRES_CONTAINER}" \
                -e POSTGRES_DB="${CI_POSTGRES_DB}" \
                -e POSTGRES_USER="${CI_POSTGRES_USER}" \
                -e POSTGRES_PASSWORD="${CI_POSTGRES_PASSWORD}" \
                -e TZ=Asia/Seoul \
                "${CI_POSTGRES_IMAGE}" >/dev/null

              POSTGRES_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CI_POSTGRES_CONTAINER}")"
              
              for i in $(seq 1 90); do
                if docker exec "${CI_POSTGRES_CONTAINER}" pg_isready -U "${CI_POSTGRES_USER}" -d "${CI_POSTGRES_DB}" --quiet >/dev/null 2>&1; then
                  break
                fi
                sleep 1
              done

              # 2. 임시 Redis 컨테이너 실행
              docker pull "${CI_REDIS_IMAGE}" >/dev/null 2>&1 || true
              docker run -d --name "${CI_REDIS_CONTAINER}" "${CI_REDIS_IMAGE}" redis-server --appendonly yes >/dev/null

              REDIS_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CI_REDIS_CONTAINER}")"
              
              for i in $(seq 1 30); do
                if docker exec "${CI_REDIS_CONTAINER}" redis-cli ping 2>/dev/null | grep -q PONG; then
                  break
                fi
                sleep 1
              done

              chmod +x mvnw || true
              
              # 3. 테스트용 .env 더미 생성 (APP_INVITE_BASE_URL 포함)
              cat <<EOT > .env
DB_URL=jdbc:postgresql://${POSTGRES_IP}:5432/${CI_POSTGRES_DB}
FLYWAY_URL=jdbc:postgresql://${POSTGRES_IP}:5432/${CI_POSTGRES_DB}
DB_USERNAME=${CI_POSTGRES_USER}
DB_PASSWORD=${CI_POSTGRES_PASSWORD}
REDIS_HOST=${REDIS_IP}
REDIS_PORT=6379
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
APP_INVITE_BASE_URL=http://localhost:8080
EOT

              cp src/main/resources/application-local.properties.example src/main/resources/application-ci.properties || true

              # 젠킨스 터미널을 위해 .env 파일의 변수들을 bash 환경 변수로 내보냅니다 (export)
              set -a
              source .env
              set +a

              # 4. 테스트 실행
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
          if (!env.DOCKERHUB_NAMESPACE_EFFECTIVE?.trim()) error('DOCKERHUB_NAMESPACE is not set.')
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
              sh "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"cd '${PROJECT_PATH}' && git pull origin develop && sed -i 's|^API_IMAGE=.*|API_IMAGE=${env.API_IMAGE}|' Infra/docker/node1/.env && bash Infra/scripts/deploy-node1.sh\""
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
          if (!env.NODE2_HOST) error("NODE2_HOST missing.")
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

  // 💡 알림(Post) 블록: Jenkins Sandbox 에러 없이 깔끔한 JSON 변환
  post {
    always {
      script {
        def success = (currentBuild.currentResult == 'SUCCESS')
        def kind = env.EVENT_KIND ?: 'push'
        def branch = env.PUSH_BRANCH ?: 'unknown'
        def actor = env.ACTOR ?: 'unknown'
        def buildUrl = env.BUILD_URL ?: 'url-not-found'
        
        def title = success ? "✅ **[S14P21B105] Jenkins 파이프라인 성공!**" : "❌ **[S14P21B105] Jenkins 파이프라인 에러 발생**"
        
        // 마크다운 텍스트 조립
        // """ (멀티라인 스트링)을 사용하여 가독성 좋고 직관적으로 텍스트를 구성합니다.
        def payloadText = """${title}
- **이벤트:** `${kind}`
- **실행자:** `${actor}`
- **브랜치:** `${branch}` ${env.MR_TARGET ? "(Target: ${env.MR_TARGET})" : ""}
- **로그확인:** [Build Log 보러가기](${buildUrl})"""

        // 줄바꿈과 따옴표를 JSON 규격에 맞게 안전하게 치환 (이스케이프 깨짐 방지)
        // (Windows 환경 등에서 발생할 수 있는 \r 캐리지 리턴도 안전하게 제거합니다)
        def safeText = payloadText.replace('"', '\\"').replace('\r', '').replace('\n', '\\n')

        def payloadJson = """{
          "username": "Jenkins Operator",
          "text": "${safeText}"
        }"""

        writeFile file: 'mm_payload.json', text: payloadJson

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
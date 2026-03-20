pipeline {
  agent any
 
  parameters {
    string(name: 'DOCKERHUB_NAMESPACE', defaultValue: '', description: 'Docker Hub namespace. Leave blank to use Jenkins env var.')
  }

  environment {
    PROJECT_PATH = '/opt/yeoun'

    // CI 테스트용 컨테이너 정보
    CI_REDIS_CONTAINER    = 'ci-redis'
    CI_REDIS_IMAGE        = 'redis:7.4-alpine'
    CI_POSTGRES_CONTAINER = 'ci-postgres'
    CI_POSTGRES_IMAGE     = 'postgis/postgis:17-3.5'
    CI_TEST_LOG           = 'ci_test_backend.log'
    
    // 운영 서버 정보 (Jenkins 글로벌 설정에 등록되어 있어야 함)
    // NODE1_HOST 예: ubuntu@13.124.37.66
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
          env.EVENT_KIND = (env.gitlabActionType == 'MERGE' || env.gitlabMergeRequestTitle != null) ? 'merge_request' : 'push'
          env.ACTOR = env.gitlabUserName ?: sh(script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()

          if (env.EVENT_KIND == 'merge_request') {
              env.PUSH_BRANCH = env.gitlabSourceBranch
              env.MR_TARGET = env.gitlabTargetBranch
              env.IS_DEVELOP = (env.gitlabTargetBranch == 'develop').toString()
          } else {
              env.PUSH_BRANCH = env.gitlabBranch ?: env.BRANCH_NAME ?: (env.GIT_BRANCH ? env.GIT_BRANCH.replace('origin/', '') : sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim())
              env.MR_TARGET = ''
              env.IS_DEVELOP = (env.PUSH_BRANCH == 'develop').toString()
          }

          env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}"
          env.DOCKERHUB_NAMESPACE_EFFECTIVE = ((params.DOCKERHUB_NAMESPACE?.trim()) ? params.DOCKERHUB_NAMESPACE.trim() : (env.DOCKERHUB_NAMESPACE ?: '').trim()).toLowerCase()

          // 변경 감지 로직
          def diffOutput = sh(script: "git rev-parse --verify HEAD~1 >/dev/null 2>&1 && git diff --name-only HEAD~1 HEAD || git ls-files", returnStdout: true).trim()
          def changedFiles = diffOutput ? diffOutput.split('\n') as List : []
          env.CHANGED_API = changedFiles.any { it == 'Jenkinsfile' || it.startsWith('Backend/') || it.startsWith('Infra/docker/node1/') || it.startsWith('Infra/scripts/') }.toString()
          env.CHANGED_WORKER = changedFiles.any { it == 'Jenkinsfile' || it.startsWith('Worker/') || it.startsWith('Infra/docker/node2/') || it.startsWith('Infra/scripts/') }.toString()
        }
      }
    }

    stage('Backend Test (MR only)') {
      when { expression { (env.EVENT_KIND == 'merge_request' || env.IS_DEVELOP == 'false') && env.CHANGED_API == 'true' && fileExists('Backend/pom.xml') } }
      steps {
        withCredentials([
          string(credentialsId: 'ci-postgres-db', variable: 'CI_POSTGRES_DB'),
          string(credentialsId: 'ci-postgres-user', variable: 'CI_POSTGRES_USER'),
          string(credentialsId: 'ci-postgres-password', variable: 'CI_POSTGRES_PASSWORD')
        ]) {
          dir('Backend') {
            sh '''#!/usr/bin/env bash
              set -euo pipefail
              
              # 기존 좀비 컨테이너 청소
              docker rm -f "${CI_REDIS_CONTAINER}" "${CI_POSTGRES_CONTAINER}" >/dev/null 2>&1 || true

              # 1. DB 컨테이너 실행 및 대기
              docker run -d --name "${CI_POSTGRES_CONTAINER}" \
                -e POSTGRES_DB="${CI_POSTGRES_DB}" \
                -e POSTGRES_USER="${CI_POSTGRES_USER}" \
                -e POSTGRES_PASSWORD="${CI_POSTGRES_PASSWORD}" \
                -e TZ=Asia/Seoul "${CI_POSTGRES_IMAGE}" >/dev/null

              POSTGRES_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CI_POSTGRES_CONTAINER}")"
              for i in {1..60}; do
                if docker exec "${CI_POSTGRES_CONTAINER}" pg_isready -U "${CI_POSTGRES_USER}" -d "${CI_POSTGRES_DB}" >/dev/null 2>&1; then break; fi
                sleep 1
              done

              # 2. Redis 컨테이너 실행
              docker run -d --name "${CI_REDIS_CONTAINER}" "${CI_REDIS_IMAGE}" >/dev/null
              REDIS_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CI_REDIS_CONTAINER}")"

              # 3. 테스트용 설정 파일 복구 및 생성 (이게 없어서 Bean이 길을 잃었습니다!)
              # 예제 파일을 복사해서 ci용 프로필 파일을 만들어줍니다.
              cp src/main/resources/application-local.properties.example src/main/resources/application-ci.properties || true
              cp .env.example .env || true
              cat <<EOT > .env
DB_URL=jdbc:postgresql://${POSTGRES_IP}:5432/${CI_POSTGRES_DB}
FLYWAY_URL=jdbc:postgresql://${POSTGRES_IP}:5432/${CI_POSTGRES_DB}
DB_USERNAME=${CI_POSTGRES_USER}
DB_PASSWORD=${CI_POSTGRES_PASSWORD}
REDIS_HOST=${REDIS_IP}
REDIS_PORT=6379
JWT_SECRET=c2VjcmV0LWtleS1mb3ItdGVzdGluZy1wdXJwb3Nlcw==
SPRING_PROFILES_ACTIVE=ci

# AWS Dummy Keys (빈 생성 실패 방지용)
AWS_ACCESS_KEY_ID=dummy_key
AWS_SECRET_ACCESS_KEY=dummy_secret
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=dummy-bucket
EOT

              # 젠킨스 터미널의 환경변수로 완벽하게 밀어넣기
              set -a
              source .env
              set +a
              
              # 스프링 부트에게 CI 환경임을 확실히 알림
              export SPRING_PROFILES_ACTIVE=ci

              # 4. 테스트 실행
              chmod +x mvnw || true
              ./mvnw test \
                -Dmaven.repo.local=.m2/repository \
                -Djava.security.egd=file:/dev/./urandom \
                -T 1C -ntp
            '''
          }
        }
      }
      post {
        always {
          sh 'docker rm -f ci-redis ci-postgres >/dev/null 2>&1 || true'
        }
      }
    }

    stage('Build API Image') {
      when { expression { env.IS_DEVELOP == 'true' && env.CHANGED_API == 'true' && fileExists('Backend/Dockerfile') } }
      steps {
        script {
          env.API_IMAGE = "${env.DOCKERHUB_NAMESPACE_EFFECTIVE}/yeoun-api:${env.IMAGE_TAG}"
          dir('Backend') { sh 'docker build -t "$API_IMAGE" .' }
        }
      }
    }

    stage('Push Images') {
      when { expression { env.IS_DEVELOP == 'true' && env.API_IMAGE?.trim() } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
          sh 'docker push "$API_IMAGE"'
        }
      }
    }

    stage('Deploy Node1') {
      when { expression { env.EVENT_KIND != 'merge_request' && env.IS_DEVELOP == 'true' && env.API_IMAGE?.trim() } }
      steps {
        script {
          // 이전 이미지 태그 백업 (롤백용)
          env.PREVIOUS_API_IMAGE = sshagent(credentials: ['ec2-node1-ssh']) {
            sh(script: "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"grep '^API_IMAGE=' '${PROJECT_PATH}/Infra/docker/node1/.env' | cut -d= -f2-\" || echo ''", returnStdout: true).trim()
          }

          sshagent(credentials: ['ec2-node1-ssh']) {
            // 1. 스크립트 파일 전송 전 포맷팅
            sh "apt-get update && apt-get install -y dos2unix || true"
            sh "dos2unix Infra/scripts/*.sh || true"
            
            // 2. Infra 폴더 전송 (주의: EC2의 .env를 지우지 않도록 주의해야 함. .env가 이미 있다면 덮어쓰지 않는 로직이 스크립트에 있어야 함)
            sh "scp -o StrictHostKeyChecking=no -r Infra \"${env.NODE1_HOST}:${PROJECT_PATH}/\""
            
            // 3. 이미지 태그 업데이트 및 배포 스크립트 실행
            sh """
              ssh -o StrictHostKeyChecking=no "${env.NODE1_HOST}" "
                cd '${PROJECT_PATH}' && \
                sed -i 's|^API_IMAGE=.*|API_IMAGE=${env.API_IMAGE}|' Infra/docker/node1/.env && \
                bash Infra/scripts/deploy-node1.sh
              "
            """
          }
        }
      }
      post {
        failure {
          script {
            if (env.PREVIOUS_API_IMAGE?.contains(':')) {
              def prevTag = env.PREVIOUS_API_IMAGE.tokenize(':')[-1]
              sshagent(credentials: ['ec2-node1-ssh']) {
                sh "ssh -o StrictHostKeyChecking=no \"${env.NODE1_HOST}\" \"cd '${PROJECT_PATH}' && bash Infra/scripts/rollback-node1.sh '${prevTag}'\""
              }
            }
          }
        }
      }
    }
  }

  post {
    always {
      script {
        def success = (currentBuild.currentResult == 'SUCCESS')
        def title = success ? "✅ **Jenkins 성공!**" : "❌ **Jenkins 실패!**"
        def payloadText = """${title}
- **이벤트:** `${env.EVENT_KIND}`
- **실행자:** `${env.ACTOR}`
- **브랜치:** `${env.PUSH_BRANCH}`
- [Build Log 보러가기](${env.BUILD_URL})"""

        def safeText = payloadText.replace('"', '\\"').replace('\n', '\\n')
        writeFile file: 'mm_payload.json', text: "{\"username\": \"Jenkins\", \"text\": \"${safeText}\"}"

        withCredentials([string(credentialsId: 'mattermost-webhook-url', variable: 'MM_URL')]) {
          sh "curl -sS -X POST -H 'Content-Type: application/json' --data-binary @mm_payload.json '$MM_URL' || true"
        }
      }
    }
  }
}
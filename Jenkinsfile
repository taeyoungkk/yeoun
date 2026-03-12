pipeline {
  agent any

  parameters {
  string(name: 'DOCKERHUB_NAMESPACE', defaultValue: 'kss095', description: 'Docker Hub namespace')
}

  environment {
    DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
    EC2_NODE1_SSH = 'ec2-node1-ssh'
    EC2_NODE2_SSH = 'ec2-node2-ssh'
    NODE1_HOST = 'ubuntu@13.124.37.66'
    NODE2_HOST = 'ubuntu@54.180.230.198'
    PROJECT_PATH = '/opt/yeoun'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}"

          def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
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

          echo "Branch=${branchName}"
          echo "IS_DEVELOP=${env.IS_DEVELOP}"
          echo "CHANGED_API=${env.CHANGED_API}"
          echo "CHANGED_WORKER=${env.CHANGED_WORKER}"
          echo "DOCKERHUB_NAMESPACE_EFFECTIVE=${env.DOCKERHUB_NAMESPACE_EFFECTIVE}"
        }
      }
    }

    stage('Build API Image') {
      when {
        expression { env.CHANGED_API == 'true' && fileExists('Backend/Dockerfile') && fileExists('Backend/pom.xml') }
      }
      steps {
        script {
          if (!env.DOCKERHUB_NAMESPACE_EFFECTIVE?.trim()) {
            error('DOCKERHUB_NAMESPACE is not set. Set the build parameter or Jenkins environment variable.')
          }
          env.API_IMAGE = "${env.DOCKERHUB_NAMESPACE_EFFECTIVE}/yeoun-api:${env.IMAGE_TAG}"
        }
        dir('Backend') {
          sh 'docker build -t "$API_IMAGE" .'
        }
      }
    }

    stage('Build Worker Image') {
      when {
        expression { env.CHANGED_WORKER == 'true' && fileExists('Worker/Dockerfile') }
      }
      steps {
        script {
          if (!env.DOCKERHUB_NAMESPACE_EFFECTIVE?.trim()) {
            error('DOCKERHUB_NAMESPACE is not set. Set the build parameter or Jenkins environment variable.')
          }
          env.WORKER_IMAGE = "${env.DOCKERHUB_NAMESPACE_EFFECTIVE}/yeoun-worker:${env.IMAGE_TAG}"
        }
        dir('Worker') {
          sh 'docker build -t "$WORKER_IMAGE" .'
        }
      }
    }

    stage('Push Images') {
      when {
        expression { env.API_IMAGE?.trim() || env.WORKER_IMAGE?.trim() }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
          sh '''
            if [ -n "${API_IMAGE:-}" ]; then docker push "$API_IMAGE"; fi
            if [ -n "${WORKER_IMAGE:-}" ]; then docker push "$WORKER_IMAGE"; fi
          '''
        }
      }
    }

    stage('Print Images') {
      steps {
        echo "API_IMAGE=${env.API_IMAGE ?: ''}"
        echo "WORKER_IMAGE=${env.WORKER_IMAGE ?: ''}"
      }
    }


    stage('Deploy Node1') {
      when {
        expression { env.IS_DEVELOP == 'true' && env.API_IMAGE?.trim() }
      }
      steps {
        script {
          env.PREVIOUS_API_IMAGE = sshagent(credentials: [env.EC2_NODE1_SSH]) {
            sh(script: '''
              ssh -o StrictHostKeyChecking=no "$NODE1_HOST" \
                "grep '^API_IMAGE=' '$PROJECT_PATH/Infra/docker/node1/.env' | cut -d= -f2-"
            ''', returnStdout: true).trim()
          }

          try {
            sshagent(credentials: [env.EC2_NODE1_SSH]) {
              sh '''
                ssh -o StrictHostKeyChecking=no "$NODE1_HOST" \
                  "cd '$PROJECT_PATH' && sed -i 's|^API_IMAGE=.*|API_IMAGE=$API_IMAGE|' Infra/docker/node1/.env && bash Infra/scripts/deploy-node1.sh"
              '''
            }
          } catch (Exception err) {
            if (env.PREVIOUS_API_IMAGE?.trim()) {
              env.PREVIOUS_API_TAG = env.PREVIOUS_API_IMAGE.tokenize(':')[-1]
              sshagent(credentials: [env.EC2_NODE1_SSH]) {
                sh '''
                  ssh -o StrictHostKeyChecking=no "$NODE1_HOST" \
                    "cd '$PROJECT_PATH' && bash Infra/scripts/rollback-node1.sh '$PREVIOUS_API_TAG'"
                '''
              }
            }
            throw err
          }
        }
      }
    }

    stage('Deploy Node2') {
      when {
        expression { env.IS_DEVELOP == 'true' && env.WORKER_IMAGE?.trim() }
      }
      steps {
        script {
          env.PREVIOUS_WORKER_IMAGE = sshagent(credentials: [env.EC2_NODE2_SSH]) {
            sh(script: '''
              ssh -o StrictHostKeyChecking=no "$NODE2_HOST" \
                "grep '^WORKER_IMAGE=' '$PROJECT_PATH/Infra/docker/node2/.env' | cut -d= -f2-"
            ''', returnStdout: true).trim()
          }

          try {
            sshagent(credentials: [env.EC2_NODE2_SSH]) {
              sh '''
                ssh -o StrictHostKeyChecking=no "$NODE2_HOST" \
                  "cd '$PROJECT_PATH' && sed -i 's|^WORKER_IMAGE=.*|WORKER_IMAGE=$WORKER_IMAGE|' Infra/docker/node2/.env && bash Infra/scripts/deploy-node2.sh"
              '''
            }
          } catch (Exception err) {
            if (env.PREVIOUS_WORKER_IMAGE?.trim()) {
              env.PREVIOUS_WORKER_TAG = env.PREVIOUS_WORKER_IMAGE.tokenize(':')[-1]
              sshagent(credentials: [env.EC2_NODE2_SSH]) {
                sh '''
                  ssh -o StrictHostKeyChecking=no "$NODE2_HOST" \
                    "cd '$PROJECT_PATH' && bash Infra/scripts/rollback-node2.sh '$PREVIOUS_WORKER_TAG'"
                '''
              }
            }
            throw err
          }
        }
      }
    }
  }

  post {
    success {
      echo 'Pipeline completed successfully.'
    }
    failure {
      echo 'Pipeline failed. Check the failed stage and Jenkins credentials/env.'
    }
  }
}

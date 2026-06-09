pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    environment {
        JOB_BASE_NAME   = "${JOB_NAME.split('/').last()}"

        IMAGE_NAME      = "halotamu-frontend"
        IMAGE_TAG       = "${BUILD_NUMBER}"

        CONTAINER_NAME  = "${JOB_BASE_NAME}-app"

        APP_PORT        = "8082"

        DEPLOY_USER     = "ubuntu"
        DEPLOY_HOST_A     = "54.82.72.39"
        DEPLOY_HOST_B     = "54.89.102.198"

        SSH_KEY_ID      = "deploy-key"

        DOCKER_HUB_USER  = "crobindev"
        DOCKER_HUB_IMAGE = "${DOCKER_HUB_USER}/${IMAGE_NAME}"

        DOCKER_CREDENTIAL_ID = "docker-hub-pat"
    }

    stages {
        stage('Clone') {
            steps {
                checkout scm
            }
        }
        stage('Debug') {
            steps {
                sh 'pwd'
                sh 'ls -R'
            }
        }
        stage('Docker Login') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: "${DOCKER_CREDENTIAL_ID}",
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login \
                            -u "$DOCKER_USER" \
                            --password-stdin
                    '''
                }
            }
        }

        stage('Build') {
            steps {
                sh """
                    docker build \
                        -t ${DOCKER_HUB_IMAGE}:${IMAGE_TAG} \
                        -t ${DOCKER_HUB_IMAGE}:latest \
                        ./app
                """
            }
        }

        stage('Test') {
            steps {
                echo "Frontend project — checking nginx config"

                sh """
                    docker run --rm \
                        ${DOCKER_HUB_IMAGE}:${IMAGE_TAG} \
                        nginx -t
                """
            }
        }

        stage('Push Image') {
            steps {
                sh """
                    docker push ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
                    docker push ${DOCKER_HUB_IMAGE}:latest
                """
            }
        }

        stage('Deploy') {
            steps {
                script {
                    def hosts = [
                        DEPLOY_HOST_A,
                        DEPLOY_HOST_B
                    ]

                    sshagent(credentials: [SSH_KEY_ID]) {
                        hosts.each { host ->
                            sh """
                                ssh -o StrictHostKeyChecking=no \
                                ${DEPLOY_USER}@${host} '

                                    cd opt/halotamu

                                    docker compose pull

                                    docker compose up -d

                                    docker image prune -af
                                '
                            """
                        }
                    }
                }
            }
        }

        stage('Cleanup') {
            sshagent(credentials: [SSH_KEY_ID]) {
                def hosts = [
                    DEPLOY_HOST_A,
                    DEPLOY_HOST_B
                ]

                hosts.each { host ->
                    sh """
                        ssh -o StrictHostKeyChecking=no \
                        ${DEPLOY_USER}@${host} '

                            docker image rm \
                                ${DOCKER_HUB_IMAGE}:${prevTag} \
                                || true
                        '
                    """
                    }
                }
            }
        }
    }

    post {

        always {
            sh 'docker logout || true'
        }

        success {
            echo """
            =====================================
            Deploy berhasil
            Job   : ${JOB_NAME}
            Build : #${BUILD_NUMBER}
            Image : ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
            Port  : ${APP_PORT}
            =====================================
            """
        }

        failure {
            echo """
            =====================================
            Deploy gagal
            Job   : ${JOB_NAME}
            Build : #${BUILD_NUMBER}
            =====================================
            """

            sshagent(credentials: [SSH_KEY_ID]) {
                sh """
                    ssh -o StrictHostKeyChecking=no \
                    ${DEPLOY_USER}@${DEPLOY_HOST} '

                        docker stop ${CONTAINER_NAME} || true
                        docker rm ${CONTAINER_NAME} || true
                    '
                """
            }
        }
    }
}
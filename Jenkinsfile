pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 10, unit: 'MINUTES')
    }

    environment {
        JOB_BASE_NAME   = "${JOB_NAME.split('/').last()}"
        IMAGE_TAG       = "${BUILD_NUMBER}"
        APP_PORT        = "${params.APP_PORT}"
        DEPLOY_USER     = "${params.DEPLOY_USER}"
        DEPLOY_HOST_A   = "${params.DEPLOY_HOST_A}"
        DEPLOY_HOST_B   = "${params.DEPLOY_HOST_B}"
        SSH_KEY_ID      = "${params.SSH_KEY_ID}"
        IMAGE_NAME      = "${params.DOCKER_IMAGE}"
        DOCKER_HUB_USER  = "${params.DOCKER_HUB_USER}"
        DOCKER_HUB_IMAGE = "${DOCKER_HUB_USER}/${IMAGE_NAME}"
        DOCKER_CREDENTIAL_ID = "${params.DOCKER_CREDENTIAL_ID}"

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

                    def deployJobs = [:]

                    sshagent(credentials: [SSH_KEY_ID]) {

                        hosts.each { host ->

                            def currentHost = host

                            deployJobs["Deploy-${currentHost}"] = {

                                sh """
                                    ssh \
                                        -o StrictHostKeyChecking=no \
                                        -o ConnectTimeout=15 \
                                        ${DEPLOY_USER}@${currentHost} '
                                            set -e

                                            cd opt/halotamu

                                            docker compose pull
                                            docker compose up -d

                                            sleep 10

                                            STATUS=\$(docker inspect \
                                                --format='{{.State.Health.Status}}' \
                                                halotamu-app)

                                            echo "Health Status: \$STATUS"

                                            [ "\$STATUS" = "healthy" ]
                                        '
                                """
                            }
                        }

                        parallel deployJobs
                    }
                }
            }
        }

        stage('Cleanup') {
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
                                    -o ConnectTimeout=15 \
                                ${DEPLOY_USER}@${host} '

                                    docker image prune -af || true
                                '
                            """
                        }
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

            script {
                def hosts = [
                    DEPLOY_HOST_A,
                    DEPLOY_HOST_B
                ]

                sshagent(credentials: [SSH_KEY_ID]) {
                    hosts.each { host ->
                        sh """
                            ssh -o StrictHostKeyChecking=no \
                                -o ConnectTimeout=15 \
                            ${DEPLOY_USER}@${host} '

                                docker compose -f opt/halotamu/docker-compose.yml ps || true
                            '
                        """
                    }
                }
            }
        }
    }
}
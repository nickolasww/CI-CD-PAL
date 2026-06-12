# Implementasi Pipeline CI/CD Berbasis Jenkins untuk Otomasi Build, Test, dan Deployment pada AWS EC2

## Ringkasan Implementasi

Dokumentasi ini menjelaskan implementasi pipeline CI/CD menggunakan **Jenkins** untuk mengotomasi proses:

- build image Docker aplikasi Halotamu
- pengujian konfigurasi Nginx di container
- push image ke Docker Hub
- deploy otomatis ke dua EC2 Instance

Arsitektur ini menggunakan:

- 1 Jenkins server yang dijalankan lewat `docker-compose`
- 2 EC2 Instance target untuk menjalankan aplikasi Halotamu
- load balancer berbasis **Nginx** yang terhubung melalui IP privat VPC
- security group dengan aturan port `22`, `443`, `80`, `8082`, dan `ICMPv4`


## Infrastruktur AWS

Pengaturan AWS yang digunakan meliputi:

- dua EC2 Instance untuk deployment aplikasi Halotamu
- Nginx sebagai load balancer yang mengarahkan trafik internal melalui private VPC IP
- security group dengan rule:
  - port `22` untuk SSH
  - port `443` untuk HTTPS
  - port `80` untuk HTTP
  - port `8082` untuk aplikasi, terbuka dari `0.0.0.0/0`
  - rule `ICMPv4` untuk `172.31.0.0/16`


## Tujuan Implementasi

1. Menyiapkan Jenkins sebagai server CI/CD
2. Menyusun pipeline build, test, push, dan deploy
3. Mengkonfigurasi deployment `docker-compose` pada EC2 target
4. Menghubungkan GitHub webhook ke Jenkins

## Arsitektur Sistem

```
GitHub Repository
       │
       ▼
   Jenkins Server
   (docker-compose)
       │
       │ build, test, push
       ▼
 Docker Hub Registry
       │
       │ pull image
       ▼
┌──────────────────────────────────┐
│        AWS VPC Private           │
│  ┌───────────┐   ┌───────────┐   │
│  │ EC2 A     │   │ EC2 B     │   │
│  │ halotamu  │   │ halotamu  │   │
│  └───────────┘   └───────────┘   │
│         │             │          │
│         └─────┬───────┘          │
│               ▼                  │
│       Nginx Load Balancer        │
└──────────────────────────────────┘
```


## Konfigurasi Security Group

Gunakan konfigurasi security group berikut:

- `SSH (22)` untuk akses SSH dibuka untuk `0.0.0.0/0`
- `HTTPS (443)` untuk akses secure ke load balancer dibuka untuk `0.0.0.0/0`
- `HTTP (80)` untuk akses web standar dibuka untuk `0.0.0.0/0`
- `APP (8082)` dibuka untuk `0.0.0.0/0`
- `ICMPv4` diizinkan untuk subnet `172.31.0.0/16`


## Peran Nginx Load Balancer

Nginx load balancer digunakan untuk mengarahkan traffic ke EC2 target melalui IP privat VPC. Dengan konfigurasi ini, trafik internal tetap berada dalam VPC dan hanya port yang diperlukan saja yang dibuka secara publik.


## Keterangan Pipeline

Pipeline Jenkins akan menjalankan langkah-langkah berikut:

1. `Clone` kode dari repository Git.
2. `Docker Login` ke Docker Hub.
3. `Build` image aplikasi.
4. `Test` konfigurasi `nginx -t` di dalam container.
5. `Push Image` ke Docker Hub.
6. `Deploy` ke dua EC2 host secara paralel.
7. `Cleanup` image lama pada target.


## Catatan Penting

- Nama container target harus `halotamu-app` agar healthcheck dan deployment script konsisten.
- `.env` di EC2 target harus berisi `IMAGE_NAME` dan `IMAGE_TAG`.
- Jenkins container memerlukan akses Docker host melalui `/var/run/docker.sock`.
- SSH key harus tersimpan di Jenkins Credentials sebagai `SSH Username with private key`.


## Panduan Setup Jenkins & Deployment Halotamu

### 1. Inisialisasi Jenkins dengan `docker-compose`

Gunakan file `docker-compose.yaml` di root repository untuk menjalankan Jenkins:

```yaml
version: "3"

services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins_sandbox
    privileged: true
    restart: unless-stopped
    environment:
      - JENKINS_OPTS=--prefix=/jenkins
    user: root
    ports:
      - 8081:8080
      - 50000:50000
    volumes:
      - ${JENKINS_HOME_PATH}:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - /usr/bin/docker:/usr/bin/docker
    networks:
      - jenkins_net

networks:
  jenkins_net:
    driver: bridge
```

Jalankan Jenkins pada host dengan perintah:

```bash
docker compose up -d
```

> Pastikan `JENKINS_HOME_PATH` sudah di-set di environment host sebelum menjalankan.


### 2. Konfigurasi `docker-compose` pada setiap EC2 untuk aplikasi Halotamu

Jenkins pipeline akan menggunakan file `app/docker-compose.yaml` dari repository dan mengirimkannya ke EC2 target sebelum menjalankan deploy.

File `app/docker-compose.yaml` di repository harus berisi template service berikut:

```yaml
version: "3.9"

services:
  app:
    image: ${IMAGE_NAME}:${IMAGE_TAG}
    container_name: halotamu-app
    restart: unless-stopped

    ports:
      - "8082:80"

    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:80 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

Dalam `Jenkinsfile`, file ini akan disalin ke host target di `/opt/halotamu/docker-compose.yml`, lalu Jenkins akan membuat file `.env` di target dengan nilai runtime:

```dotenv
IMAGE_NAME=${DOCKER_HUB_IMAGE}
IMAGE_TAG=${IMAGE_TAG}
```

Jadi kamu tidak perlu membuat `docker-compose.yml` dan `.env` secara manual pada setiap EC2 jika pipeline berhasil menyalin file tersebut.

Namun, jika ingin memelihara file deployment secara manual di EC2, pastikan struktur direktori dan isi file sama seperti di atas.

> `docker compose` akan otomatis mengambil nilai dari `.env` saat file `docker-compose.yml` menggunakan `${IMAGE_NAME}` dan `${IMAGE_TAG}`.


### 3. Parameter Jenkins Pipeline yang harus dikonfigurasi

Tambahkan parameter berikut di konfigurasi Pipeline job di Jenkins:

- `APP_PORT` (String Parameter)
- `DEPLOY_USER` (String Parameter)
- `DEPLOY_HOST_A` (String Parameter)
- `DEPLOY_HOST_B` (String Parameter)
- `SSH_KEY_ID` (Credentials Parameter)
- `DOCKER_IMAGE` (String Parameter)
- `DOCKER_HUB_USER` (String Parameter)
- `DOCKER_CREDENTIAL_ID` (Credentials Parameter)

Pipeline `Jenkinsfile` akan menggunakan parameter tersebut untuk membangun dan mendorong image Docker, lalu melakukan deploy ke dua host target.

Di `Jenkinsfile`, environment yang digunakan adalah:

```groovy
APP_PORT        = "${params.APP_PORT}"
DEPLOY_USER     = "${params.DEPLOY_USER}"
DEPLOY_HOST_A   = "${params.DEPLOY_HOST_A}"
DEPLOY_HOST_B   = "${params.DEPLOY_HOST_B}"
SSH_KEY_ID      = "${params.SSH_KEY_ID}"
IMAGE_NAME      = "${params.DOCKER_IMAGE}"
DOCKER_HUB_USER  = "${params.DOCKER_HUB_USER}"
DOCKER_HUB_IMAGE = "${DOCKER_HUB_USER}/${IMAGE_NAME}"
DOCKER_CREDENTIAL_ID = "${params.DOCKER_CREDENTIAL_ID}"
```

### 4. Membangun dan menjalankan pipeline

1. Push `Jenkinsfile` dan kode aplikasi ke repository Git.
2. Buka job Jenkins yang menggunakan pipeline ini.
3. Klik `Build with Parameters`.
4. Isi nilai parameter sesuai environment:
   - `APP_PORT`: `8082`
   - `DEPLOY_USER`: user SSH target
   - `DEPLOY_HOST_A`: IP atau hostname EC2 pertama
   - `DEPLOY_HOST_B`: IP atau hostname EC2 kedua
   - `SSH_KEY_ID`: credential SSH yang sudah terdaftar
   - `DOCKER_IMAGE`: `halo-tamu`
   - `DOCKER_HUB_USER`: Docker Hub username
   - `DOCKER_CREDENTIAL_ID`: credential Docker Hub username/password
5. Jalankan build.

Jika build berhasil, Jenkins akan membangun image, menjalankan `nginx -t` di container sementara, lalu mendorong image ke Docker Hub dan SSH ke host target untuk menjalankan `docker compose pull` serta `docker compose up -d`.


### 5. Konfigurasi GitHub Webhook dan SCM trigger di Jenkins

Agar Jenkins dapat dipicu otomatis saat ada push GitHub, lakukan langkah berikut:

1. Di GitHub repository, buka `Settings > Webhooks > Add webhook`.
2. Set `Payload URL` ke alamat Jenkins:
   - `http://<jenkins-host>:8081/jenkins/github-webhook/`
3. Set `Content type` ke `application/json`.
4. Pilih event `Just the push event` atau sesuai kebutuhan.
5. Simpan webhook.

Di Jenkins job konfigurasi:

1. Buka job pipeline.
2. Pilih `Configure`.
3. Di bagian `Build Triggers`, centang:
   - `GitHub hook trigger for GITScm polling`

> Jika menggunakan Declarative Pipeline dengan `Pipeline script from SCM`, pastikan SCM sudah diatur ke repository GitHub yang benar dan kredensial Git sudah terpasang.


### 6. Catatan penting

- Pastikan EC2 target sudah terpasang Docker dan Docker Compose.
- Pastikan `jenkins` container memiliki akses ke Docker host melalui `/var/run/docker.sock` dan `/usr/bin/docker`.
- Pastikan `SSH_KEY_ID` Jenkins adalah credential `SSH Username with private key` yang dapat login ke setiap EC2 target.
- Nama container target di `docker-compose.yml` harus `halotamu-app` agar pipeline deployment dan healthcheck sesuai konfigurasi.
- Untuk debugging, lihat log stage `Debug` di Jenkins dan cek output `docker compose pull`, `docker compose up -d`, serta `docker inspect`.

---

## Referensi singkat

- `docker compose up -d` → jalankan service di background
- `docker compose pull` → ambil image terbaru dari registry
- `docker compose up -d` → jalankan container berdasarkan update image
- `docker inspect --format='{{.State.Health.Status}}' halotamu-app` → cek status health container
- `GitHub hook trigger for GITScm polling` → aktivasi webhook push GitHub

---

## Alur CI/CD Pipeline

```
Code Push
    │
    ▼
[Stage 1: Clone]
    │  Checkout repository dari SCM
    ▼
[Stage 2: Debug]
    │  Verifikasi workspace dan file
    ▼
[Stage 3: Docker Login]
    │  Login ke Docker Hub dengan credential
    ▼
[Stage 4: Build]
    │  Build Docker image dari ./app
    ▼
[Stage 5: Test]
    │  Jalankan nginx -t dalam container hasil build
    ▼
[Stage 6: Push Image]
    │  Push image ke Docker Hub dengan tag build number
    ▼
[Stage 7: Deploy]
    │  SCP docker-compose.yml dan deploy ke 2 EC2 target
    ▼
[Stage 8: Cleanup]
    │  Prune image lama di target
    ▼
[Post: Notification]
    │  Log sukses / gagal dan aksi tambahan
```



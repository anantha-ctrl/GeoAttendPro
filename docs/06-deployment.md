# Deployment Guide

## A. Local development (XAMPP, Windows)

### 1. Prerequisites
- XAMPP (Apache + MySQL/MariaDB, PHP 8.2+)
- Node.js 18+ (for the React frontend)

### 2. Database
> **Port note:** CloudHawk expects MySQL on port **3306** with the credentials in
> `backend/.env`. If another MySQL/MySQL-8 service already occupies 3306, either stop it so
> XAMPP's MariaDB can bind 3306, **or** set `DB_PORT`/`DB_USER`/`DB_PASS` in `.env` to point at
> the running server.

1. Start **MySQL** from the XAMPP Control Panel.
2. Configure `backend/.env` (copy from `.env.example`):
   ```
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=geoattend_pro
   DB_USER=root
   DB_PASS=
   ```
3. Create schema + seed, then apply feature migrations:
   ```bash
   cd backend
   php console/migrate.php                 # base schema + seed
   php database/phase2.php                 # then phase3 … phase10 in order
   ```
   (Or import `backend/database/schema.sql` then `seed.sql` via phpMyAdmin / MySQL Workbench,
   followed by the phase scripts. All migrations are idempotent.)

### 3. Backend API
- Place the project under `D:\xampp\htdocs\GeoAttendPro` (already done).
- API base URL: `http://localhost/GeoAttendPro/backend/public`
- Ensure Apache `mod_rewrite` is enabled (XAMPP default) so `public/.htaccess` routes to `index.php`.

### 4. Frontend
```bash
cd frontend
npm install
# frontend/.env  ->  VITE_API_BASE_URL=http://localhost/GeoAttendPro/backend/public
npm run dev          # http://localhost:5173
```
Login with the seeded accounts (see README).

### 5. Scheduled jobs (optional but recommended)
Run hourly via **Windows Task Scheduler** (Action → Start a program):
```
Program:   D:\xampp\php\php.exe
Arguments: D:\xampp\htdocs\GeoAttendPro\backend\console\cron.php
```
This purges expired sessions, marks absentees, and sends attendance reminders.

---

## B. Production deployment (Linux + Apache/Nginx)

### 1. Build the frontend
```bash
cd frontend
npm ci && npm run build      # outputs frontend/dist/
```
Serve `dist/` as static files (CDN or web root). Set `VITE_API_BASE_URL` to the public API URL before building.

### 2. Backend
- Point the web root at `backend/public` only (never expose `src/`, `config/`, `database/`).
- Apache vhost example:
  ```apache
  <VirtualHost *:443>
    ServerName api.geoattend.example.com
    DocumentRoot /var/www/geoattend/backend/public
    <Directory /var/www/geoattend/backend/public>
      AllowOverride All
      Require all granted
    </Directory>
    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/.../fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/.../privkey.pem
  </VirtualHost>
  ```
- Nginx + PHP-FPM: `try_files $uri /index.php$is_args$args;`

### 3. Environment hardening
- `APP_ENV=production`, `APP_DEBUG=false`.
- Set a strong random `APP_SECRET`.
- Create a dedicated MySQL user (not root) with least privileges on `geoattend_pro`.
- Configure SMTP (`MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`) for real email.
- Ensure `backend/public/storage/uploads` and `backend/storage/logs` are writable by the web user.
- Force HTTPS (required for camera + geolocation).

### 4. Cron (Linux)
```cron
0 * * * * /usr/bin/php /var/www/geoattend/backend/console/cron.php >> /var/log/geoattend-cron.log 2>&1
```

### 5. Scaling
- API is **stateless** (DB-backed sessions) → run multiple PHP nodes behind a load balancer.
- Move uploads to S3-compatible storage (swap `Support\Uploader`).
- Add DB read replicas for reporting if needed.

## C. Backup
- `mysqldump geoattend_pro` daily; back up `public/storage/uploads` (selfies/photos).

# Security Rules & Validation Rules

## 1. Security Rules

### 1.1 Authentication & Sessions
- Passwords hashed with **bcrypt** (`password_hash`/`password_verify`).
- Sessions are **opaque 256-bit tokens** stored in `user_sessions` (not guessable, revocable).
- **5-hour timeout** (`SESSION_TIMEOUT_HOURS`). On each request, expired sessions are deleted
  and the user receives `401` (auto-logout). `last_activity` slides forward; hard `expires_at` caps the lifetime.
- Password change / account suspension **invalidate all existing sessions** for that user.
- Failed logins are recorded; forgot-password responses do **not** reveal whether an email exists.

### 1.2 Authorization (RBAC)
- `AuthMiddleware` resolves the user; `Guard::allow([roles])` enforces per-action permissions.
- Employees can only read/modify **their own** profile & attendance; admins manage all.
- Only **Super Admin** may create/delete admin accounts, change settings, view active sessions.

### 1.3 CSRF Protection
- Double-submit token: `Csrf::tokenFor(sessionId) = HMAC-SHA256(sessionId, APP_SECRET)`.
- Required on **all** state-changing methods (POST/PUT/PATCH/DELETE) via `CsrfMiddleware`;
  missing/incorrect → `419`. Safe methods (GET/HEAD/OPTIONS) skip the check.

### 1.4 Injection & Output
- **100% prepared statements** (PDO, `ATTR_EMULATE_PREPARES = false`) — no string-built SQL with user input.
- JSON responses; report HTML uses `htmlspecialchars` on every cell (XSS-safe).
- Mass-assignment guarded by per-model `$fillable` whitelists.

### 1.5 Attendance Integrity
- `UNIQUE(user_id, attendance_date)` prevents duplicate check-ins even under concurrency.
- Server timestamps are authoritative (client time ignored).
- IP + User-Agent (device) captured per attendance and per login.
- Geofence validation (Haversine distance) when enabled.

### 1.6 File Uploads
- Whitelist MIME (`jpeg/png/webp`), max **5 MB**, randomized filenames, stored outside source tree under `public/storage`.

### 1.7 Auditing
- `activity_logs`: actor, action, entity, description, IP, timestamp for every sensitive op.
- `login_history`: success/failed/logout/expired with IP + device.

### 1.8 Transport & Config
- Serve over **HTTPS** in production (also required for Geolocation/Camera).
- `.htaccess` denies direct access to `.env`, `.sql`, `.log`.
- Secrets in `.env` (never committed); set a strong `APP_SECRET` in production.

## 2. Validation Rules

Implemented in `App\Core\Validator` (rule string syntax: `required|email|min:8|...`).

| Field | Rules |
|-------|-------|
| Login email | `required|email` |
| Login password | `required` |
| Reset password | `required|min:8|confirmed` |
| Employee full_name | `required|max:150` |
| Employee email | `required|email` + unique check |
| Employee phone | `nullable|digits_between:7,15` |
| Employee role_id | `required|integer` |
| Employee password (create) | `required|min:8` |
| Department / Designation name | `required|max:120` |
| Check-in latitude | `required|latitude` (−90..90) |
| Check-in longitude | `required|longitude` (−180..180) |
| Check-in selfie | `required` (valid base64 image data-URI) |
| Leave from/to_date | `required|date`; `to >= from`; no overlap with pending/approved |
| Leave reason | `required|max:500` |
| Employee status | `in:active,inactive,suspended` |

### Available validator rules
`required, nullable, email, min, max, numeric, integer, date, in, digits_between, confirmed, latitude, longitude`.

### Server + client
Validation is enforced **server-side** (authoritative). The React forms add HTML5 constraints
(`required`, `type`, `minLength`) for fast feedback, but never replace server checks.

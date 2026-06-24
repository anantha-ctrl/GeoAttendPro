# CloudHawk — Smart Web-Based Employee Attendance & Workforce Tracking System

> Formerly *GeoAttend Pro*. A production-grade attendance & productivity platform for companies
> with or without a physical office. Employees mark attendance using **GPS geofencing + live
> selfie + face verification**, while a real-time **work-tracking state machine** (Working →
> Rest → Overtime → Logged Out) monitors actual working time. Includes leave, payroll, expenses,
> tasks, help-desk, multi-branch support, reporting and full auditing.

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 (Vite), React Router, Axios, Chart.js, Bootstrap 5 + Icons |
| Maps/AI   | Leaflet + OpenStreetMap (geofence picker), face-api.js (face match), jsPDF + autotable (PDF) |
| Backend   | PHP 8.2 REST API (clean MVC, no framework lock-in), PDO |
| Database  | MySQL / MariaDB 10.4+ |
| Auth      | Opaque session tokens, session timeout, CSRF double-submit, RBAC |

```
GeoAttendPro/
├── backend/                 PHP REST API
│   ├── config/              env loader + bootstrap (autoloader)
│   ├── console/             CLI: migrate.php, cron.php
│   ├── database/            schema.sql, seed.sql, phase2..phase9 migrations
│   ├── public/              front controller (index.php) + .htaccess + uploads
│   └── src/
│       ├── Core/            Database, Router, Request, Response, Auth, Csrf, Validator
│       ├── Middleware/      AuthMiddleware, CsrfMiddleware
│       ├── Models/          User, Attendance, AttendanceSession, AttendanceEvent, Leave,
│       │                    Shift, Holiday, Document, Announcement, ExpenseClaim, Task,
│       │                    Ticket, Client, Purchase, Department, Designation, Notification
│       ├── Services/        AttendanceService, PayrollService (business rules)
│       ├── Support/         Activity, Geo, Settings, Uploader, Mailer, Guard
│       └── Controllers/     Auth, Employee, Attendance, Leave, Dashboard, Report, Payroll,
│                            Celebration, Announcement, Expense, Task, Ticket, Client, Purchase, ...
├── frontend/                React SPA (Vite)
│   ├── public/              cloudhawk.png (brand logo)
│   └── src/{api,context,components,pages,utils}
└── docs/                    SRS, diagrams, API, deployment, testing
```

## Project Workflow

### System architecture
```mermaid
flowchart LR
  U["Employee / Admin<br/>(Browser)"] -->|HTTPS| FE["React SPA<br/>Vite :5173"]
  FE -->|"Axios · Bearer token + X-CSRF"| API["PHP REST API<br/>backend/public/index.php"]
  API --> MW["Auth + CSRF Middleware"]
  MW --> CTRL["Controllers"]
  CTRL --> SVC["Services / Models<br/>(PayrollService, AttendanceService)"]
  SVC --> DB[("MySQL / MariaDB")]
  API --> UP["/uploads<br/>selfies · receipts · documents/"]
  FE -. "Leaflet" .-> OSM["OpenStreetMap tiles"]
  FE -. "face-api.js (in-browser)" .-> FACE["Face descriptor match"]
```

### Attendance check-in / out flow
```mermaid
flowchart TD
  A["Login (RBAC)"] --> B["Mark Attendance page"]
  B --> C["Capture GPS<br/>(watchPosition refine, drag-pin correct)"]
  C --> D["Live selfie"]
  D --> E["Face verify vs enrolled descriptor"]
  E --> F{"Approved WFH today?"}
  F -- Yes --> H["Location allowed (anywhere)"]
  F -- No --> G{"Inside an office geofence?<br/>(any branch · ~100m)"}
  G -- No --> X["Blocked — outside office"]
  G -- Yes --> H
  H --> I["Check-in: open session<br/>status = Working · log 'login' · record branch"]
  I --> J["Work-tracking state machine runs"]
  J --> K["Check-out / Logout<br/>finalize session + day totals"]
  K --> DB[("Persist to MySQL")]
```

### Work-tracking state machine
```mermaid
stateDiagram-v2
  [*] --> Working: Check-in
  Working --> Rest: screen off / lock / sleep
  Rest --> Working: screen on
  Working --> Overtime: 6:30 PM popup → Continue Working
  Overtime --> Rest: screen off / lock / sleep
  Rest --> Overtime: screen on (overtime active)
  Working --> LoggedOut: Logout / Check-out
  Overtime --> LoggedOut: Logout
  LoggedOut --> [*]
```

> 🟢 Working · 🟡 Rest Mode · 🔵 Overtime · ⚫ Logged Out — surfaced live on the
> **Admin Live Status** board and the employee dashboard timeline.

### Leave / WFH approval flow
```mermaid
flowchart TD
  A["Employee applies leave<br/>(type incl. Work From Home)"] --> B["Status: Pending"]
  B --> C["Notification → Admin / HR"]
  C --> D{"Admin decision"}
  D -- Approve --> E["Status: Approved"]
  D -- Reject --> F["Status: Rejected"]
  B -. employee .-> G["Cancel (while pending)"]
  E --> H{"Leave type = Work From Home?"}
  H -- Yes --> I["On those dates: check-in/out<br/>allowed from anywhere · marked WFH"]
  H -- No --> J["Days counted as paid leave<br/>(deducted from leave balance)"]
  E --> K["Reflected in Calendar · Payroll · Balance"]
```

### Payroll calculation flow (attendance-driven)
```mermaid
flowchart TD
  M["Select month + employee"] --> W["Working days =<br/>calendar − Sundays − holidays"]
  W --> R["Per-day rate = monthly salary ÷ working days"]
  subgraph DED["Deductions (−)"]
    A1["Absent days × per-day"]
    A2["Half-days × ½ per-day"]
    A3["Late penalty: ⌊lates ÷ N⌋ × per-day"]
  end
  subgraph ADD["Additions (+)"]
    O1["Overtime hours × ₹/hour<br/>(time past office end)"]
  end
  R --> DED
  R --> ADD
  DED --> N["Net Pay = salary − deductions + overtime"]
  ADD --> N
  N --> P["Payslip (breakdown) · printable PDF"]
```

### Expense claim flow
```mermaid
flowchart TD
  A["Employee submits expense<br/>(amount, category, receipt upload)"] --> B["Status: Pending"]
  B --> C["Receipt stored in /uploads/receipts"]
  B --> D["Notification → Admin / HR"]
  D --> E{"Admin review"}
  E -- Approve --> F["Status: Approved<br/>(counted in totals)"]
  E -- Reject --> G["Status: Rejected (with remark)"]
  F --> H["Visible in employee + admin expense lists"]
```

### Attendance regularization flow
```mermaid
flowchart TD
  A["Employee opens Regularization"] --> B["Request correction<br/>(date, type, reason)"]
  B --> C["Status: Pending"]
  C --> D["Notification → Manager / Admin"]
  D --> E{"Review"}
  E -- Approve --> F["Attendance record corrected<br/>(present / time fixed)"]
  E -- Reject --> G["Status: Rejected (with remark)"]
  F --> H["Reflected in Calendar · Payroll"]
```

### Roles & access (RBAC)
```mermaid
flowchart TD
  subgraph SA["🛡️ Super Admin"]
    SA1["All Admin powers"]
    SA2["System Settings · Geofences"]
    SA3["Security / audit logs"]
  end
  subgraph AD["👔 Admin / HR"]
    AD1["Employees · Departments · Shifts"]
    AD2["Approve leave / expense / regularization"]
    AD3["Payroll · Reports · Clients · Purchases"]
    AD4["Notices · Holidays · Tasks · Live Status"]
  end
  subgraph EM["👤 Employee"]
    EM1["Mark attendance (GPS + selfie + face)"]
    EM2["Apply leave / WFH · expenses · regularization"]
    EM3["My tasks · tickets · documents · payslip"]
    EM4["Manager extra: My Team"]
  end
  SA --> AD --> EM
```

### Use-case diagram
```mermaid
flowchart LR
  EMP(["👤 Employee"])
  ADM(["👔 Admin / HR"])
  SAD(["🛡️ Super Admin"])

  EMP --> UC1["Mark attendance<br/>(GPS+selfie+face)"]
  EMP --> UC2["Apply leave / WFH"]
  EMP --> UC3["Submit expense"]
  EMP --> UC4["Request regularization"]
  EMP --> UC5["Tasks · tickets · documents · payslip"]

  ADM --> UC6["Manage employees / shifts"]
  ADM --> UC7["Approve leave / expense / regularization"]
  ADM --> UC8["Payroll · reports"]
  ADM --> UC9["Notices · holidays · tasks"]
  ADM --> UC10["Clients · purchases · Live Status"]

  SAD --> UC11["System settings · geofences"]
  SAD --> UC12["Security / audit logs"]

  ADM -. "is also a" .-> EMP
  SAD -. "is also an" .-> ADM
```

### Authentication & session sequence
```mermaid
sequenceDiagram
  participant B as Browser (React)
  participant A as PHP API
  participant D as MySQL
  B->>A: POST /auth/login (email, password)
  A->>D: verify credentials, create session
  D-->>A: session row
  A-->>B: token + csrf_token (stored client-side)
  Note over B,A: Subsequent requests
  B->>A: GET/POST /... (Authorization: Bearer, X-CSRF-Token)
  A->>A: AuthMiddleware + CsrfMiddleware
  A->>D: query / mutate
  D-->>A: data
  A-->>B: 200 OK
  Note over B,A: On expiry / invalid token
  A-->>B: 401 Unauthorized
  B->>B: clear token → redirect /login
```

### Deployment (XAMPP)
```mermaid
flowchart LR
  subgraph DEV["Development"]
    V["Vite dev server<br/>:5173"]
  end
  subgraph XAMPP["XAMPP (localhost)"]
    AP["Apache<br/>backend/public"]
    PH["PHP 8.2 (PDO)"]
    MY[("MySQL :3306")]
    UPL["/uploads<br/>selfies · receipts · docs"]
  end
  B["Browser"] --> V
  V -->|"proxy /GeoAttendPro/backend/public"| AP
  B -->|"production: serve dist/"| AP
  AP --> PH --> MY
  PH --> UPL
  PRD["npm run build → frontend/dist"] -.-> AP
```

### Entity-Relationship (core)
```mermaid
erDiagram
  ROLES ||--o{ USERS : "role_id"
  DEPARTMENTS ||--o{ USERS : "department_id"
  DESIGNATIONS ||--o{ USERS : "designation_id"
  SHIFTS ||--o{ USERS : "shift_id"
  USERS ||--o{ USERS : "manager_id"

  USERS ||--o{ ATTENDANCE : "daily summary"
  USERS ||--o{ ATTENDANCE_SESSIONS : "per check-in"
  ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_EVENTS : "timeline"
  GEOFENCES ||--o{ ATTENDANCE : "branch / validation"

  LEAVE_TYPES ||--o{ LEAVES : "type"
  USERS ||--o{ LEAVES : "applies"
  USERS ||--o{ REGULARIZATIONS : "requests"
  USERS ||--o{ EXPENSE_CLAIMS : "submits"
  USERS ||--o{ DOCUMENTS : "owns"
  USERS ||--o{ TICKETS : "raises"
  USERS ||--o{ TASKS : "assigned_to"
  USERS ||--o{ NOTIFICATIONS : "receives"
  USERS ||--o{ ANNOUNCEMENTS : "authors"
  USERS ||--o{ PURCHASES : "records"
  CLIENTS ||--o{ PURCHASES : "optional"
  HOLIDAYS }o--o{ ATTENDANCE : "working-day calc"

  USERS {
    int id PK
    string employee_code "CLHK-####"
    string full_name
    string email
    int role_id FK
    int department_id FK
    int shift_id FK
    int manager_id FK
    decimal monthly_salary
  }
  ATTENDANCE {
    bigint id PK
    int user_id FK
    date attendance_date
    datetime check_in_time
    datetime check_out_time
    int working_minutes
    int rest_seconds
    enum status "present/late/half_day/absent/leave/wfh"
    string branch
  }
  ATTENDANCE_SESSIONS {
    bigint id PK
    int user_id FK
    datetime check_in_time
    datetime check_out_time
    int working_minutes
    int rest_seconds
    enum work_status "working/rest/overtime/logged_out"
    int overtime_seconds
    string branch
  }
  ATTENDANCE_EVENTS {
    bigint id PK
    int user_id FK
    bigint session_id FK
    enum event_type "login/rest_start/rest_end/overtime_start/logout"
    datetime event_time
  }
  LEAVES {
    bigint id PK
    int user_id FK
    int leave_type_id FK
    date from_date
    date to_date
    enum status "pending/approved/rejected"
  }
  GEOFENCES {
    int id PK
    string name "branch"
    decimal latitude
    decimal longitude
    int radius_m
  }
```

## Features

### Attendance & location
- **GPS + live selfie** check-in / check-out, multiple sessions per day.
- **Face verification** (face-api.js) — captured selfie is matched against an enrolled face to stop proxy attendance.
- **Geofencing** — check-in/out allowed only inside an office geofence (e.g. 100m). Multiple **branches** supported (any active geofence matches); the matched branch is recorded per check-in.
- **Work From Home** — employees with an approved *Work From Home* leave can check in/out from anywhere.
- **Interactive map** (Leaflet) on the attendance page: shows the captured point + accuracy circle + office geofences; the pin can be dragged to the exact spot when GPS is coarse. GPS accuracy is refined via `watchPosition` (best-of, early-exit ≤25m).
- **Attendance Calendar** — month grid of present/late/half-day/leave/holiday, with **Sundays as company week-off**.
- **Regularization** — employees request corrections for missing/wrong attendance; admin approves.

### Smart work-tracking state machine
- States: 🟢 **Working** · 🟡 **Rest Mode** · 🔵 **Overtime** · ⚫ **Logged Out**.
- **Rest** is detected only on genuine **screen-off / lock / sleep** (clock-gap while the tab stays visible) — switching browser tabs/apps never counts as rest.
- **6:30 PM popup** ("standard working duration reached") → *Logout* or *Continue Working*; continuing starts **Overtime mode** with a reminder every 30 minutes.
- Full **timeline** per day (login, rest start/end, overtime start, logout) in `attendance_events`.
- **Admin Live Status board** — real-time per-employee status + Login/Active/Rest/Overtime durations (15s auto-refresh).

### Leave, payroll & finance
- **Leave management** — apply / approve / reject / cancel, leave types with yearly limits, **per-type leave balance**.
- **Payroll** (attendance-driven): working days = calendar − Sundays − holidays; per-day rate; deductions for **absent**, **half-days** and a configurable **late penalty** (N lates = 1 day cut); **overtime incentive** (₹/hour past office end time) added on top; printable payslip with full breakdown.
- **Expense claims** with receipt upload and approve/reject.
- **Clients / Customers / Vendors** management and **Purchases** (office product entries).

### Workforce & communication
- **Employee management**, departments, designations, **shifts** (per-employee timing & late rules), **manager hierarchy** ("My Team").
- **Notice Board** (announcements, pinned), **Holidays** (with recurring), **Tasks** (assign + status), **Help Desk** tickets.
- **Celebrations** — birthday & work-anniversary alerts.
- **Documents** — per-employee document upload.
- **Notifications** (in-app) + email hooks; **activity / security audit log**.

### Dashboards & reporting
- **Employee dashboard** — quick actions, attendance %, today vs monthly hours, monthly hours target, live work status + timeline, net pay, open tasks/tickets, latest notice, upcoming holidays, celebrations.
- **Admin dashboard** — live counters, status pie, daily/monthly trends, department breakdown, recent check-ins, pending leaves.
- **Reports** with charts and **PDF export** (jsPDF).
- **Settings** — work start/end time, late grace, half/full-day minutes, late-per-deduction, overtime rate, geofence enforcement & geofence map picker.

### Platform
- **RBAC**: Super Admin, Admin/HR, Employee. CSRF on state-changing routes; opaque token sessions.
- Employee IDs use the **`CLHK-####`** prefix.
- **CloudHawk** branding (logo + name) across landing, auth and app shell.

## Database migrations

`schema.sql` + `seed.sql` create the base; phase migrations add later features (idempotent):

| Migration | Adds |
|-----------|------|
| `phase2.php` | shifts, regularizations, users.shift_id/manager_id |
| `phase3.php` | documents, face descriptor |
| `phase5.php` | clients, purchases |
| `phase6.php` | announcements, expense_claims, tasks, tickets |
| `phase7.php` | attendance(.rest_seconds) — active vs rest time |
| `phase8.php` | work_status, overtime, rest/overtime markers, attendance_events timeline |
| `phase9.php` | attendance(.branch) — multi-branch tracking |

```bash
cd backend
"D:/xampp/php/php.exe" console/migrate.php     # base schema + seed
"D:/xampp/php/php.exe" database/phase2.php      # then run phase3..phase9 in order
```

## Quick start

### 1. Database
```bash
# Ensure MySQL/MariaDB is running. Configure backend/.env (DB_HOST/PORT/USER/PASS).
cd backend
php console/migrate.php        # creates schema + seed data
# run phase2.php … phase9.php (above) to apply all features
```

### 2. Backend API
Serve `backend/public` via Apache (XAMPP) at `http://localhost/GeoAttendPro/backend/public`,
or for development:
```bash
cd backend/public
php -S 127.0.0.1:8000 index.php
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (Vite proxies API to Apache)
```
Set `frontend/.env` → `VITE_API_BASE_URL` to the backend URL.

### Default logins
| Role        | Email                          | Password      |
|-------------|--------------------------------|---------------|
| Super Admin | superadmin@geoattend.test      | Admin@123     |
| Admin / HR  | hr@geoattend.test              | Admin@123     |
| Employee    | john@geoattend.test            | Employee@123  |

> Browser geolocation + camera require **HTTPS or localhost**. On `localhost` both work in dev.
> A laptop has no GPS chip, so it uses WiFi/IP location (coarse) — drag the map pin to correct it,
> or mark attendance from a phone for precise GPS.

## Documentation
See [`docs/`](docs/):
1. [Software Requirements Specification](docs/01-SRS.md)
2. [System Architecture, Sequence & Workflow Diagrams](docs/02-architecture.md)
3. [ER Diagram & Database Design](docs/03-database.md)
4. [API Design](docs/04-api.md)
5. [Security & Validation Rules](docs/05-security-and-validation.md)
6. [Deployment Guide](docs/06-deployment.md)
7. [Testing Plan](docs/07-testing.md)

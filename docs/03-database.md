# ER Diagram & Database Design

Database: **`geoattend_pro`** · Engine: **InnoDB** · Charset: **utf8mb4**
Full DDL: [`backend/database/schema.sql`](../backend/database/schema.sql) · Seed: [`seed.sql`](../backend/database/seed.sql)

## 1. ER Diagram

```mermaid
erDiagram
    ROLES        ||--o{ USERS          : "has"
    DEPARTMENTS  ||--o{ USERS          : "employs"
    DESIGNATIONS ||--o{ USERS          : "titles"
    DEPARTMENTS  ||--o{ DESIGNATIONS   : "groups"
    USERS        ||--o{ ATTENDANCE     : "marks"
    USERS        ||--o{ LEAVES         : "requests"
    USERS        ||--o{ USER_SESSIONS  : "owns"
    USERS        ||--o{ LOGIN_HISTORY  : "logs"
    USERS        ||--o{ ACTIVITY_LOGS  : "acts"
    USERS        ||--o{ NOTIFICATIONS  : "receives"
    LEAVE_TYPES  ||--o{ LEAVES         : "categorizes"
    USERS        ||--o{ LEAVES         : "approves"

    ROLES {
        tinyint id PK
        varchar name
        varchar slug UK
    }
    DEPARTMENTS {
        int id PK
        varchar name UK
        enum status
    }
    DESIGNATIONS {
        int id PK
        varchar name
        int department_id FK
    }
    USERS {
        int id PK
        varchar employee_code UK
        varchar full_name
        varchar email UK
        varchar password_hash
        tinyint role_id FK
        int department_id FK
        int designation_id FK
        date joining_date
        enum status
    }
    ATTENDANCE {
        bigint id PK
        int user_id FK
        date attendance_date
        datetime check_in_time
        datetime check_out_time
        decimal check_in_lat
        decimal check_in_lng
        varchar check_in_selfie
        varchar ip_address
        int working_minutes
        tinyint is_late
        enum status
    }
    LEAVES {
        bigint id PK
        int user_id FK
        int leave_type_id FK
        date from_date
        date to_date
        smallint total_days
        enum status
        int approved_by FK
    }
    LEAVE_TYPES {
        int id PK
        varchar name UK
        smallint max_days_year
    }
    USER_SESSIONS {
        char id PK
        int user_id FK
        datetime expires_at
        datetime last_activity
    }
    LOGIN_HISTORY {
        bigint id PK
        int user_id FK
        datetime login_at
        datetime logout_at
        enum status
    }
    ACTIVITY_LOGS {
        bigint id PK
        int user_id FK
        varchar action
        varchar entity
    }
    NOTIFICATIONS {
        bigint id PK
        int user_id FK
        varchar type
        tinyint is_read
    }
    GEOFENCES {
        int id PK
        decimal latitude
        decimal longitude
        int radius_m
    }
    SETTINGS {
        varchar key_name PK
        varchar value
    }
    PASSWORD_RESETS {
        bigint id PK
        varchar email
        char token_hash
        datetime expires_at
    }
```

## 2. Table Summary

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `roles` | RBAC roles | `slug` unique |
| `departments` | Org departments | `name` unique |
| `designations` | Job titles | FK → departments |
| `users` | Auth + employee identity | `email`, `employee_code` unique; FKs role/dept/desig |
| `attendance` | One row per user per day | **UNIQUE(user_id, attendance_date)** ← duplicate guard |
| `leave_types` | Leave categories | `name` unique |
| `leaves` | Leave requests + approval | FKs user, type, approver |
| `geofences` | Allowed zones | radius in metres |
| `user_sessions` | Token sessions | `expires_at` indexed; FK user |
| `login_history` | Login/logout/expiry audit | status enum |
| `activity_logs` | Action audit trail | action indexed |
| `password_resets` | Reset tokens | `token_hash`, single-use |
| `notifications` | In-app + email | `is_read` indexed |
| `settings` | Key/value config | PK key_name |

## 3. Key Design Decisions
- **Unified `users` table** for auth + employee identity (an employee *is* a login).
- **`UNIQUE(user_id, attendance_date)`** enforces "one check-in per day" at the DB level —
  immune to application race conditions.
- **Coordinates** stored as `DECIMAL(10,7)` (~1 cm precision) — exact, unlike floats.
- **Sessions in DB** (not just JWT) so they can be force-expired/revoked (suspend user, password change).
- **`ON DELETE CASCADE`** for attendance/sessions/notifications; **`SET NULL`** for optional FKs.

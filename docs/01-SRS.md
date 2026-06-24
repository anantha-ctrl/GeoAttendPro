# Software Requirements Specification (SRS)
## GeoAttend Pro — Smart Web-Based Employee Attendance & Workforce Tracking System

**Version:** 1.0   **Date:** 2026-06-18

---

## 1. Introduction

### 1.1 Purpose
GeoAttend Pro lets organizations **without a fixed office** track attendance of remote / field
employees. Attendance is verified with **GPS coordinates**, a **live selfie**, and a
**server-side timestamp**, making proxy or fake attendance impractical.

### 1.2 Scope
The system provides authentication & RBAC, employee management, GPS+selfie attendance,
leave management, dashboards, reporting/export, notifications, and a complete security/audit layer.

### 1.3 Definitions
| Term | Meaning |
|------|---------|
| RBAC | Role-Based Access Control |
| Geofence | Circular allowed zone (lat/lng + radius) |
| WFH | Work From Home |
| SPA | Single Page Application (React frontend) |

### 1.4 Actors
- **Super Admin** — full control incl. settings, admin accounts, active sessions.
- **Admin / HR** — manage employees, attendance, leaves, reports.
- **Employee** — mark attendance, apply leave, view own data.

---

## 2. Overall Description

### 2.1 Product Perspective
A decoupled system: a **PHP REST API** + **MySQL** backend and a **React SPA** frontend
communicating over JSON/HTTPS. Stateless token auth allows horizontal scaling.

### 2.2 Assumptions & Constraints
- Browsers must grant **Geolocation** and **Camera** permissions (HTTPS/localhost required).
- Server time is authoritative for all timestamps.
- Images stored on local disk (`public/storage/uploads`); swappable for S3.

---

## 3. Functional Requirements

### FR-1 Authentication
- FR-1.1 Login with email + password (bcrypt verified).
- FR-1.2 Logout invalidates the session token.
- FR-1.3 Forgot password issues a tokenized, time-limited reset link (email).
- FR-1.4 Reset password consumes a single-use token and invalidates existing sessions.
- FR-1.5 Sessions expire after **5 hours** (configurable); expired sessions are auto-logged-out.
- FR-1.6 Login/logout/expiry events are recorded in `login_history`.
- FR-1.7 Role-based authorization on every protected endpoint.

### FR-2 Employee Management
- Add / edit / delete employees; auto-generated Employee Code (EMP-XXXX).
- Manage departments and designations.
- Activate / deactivate / suspend (suspension force-logs-out the user).
- Search & filter by name/email/code/phone, department, designation, role, status (paginated).
- Fields: Employee ID, Full Name, Email, Phone, Department, Designation, Address,
  Joining Date, Profile Photo, Status.

### FR-3 Attendance
- Workflow: login → GPS permission → live selfie → check-in → check-out → history.
- Stored: user, check-in/out time, lat/lng (in & out), selfies, IP, device, status, working minutes.
- Statuses: Present, Late, Half Day, Absent, Leave, WFH.
- Rules: **one check-in per day** (DB unique constraint), duplicate prevention, auto working-hours,
  auto late detection, auto attendance percentage.

### FR-4 GPS Verification
- Real-time capture via browser Geolocation API; lat/lng persisted.
- Location displayed (Google Maps link) to admins.
- **Geo-fencing ready**: validates against active geofences when enabled in settings.

### FR-5 Selfie Verification
- Live camera capture (or upload), stored as attendance proof, linked to each check-in/out.

### FR-6 Admin Dashboard
- Widgets: Total Employees, Present/Absent/Late Today, Total Check-Ins, Attendance %, On-Leave, Pending Leaves.
- Charts: Daily (line), Monthly (bar), Department breakdown (doughnut).

### FR-7 Employee Dashboard
- Today's status, check-in/out actions, monthly %, work-hour summary, recent history, profile.

### FR-8 Leave Management
- Apply (with overlap detection), approve/reject (with remarks), cancel, history, statuses.
- Approval stamps `attendance` rows as `leave` across the date range.

### FR-9 Reports
- Daily, Monthly, Employee-wise, Department-wise, Late, Leave.
- Export: **CSV (Excel)**, **printable HTML → PDF**, browser print.

### FR-10 Notifications
- Attendance reminder, late alert, leave-status updates; in-app + optional email.

### FR-11 Security
- CSRF protection, session timeout, RBAC, duplicate-attendance prevention,
  activity logs, login history, IP & device tracking.

---

## 4. Non-Functional Requirements
| ID | Requirement |
|----|-------------|
| NFR-1 Performance | API responses < 300 ms for typical queries; indexed tables. |
| NFR-2 Security | Bcrypt hashing, prepared statements, CSRF, output encoding, least-privilege RBAC. |
| NFR-3 Usability | Responsive, mobile-first UI (Bootstrap 5). |
| NFR-4 Reliability | Atomic attendance writes; unique constraints prevent race duplicates. |
| NFR-5 Scalability | Stateless tokens, decoupled SPA/API, pluggable storage. |
| NFR-6 Maintainability | Clean MVC, PSR-4 autoload, documented modules. |
| NFR-7 Auditability | All sensitive actions logged with actor, IP, timestamp. |

## 5. Acceptance Criteria (samples)
- Logging in twice on the same day and attempting two check-ins returns HTTP 409.
- A POST without a valid `X-CSRF-Token` returns HTTP 419.
- A session older than 5 hours returns HTTP 401 and is deleted.
- Reports export downloads a valid CSV and opens a printable HTML view.

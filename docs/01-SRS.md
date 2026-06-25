# Software Requirements Specification (SRS)
## CloudHawk — Smart Web-Based Employee Attendance & Workforce Tracking System

**Version:** 2.0   **Date:** 2026-06-25   *(formerly GeoAttend Pro)*

---

## 1. Introduction

### 1.1 Purpose
CloudHawk lets organizations **with or without a fixed office** track attendance of office,
remote and field employees. Attendance is verified with **GPS geofencing**, a **live selfie**,
**in-browser face verification**, and a **server-side timestamp**, making proxy or fake
attendance impractical.

### 1.2 Scope
The system provides authentication & RBAC, employee management, GPS+selfie+face attendance,
a real-time **work-tracking state machine** (Working → Overtime → Logged Out), leave & WFH
management, **attendance-driven payroll**, expense claims, regularization, tasks, help-desk
tickets, documents, notices, holidays, shifts, multi-branch geofencing, dashboards,
reporting/export, notifications, and a complete security/audit layer.

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
- Add / edit / delete employees; auto-generated Employee Code (**`CLHK###`**, e.g. `CLHK001`).
- Manage departments and designations.
- Activate / deactivate / suspend (suspension force-logs-out the user).
- Search & filter by name/email/code/phone, department, designation, role, status (paginated).
- Fields: Employee ID, Full Name, Email, Phone, Department, Designation, Address,
  Joining Date, Profile Photo, Status.

### FR-3 Attendance
- Workflow: login → GPS (geofence check) → live selfie → face verify → check-in →
  work-tracking → **work summary** → check-out → history.
- **Multiple sessions per day** — each check-in/out pair is an `attendance_sessions` row; the
  `attendance` table keeps the one-per-day summary. A **work summary note** is required at check-out
  and stored on the session.
- Stored: user, check-in/out time, lat/lng (in & out), selfies, IP, device, status, working minutes,
  matched **branch**, work note.
- Statuses: Present, Late, Half Day, Absent, Leave, WFH.
- **Sundays are a company week-off**; holidays excluded from working-day calculations.
- Rules: duplicate prevention, auto working-hours, auto late detection, auto attendance percentage.

### FR-3a Work-Tracking State Machine
- On check-in a session opens in **Working**; work time is auto-tracked.
- At the configured **work-end time** a popup offers *Logout* or *Continue Working*; continuing
  enters **Overtime** mode with a reminder every 30 minutes.
- States 🟢 Working · 🔵 Overtime · ⚫ Logged Out are surfaced on the **Admin Live Status** board
  (15s refresh) and the employee dashboard timeline (`attendance_events`).

### FR-4 GPS Verification & Geofencing
- Real-time capture via browser Geolocation API (refined with `watchPosition`); lat/lng persisted.
- Interactive Leaflet map with a **draggable pin** to correct coarse GPS; office geofences shown.
- **Geofence enforcement** (≈100m): check-in/out allowed only inside an active office geofence.
  **Multiple branches** supported (any active geofence matches; matched branch recorded).
- **Work From Home**: employees with an approved *Work From Home* leave can check in/out from anywhere.

### FR-5 Selfie & Face Verification
- Live camera capture, stored as attendance proof, linked to each check-in/out.
- **Face verification** (face-api.js, in-browser): the captured selfie is matched against the
  employee's enrolled face descriptor to block proxy attendance.

### FR-5a Payroll, Expenses & Workforce
- **Payroll** (attendance-driven): working days = calendar − Sundays − holidays; per-day rate;
  deductions for absent/half-days and a configurable late penalty; **overtime incentive** added;
  printable payslip with full breakdown.
- **Expense claims** (receipt upload, approve/reject), **regularization** requests,
  **tasks**, **help-desk tickets**, **documents**, **notices**, **holidays**, **shifts**,
  **clients/purchases**, and **celebrations** (birthday / work-anniversary).

### FR-6 Admin Dashboard
- Widgets: Total Employees, Present/Absent/Late Today, Total Check-Ins, Attendance %, On-Leave, Pending Leaves.
- Charts: Daily (line), Monthly (bar), Department breakdown (doughnut).

### FR-7 Employee Dashboard
- Quick actions, attendance %, today vs monthly hours (Worked/Overtime), monthly hours target,
  live work status + timeline, **payslip summary** (base / overtime / deductions / net pay),
  open tasks/tickets, latest notice, upcoming holidays, celebrations, recent history.
- **Mobile-responsive shell** — off-canvas sidebar + hamburger (≤991px), centered brand, and a
  top-right **profile dropdown** (My Profile · Change Password · Settings · Logout).

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

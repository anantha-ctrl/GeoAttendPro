# System Architecture, Sequence & Workflow Diagrams

> Diagrams use **Mermaid** — render on GitHub, VS Code (Markdown Preview Mermaid), or mermaid.live.

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser / Mobile Web)"]
        SPA["React SPA<br/>Router · Axios · Chart.js"]
        GEO["Geolocation API"]
        CAM["MediaDevices Camera API"]
    end

    subgraph Server["Web Server (Apache / XAMPP)"]
        FC["Front Controller<br/>public/index.php"]
        subgraph API["PHP REST API (Clean MVC)"]
            RT["Router"]
            MW["Middleware<br/>Auth · CSRF"]
            CTRL["Controllers"]
            SVC["Services / Support<br/>Attendance · Geo · Mailer"]
            MOD["Models (PDO)"]
        end
        UP["Uploads<br/>public/storage/uploads"]
    end

    DB[("MySQL / MariaDB<br/>geoattend_pro")]
    MAIL["SMTP / mail.log"]
    CRON["Cron worker<br/>console/cron.php"]

    SPA -->|JSON over HTTPS<br/>Bearer + X-CSRF-Token| FC
    GEO --> SPA
    CAM --> SPA
    FC --> RT --> MW --> CTRL --> SVC --> MOD --> DB
    CTRL --> UP
    SVC --> MAIL
    CRON --> DB
    CRON --> MAIL
```

## 2. Layered / Clean Architecture

```mermaid
flowchart LR
    A["HTTP Request"] --> B["Router"]
    B --> C["Middleware<br/>(Auth, CSRF)"]
    C --> D["Controller<br/>(validation, orchestration)"]
    D --> E["Service / Support<br/>(business rules)"]
    E --> F["Model<br/>(data access, PDO)"]
    F --> G[("Database")]
    D --> H["Response (JSON envelope)"]
```

## 3. Attendance Workflow

```mermaid
flowchart TD
    Start([Employee opens Mark Attendance]) --> Auth{Authenticated?}
    Auth -- No --> Login[Redirect to Login]
    Auth -- Yes --> Open{Open session today?}
    Open -- No --> GPS[Capture GPS · drag-pin correct]
    GPS --> Selfie[Live selfie]
    Selfie --> Face[Face verify vs enrolled descriptor]
    Face --> WFH{Approved WFH today?}
    WFH -- Yes --> CIn[POST /attendance/check-in<br/>allowed anywhere · status wfh]
    WFH -- No --> Fence{Inside an office geofence?<br/>any branch · ~100m}
    Fence -- Outside --> Reject[422 Outside allowed location]
    Fence -- Inside --> CIn
    CIn --> Save[Open session · status Working<br/>record branch · log 'login']
    Save --> Late{After start time + grace?}
    Late -- Yes --> MarkLate[status = late]
    Late -- No --> MarkPresent[status = present]
    Open -- Yes, no checkout --> Note[Type work summary]
    Note --> COut[POST /attendance/check-out<br/>+ work_note · geofence/WFH enforced]
    COut --> Calc[Compute working minutes + final status]
    Calc --> Done([Session complete · multiple/day])
    MarkLate --> Done
    MarkPresent --> Done
```

> After check-in the **work-tracking state machine** runs (Working → Overtime → Logged Out): a
> work-end popup offers *Logout / Continue Working*; the **Admin Live Status** board reflects each
> employee's state in real time. See README → *Work-tracking state machine*.

## 4. Sequence Diagram — Check-In

```mermaid
sequenceDiagram
    participant U as Employee (SPA)
    participant B as Browser APIs
    participant A as PHP API
    participant DB as MySQL

    U->>B: getCurrentPosition()
    B-->>U: {lat, lng}
    U->>B: getUserMedia() + capture frame
    B-->>U: selfie (base64)
    U->>A: POST /attendance/check-in (Bearer, X-CSRF-Token)
    A->>A: AuthMiddleware (validate session, <5h)
    A->>A: CsrfMiddleware (verify token)
    A->>DB: SELECT attendance WHERE user+date
    DB-->>A: none
    A->>A: Geo::withinFence(lat,lng)
    A->>A: Uploader::fromBase64(selfie)
    A->>A: AttendanceService::isLate(now)
    A->>DB: INSERT attendance (unique user+date)
    DB-->>A: id
    A-->>U: 201 {is_late, check_in_time, selfie}
```

## 5. Sequence Diagram — Login + Session

```mermaid
sequenceDiagram
    participant U as User (SPA)
    participant A as PHP API
    participant DB as MySQL

    U->>A: POST /auth/login {email, password}
    A->>DB: SELECT user by email
    DB-->>A: user row
    A->>A: password_verify()
    A->>DB: INSERT user_sessions (token, expires=+5h)
    A->>DB: INSERT login_history (success)
    A-->>U: {token, csrf_token, user}
    Note over U: store token + csrf in localStorage
    U->>A: GET /dashboard (Bearer)
    A->>DB: SELECT session WHERE id=token
    A->>A: expires_at < now? → 401 + delete
    A->>DB: UPDATE last_activity
    A-->>U: data
```

## 6. Deployment Topology

```mermaid
flowchart LR
    User -->|HTTPS| LB["Reverse Proxy / Apache"]
    LB --> Static["Static SPA build<br/>(dist/)"]
    LB --> PHP["PHP-FPM / Apache mod_php<br/>backend/public"]
    PHP --> DBP[("MySQL")]
    Sched["OS Scheduler"] --> Cron["php console/cron.php (hourly)"]
    Cron --> DBP
```

# Testing Plan

## 1. Strategy
| Level | Scope | Tooling |
|-------|-------|---------|
| Unit | Services/helpers (AttendanceService, Geo, Validator) | PHPUnit |
| Integration | Controller + DB via HTTP | curl / Postman / PHPUnit + http |
| E2E | SPA flows in a browser | Playwright / Cypress (manual checklist below) |
| Security | RBAC, CSRF, session expiry | Manual + automated assertions |

## 2. Smoke test (already verified)
The following were executed against `php -S` + MariaDB and **passed**:
- `POST /auth/login` → returns token, csrf, role `super_admin`.
- `GET /auth/me` with Bearer → 200.
- `GET /dashboard/admin` → counters returned.
- `POST /employees` without CSRF → **419**; with CSRF → **201** (auto code `CLHK004`).
- `POST /attendance/check-in` (employee) → 201, `is_late=true`, selfie stored.
- Duplicate `check-in` same day → **409**.
- `POST /attendance/check-out` → working minutes + final status.

Reproduce: see `docs/04-api.md` curl examples.

## 3. Functional test cases

### Authentication
| # | Case | Expected |
|---|------|----------|
| A1 | Valid login | 200 + token |
| A2 | Wrong password | 401, logged as failed |
| A3 | Suspended account login | 403 |
| A4 | Request after 5h | 401 + session deleted |
| A5 | Forgot → reset with valid token | password updated, sessions cleared |
| A6 | Reset with used/expired token | 422 |

### Employee management
| # | Case | Expected |
|---|------|----------|
| E1 | Create employee (admin) | 201, code auto-generated |
| E2 | Duplicate email | 422 |
| E3 | Employee creates employee | 403 |
| E4 | Non-super-admin creates admin | 403 |
| E5 | Search/filter/paginate | correct subset + meta |
| E6 | Suspend user | sessions force-cleared |

### Attendance
| # | Case | Expected |
|---|------|----------|
| T1 | Check-in with GPS+selfie | 201 |
| T2 | Second check-in same day | 409 |
| T3 | Check-out before check-in | 409 |
| T4 | Late check-in (after start+grace) | `is_late=true`, alert created |
| T5 | Geofence enabled, outside radius | 422 |
| T6 | Working hours after check-out | minutes computed, status derived |

### Leave
| # | Case | Expected |
|---|------|----------|
| L1 | Apply valid leave | 201 pending, admins notified |
| L2 | Overlapping leave | 409 |
| L3 | to_date < from_date | 422 |
| L4 | Approve | attendance rows stamped `leave`, employee notified |
| L5 | Employee approves | 403 |

### Reports
| # | Case | Expected |
|---|------|----------|
| R1 | Daily JSON | rows + headers |
| R2 | `?format=csv` | CSV download |
| R3 | `?format=html` | printable page |
| R4 | Employee accesses reports | 403 |

### Security
| # | Case | Expected |
|---|------|----------|
| S1 | Write without CSRF | 419 |
| S2 | Access admin route as employee | 403 |
| S3 | SQL injection in search (`' OR 1=1`) | treated as literal, no leak |
| S4 | XSS payload in report cell | escaped |
| S5 | Upload non-image | 422 |

## 4. Example PHPUnit skeleton
```php
final class AttendanceServiceTest extends \PHPUnit\Framework\TestCase
{
    public function testWorkingMinutes(): void
    {
        $m = \App\Services\AttendanceService::workingMinutes('2026-06-18 09:00:00', '2026-06-18 17:30:00');
        $this->assertSame(510, $m);
    }

    public function testHalfDayStatus(): void
    {
        // < half_day_minutes (240) => half_day
        $this->assertSame('half_day', \App\Services\AttendanceService::deriveStatus(false, 120));
    }
}
```

## 5. Browser E2E checklist (manual)
1. Login as employee on `localhost` → allow GPS + camera prompts.
2. Capture selfie + location (drag pin if GPS is coarse) → face verify → Check In → dashboard shows live status.
3. Type a **work summary** → Check Out → worked hours appear; summary shown in the day's sessions.
4. Past work-end time → popup *Logout / Continue Working*; Continue → Overtime mode + 30-min reminder.
5. Login as admin → dashboard charts render; **Live Status** board shows 🟢/🔵/⚫ per employee; daily attendance shows selfie + map link.
6. Apply leave / WFH (employee) → approve (admin) → notification badge increments; on a WFH date check-in is allowed from anywhere.
7. Open **Payroll** → payslip breakdown (deductions + overtime incentive) renders; export a report as CSV and Print/PDF.
8. Token expiry → next action returns 401 and redirects to login.

## 6. Performance / load (optional)
- Use `k6`/`ab` against `/auth/login` and `/attendance/today`; verify p95 < 300 ms with indexes in place.

# API Design

**Base URL (dev):** `http://localhost/GeoAttendPro/backend/public`
**Auth:** `Authorization: Bearer <token>` · **CSRF (writes):** `X-CSRF-Token: <csrf_token>`
**Content-Type:** `application/json`

## Response envelope
```jsonc
// success
{ "success": true,  "message": "OK", "data": { ... } }
// error
{ "success": false, "message": "Validation failed.", "errors": { "email": ["Enter a valid email address."] } }
```

## Status codes
| Code | Meaning |
|------|---------|
| 200/201 | OK / Created |
| 401 | Unauthenticated or session expired |
| 403 | Authenticated but not permitted (RBAC) |
| 404 | Not found |
| 409 | Conflict (duplicate check-in, overlapping leave) |
| 419 | CSRF token mismatch |
| 422 | Validation error |
| 500 | Server error |

## Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | – | Login, returns `{token, csrf_token, user}` |
| POST | `/auth/forgot-password` | – | Email a reset link |
| POST | `/auth/reset-password` | – | Reset with token (`password`,`password_confirmation`) |
| GET  | `/auth/me` | ✓ | Current user + fresh csrf token |
| POST | `/auth/logout` | ✓+CSRF | Invalidate session |
| POST | `/auth/change-password` | ✓+CSRF | Change own password |

### Lookups & Dashboards
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/lookups` | ✓ | roles, departments, designations, leave types |
| GET | `/dashboard/admin` | ✓ (admin) | counters + chart datasets |
| GET | `/dashboard/employee` | ✓ | own summary |

### Employees (admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees?search=&department_id=&status=&page=` | Paginated list |
| POST | `/employees` | Create (auto Employee Code) |
| GET | `/employees/{id}` | Detail (self allowed for employees) |
| PUT | `/employees/{id}` | Update |
| DELETE | `/employees/{id}` | Delete |
| PATCH | `/employees/{id}/status` | Activate/inactivate/suspend |

### Departments / Designations
`GET|POST /departments`, `PUT|DELETE /departments/{id}` — same shape for `/designations`.

### Attendance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance/today` | Today's record + can_checkin/checkout flags |
| POST | `/attendance/check-in` | `{latitude, longitude, selfie(base64)}` |
| POST | `/attendance/check-out` | `{latitude, longitude, selfie?}` |
| GET | `/attendance/history?from=&to=&page=&user_id=` | History (own; admin via user_id) |

### Leaves
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaves?status=&user_id=&page=` | List (own / all for admin) |
| GET | `/leaves/types` | Active leave types |
| POST | `/leaves` | Apply `{leave_type_id, from_date, to_date, reason}` |
| PATCH | `/leaves/{id}/approve` | Approve (`admin_remarks?`) |
| PATCH | `/leaves/{id}/reject` | Reject |
| PATCH | `/leaves/{id}/cancel` | Cancel own pending |

### Reports  *(append `?format=csv` or `?format=html`)*
`/reports/daily`, `/reports/monthly`, `/reports/employee`, `/reports/department`,
`/reports/late`, `/reports/leave`.

### Notifications / Profile / Security / Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications?limit=` | Items + unread count |
| PATCH | `/notifications/read` | Mark one (`id`) or all read |
| GET/PUT | `/profile` | View / edit own profile |
| GET | `/security/login-history` | Admin login audit |
| GET | `/security/activity-logs` | Admin action audit |
| GET | `/security/sessions` | Super-admin active sessions |
| GET/PUT | `/settings` | View / update (super-admin) config |
| GET/POST | `/geofences`, DELETE `/geofences/{id}` | Geofence management |

## Example — Check-in (curl)
```bash
curl -X POST $BASE/attendance/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"latitude":12.9716,"longitude":77.5946,"selfie":"data:image/jpeg;base64,..."}'
```

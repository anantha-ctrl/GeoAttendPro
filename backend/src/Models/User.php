<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class User extends BaseModel
{
    protected static string $table = 'users';
    protected static array $fillable = [
        'employee_code', 'full_name', 'email', 'phone', 'password_hash',
        'role_id', 'department_id', 'designation_id', 'shift_id', 'manager_id',
        'address', 'joining_date', 'monthly_salary', 'date_of_birth',
        'profile_photo', 'face_descriptor', 'status', 'must_change_password',
    ];

    public static function findByEmail(string $email): ?array
    {
        return Database::fetch('SELECT * FROM users WHERE email = ?', [$email]);
    }

    /** Joined view for listings (role/department/designation names). */
    public static function detailed(int $id): ?array
    {
        return Database::fetch(
            'SELECT u.*, r.name AS role_name, r.slug AS role_slug,
                    d.name AS department_name, dg.name AS designation_name,
                    s.name AS shift_name, s.start_time AS shift_start, s.end_time AS shift_end,
                    m.full_name AS manager_name,
                    (SELECT COUNT(*) FROM users sub WHERE sub.manager_id = u.id) AS subordinate_count
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN designations dg ON dg.id = u.designation_id
             LEFT JOIN shifts s ON s.id = u.shift_id
             LEFT JOIN users m ON m.id = u.manager_id
             WHERE u.id = ?',
            [$id]
        );
    }

    /** Paginated + filtered employee listing. */
    public static function paginate(array $filters, int $page, int $perPage): array
    {
        $where  = ['1 = 1'];
        $params = [];

        if (!empty($filters['search'])) {
            $where[] = '(u.full_name LIKE ? OR u.email LIKE ? OR u.employee_code LIKE ? OR u.phone LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        if (!empty($filters['department_id'])) {
            $where[] = 'u.department_id = ?';
            $params[] = $filters['department_id'];
        }
        if (!empty($filters['designation_id'])) {
            $where[] = 'u.designation_id = ?';
            $params[] = $filters['designation_id'];
        }
        if (!empty($filters['role_id'])) {
            $where[] = 'u.role_id = ?';
            $params[] = $filters['role_id'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'u.status = ?';
            $params[] = $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        $total = (int)Database::scalar("SELECT COUNT(*) FROM users u WHERE {$whereSql}", $params);

        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT u.id, u.employee_code, u.full_name, u.email, u.phone,
                    u.status, u.joining_date, u.profile_photo,
                    r.name AS role_name, d.name AS department_name, dg.name AS designation_name
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN designations dg ON dg.id = u.designation_id
             WHERE {$whereSql}
             ORDER BY u.id DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        return [
            'data' => $rows,
            'meta' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total'       => $total,
                'total_pages' => (int)ceil($total / $perPage),
            ],
        ];
    }

    /** Direct reports of a manager, with today's attendance status. */
    public static function team(int $managerId, string $date): array
    {
        return Database::fetchAll(
            'SELECT u.id, u.employee_code, u.full_name, u.email, u.profile_photo, u.status,
                    d.name AS department_name, dg.name AS designation_name, s.name AS shift_name,
                    a.check_in_time, a.check_out_time, a.status AS attendance_status,
                    a.is_late, a.working_minutes
             FROM users u
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN designations dg ON dg.id = u.designation_id
             LEFT JOIN shifts s ON s.id = u.shift_id
             LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = ?
             WHERE u.manager_id = ?
             ORDER BY u.full_name',
            [$date, $managerId]
        );
    }

    /** Candidate managers for assignment dropdowns (admins + HR + anyone already managing). */
    public static function managerOptions(): array
    {
        return Database::fetchAll(
            "SELECT id, full_name, employee_code FROM users
             WHERE status = 'active' ORDER BY full_name"
        );
    }

    /** Next sequential employee code, e.g. CLHK001. */
    public static function nextEmployeeCode(): string
    {
        $max = (int)Database::scalar(
            "SELECT MAX(CAST(SUBSTRING(employee_code, 5) AS UNSIGNED)) FROM users WHERE employee_code LIKE 'CLHK%'"
        );
        return 'CLHK' . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\User;
use App\Support\Activity;
use App\Support\Guard;
use App\Support\Uploader;

final class EmployeeController
{
    /** GET /employees */
    public function index(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 15)));
        $filters = [
            'search'         => $request->query['search'] ?? null,
            'department_id'  => $request->query['department_id'] ?? null,
            'designation_id' => $request->query['designation_id'] ?? null,
            'role_id'        => $request->query['role_id'] ?? null,
            'status'         => $request->query['status'] ?? null,
        ];
        Response::success(User::paginate($filters, $page, $perPage));
    }

    /** GET /employees/{id} */
    public function show(Request $request): void
    {
        $id = (int)$request->params['id'];
        // Employees may only view their own profile; admins view anyone.
        if (!Guard::isAdmin() && $id !== Auth::id()) {
            Response::error('Forbidden.', 403);
        }
        $user = User::detailed($id);
        if (!$user) {
            Response::error('Employee not found.', 404);
        }
        unset($user['password_hash']);
        Response::success($user);
    }

    /** POST /employees */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, [
            'full_name'      => 'required|max:150',
            'email'          => 'required|email',
            'phone'          => 'nullable|digits_between:7,15',
            'role_id'        => 'required|integer',
            'department_id'  => 'nullable|integer',
            'designation_id' => 'nullable|integer',
            'joining_date'   => 'nullable|date',
            'password'       => 'required|min:8',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $email = strtolower(trim((string)$request->input('email')));
        if (User::findByEmail($email)) {
            Response::error('Email already in use.', 422, ['email' => ['Email already in use.']]);
        }

        // Only super admin may create admins/super admins
        $roleId = (int)$request->input('role_id');
        if ($roleId !== 3 && !Guard::isSuperAdmin()) {
            Response::error('Only a Super Admin can create admin accounts.', 403);
        }

        $photo = null;
        if ($request->input('profile_photo')) {
            $photo = Uploader::fromBase64((string)$request->input('profile_photo'), 'profiles', 'emp');
        }

        $id = User::create([
            'employee_code'  => User::nextEmployeeCode(),
            'full_name'      => trim((string)$request->input('full_name')),
            'email'          => $email,
            'phone'          => $request->input('phone'),
            'password_hash'  => password_hash((string)$request->input('password'), PASSWORD_BCRYPT),
            'role_id'        => $roleId,
            'department_id'  => $request->input('department_id') ?: null,
            'designation_id' => $request->input('designation_id') ?: null,
            'shift_id'       => $request->input('shift_id') ?: null,
            'manager_id'     => $request->input('manager_id') ?: null,
            'monthly_salary' => $request->input('monthly_salary') !== '' ? $request->input('monthly_salary') : null,
            'date_of_birth'  => $request->input('date_of_birth') ?: null,
            'address'        => $request->input('address'),
            'joining_date'   => $request->input('joining_date') ?: null,
            'profile_photo'  => $photo,
            'status'         => $request->input('status', 'active'),
            'must_change_password' => 1,
        ]);

        Activity::log(Auth::id(), 'employee.create', 'users', (string)$id,
            'Created employee ' . $email, $request->ip());

        $created = User::detailed($id);
        unset($created['password_hash']);
        Response::success($created, 'Employee created.', 201);
    }

    /** PUT /employees/{id} */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        $existing = User::find($id);
        if (!$existing) {
            Response::error('Employee not found.', 404);
        }

        $v = new Validator($request->body, [
            'full_name'      => 'nullable|max:150',
            'email'          => 'nullable|email',
            'phone'          => 'nullable|digits_between:7,15',
            'joining_date'   => 'nullable|date',
            'status'         => 'nullable|in:active,inactive,suspended',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        if ($request->input('email')) {
            $email = strtolower(trim((string)$request->input('email')));
            $other = User::findByEmail($email);
            if ($other && (int)$other['id'] !== $id) {
                Response::error('Email already in use.', 422, ['email' => ['Email already in use.']]);
            }
        }

        $data = $request->only([
            'full_name', 'email', 'phone', 'department_id', 'designation_id',
            'shift_id', 'manager_id', 'monthly_salary', 'date_of_birth',
            'address', 'joining_date', 'status', 'role_id',
        ]);
        if (isset($data['email'])) {
            $data['email'] = strtolower(trim((string)$data['email']));
        }
        // Empty strings from the form mean "unassigned" → store NULL.
        foreach (['department_id', 'designation_id', 'shift_id', 'manager_id', 'monthly_salary', 'date_of_birth'] as $fk) {
            if (array_key_exists($fk, $data) && $data[$fk] === '') {
                $data[$fk] = null;
            }
        }
        // Prevent an employee from being their own manager.
        if (!empty($data['manager_id']) && (int)$data['manager_id'] === $id) {
            Response::error('An employee cannot be their own manager.', 422, ['manager_id' => ['Invalid manager.']]);
        }
        if ($request->input('password')) {
            $data['password_hash'] = password_hash((string)$request->input('password'), PASSWORD_BCRYPT);
        }
        if ($request->input('profile_photo')) {
            $data['profile_photo'] = Uploader::fromBase64((string)$request->input('profile_photo'), 'profiles', 'emp');
        }

        User::update($id, $data);
        Activity::log(Auth::id(), 'employee.update', 'users', (string)$id,
            'Updated employee', $request->ip());

        $updated = User::detailed($id);
        unset($updated['password_hash']);
        Response::success($updated, 'Employee updated.');
    }

    /** DELETE /employees/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if ($id === Auth::id()) {
            Response::error('You cannot delete your own account.', 422);
        }
        $existing = User::find($id);
        if (!$existing) {
            Response::error('Employee not found.', 404);
        }
        if ((int)$existing['role_id'] !== 3 && !Guard::isSuperAdmin()) {
            Response::error('Only a Super Admin can delete admin accounts.', 403);
        }

        User::delete($id);
        Activity::log(Auth::id(), 'employee.delete', 'users', (string)$id,
            'Deleted employee ' . $existing['email'], $request->ip());
        Response::success(null, 'Employee deleted.');
    }

    /** POST /employees/import — bulk create from a CSV upload.
     *  CSV columns: full_name,email,phone,department_id,designation_id,joining_date,password
     */
    public function import(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $file = $request->files['file'] ?? null;
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('Please upload a CSV file.', 422);
        }

        $handle = fopen($file['tmp_name'], 'r');
        if (!$handle) {
            Response::error('Could not read the file.', 422);
        }

        $header = fgetcsv($handle);
        if (!$header) {
            Response::error('CSV is empty.', 422);
        }
        $header = array_map(fn($h) => strtolower(trim((string)$h)), $header);

        $created = 0;
        $skipped = [];
        $rowNum  = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNum++;
            if (count(array_filter($row, fn($c) => trim((string)$c) !== '')) === 0) {
                continue; // blank line
            }
            $data = array_combine(
                array_slice($header, 0, count($row)),
                array_map(fn($c) => trim((string)$c), $row)
            );

            $email = strtolower((string)($data['email'] ?? ''));
            $name  = (string)($data['full_name'] ?? $data['name'] ?? '');

            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped[] = "Row {$rowNum}: missing/invalid name or email";
                continue;
            }
            if (User::findByEmail($email)) {
                $skipped[] = "Row {$rowNum}: email {$email} already exists";
                continue;
            }

            $password = $data['password'] ?? '';
            if (strlen($password) < 8) {
                $password = 'Welcome@' . random_int(1000, 9999); // auto-generate if missing/short
            }

            User::create([
                'employee_code'  => User::nextEmployeeCode(),
                'full_name'      => $name,
                'email'          => $email,
                'phone'          => $data['phone'] ?? null,
                'password_hash'  => password_hash($password, PASSWORD_BCRYPT),
                'role_id'        => 3,
                'department_id'  => !empty($data['department_id']) ? (int)$data['department_id'] : null,
                'designation_id' => !empty($data['designation_id']) ? (int)$data['designation_id'] : null,
                'joining_date'   => !empty($data['joining_date']) ? $data['joining_date'] : null,
                'status'         => 'active',
                'must_change_password' => 1,
            ]);
            $created++;
        }
        fclose($handle);

        Activity::log(Auth::id(), 'employee.import', 'users', null,
            "Imported {$created} employees", $request->ip());

        Response::success(
            ['created' => $created, 'skipped' => $skipped],
            "Imported {$created} employee(s)." . ($skipped ? ' Some rows were skipped.' : '')
        );
    }

    /** GET /attendance/locations?date= — check-in coordinates for the live map. */
    public function locations(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $date = $request->query['date'] ?? date('Y-m-d');
        $rows = \App\Core\Database::fetchAll(
            'SELECT u.id, u.full_name, u.employee_code, d.name AS department_name,
                    a.check_in_time, a.status, a.is_late,
                    a.check_in_lat AS lat, a.check_in_lng AS lng, a.check_in_selfie
             FROM attendance a
             JOIN users u ON u.id = a.user_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE a.attendance_date = ? AND a.check_in_lat IS NOT NULL',
            [$date]
        );
        Response::success(['date' => $date, 'locations' => $rows]);
    }

    /** GET /team — current user's direct reports + today's attendance (manager view). */
    public function team(Request $request): void
    {
        $date    = $request->query['date'] ?? date('Y-m-d');
        $members = User::team(Auth::id(), $date);

        $present = 0; $late = 0; $absent = 0;
        foreach ($members as $m) {
            if ($m['check_in_time']) {
                $present++;
                if ((int)$m['is_late']) $late++;
            } elseif (($m['attendance_status'] ?? '') === 'leave') {
                // on leave — counted separately below via status
            } else {
                $absent++;
            }
        }

        Response::success([
            'date'    => $date,
            'members' => $members,
            'summary' => [
                'total'   => count($members),
                'present' => $present,
                'late'    => $late,
                'absent'  => $absent,
            ],
        ]);
    }

    /** PATCH /employees/{id}/status */
    public function setStatus(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        $v = new Validator($request->body, ['status' => 'required|in:active,inactive,suspended']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        if (!User::find($id)) {
            Response::error('Employee not found.', 404);
        }
        $status = (string)$request->input('status');
        User::update($id, ['status' => $status]);
        if ($status !== 'active') {
            Database::run('DELETE FROM user_sessions WHERE user_id = ?', [$id]); // force logout
        }
        Activity::log(Auth::id(), 'employee.status', 'users', (string)$id,
            'Set status to ' . $status, $request->ip());
        Response::success(null, 'Status updated.');
    }
}

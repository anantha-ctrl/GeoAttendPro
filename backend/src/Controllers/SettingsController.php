<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Support\Activity;
use App\Support\Guard;
use App\Support\Settings;

final class SettingsController
{
    /** GET /lookups — reference data for forms (roles, departments, designations, leave types). */
    public function lookups(Request $request): void
    {
        Response::success([
            'roles'        => Database::fetchAll('SELECT id, name, slug FROM roles ORDER BY id'),
            'departments'  => Database::fetchAll('SELECT id, name FROM departments WHERE status="active" ORDER BY name'),
            'designations' => Database::fetchAll('SELECT id, name, department_id FROM designations WHERE status="active" ORDER BY name'),
            'leave_types'  => Database::fetchAll('SELECT id, name FROM leave_types WHERE status="active" ORDER BY name'),
            'shifts'       => Database::fetchAll('SELECT id, name, start_time, end_time FROM shifts WHERE status="active" ORDER BY start_time'),
            'managers'     => Database::fetchAll('SELECT id, full_name, employee_code FROM users WHERE status="active" ORDER BY full_name'),
        ]);
    }

    /** GET /settings */
    public function index(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        Response::success(Settings::all());
    }

    /** PUT /settings */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin']);
        foreach ($request->body as $key => $value) {
            if ($key === '_csrf') continue;
            Settings::set((string)$key, (string)$value);
        }
        Activity::log(Auth::id(), 'settings.update', 'settings', null, null, $request->ip());
        Response::success(Settings::all(), 'Settings updated.');
    }

    /** GET /geofences — readable by any logged-in user (office locations for attendance). */
    public function geofences(Request $request): void
    {
        Response::success(Database::fetchAll('SELECT * FROM geofences ORDER BY id DESC'));
    }

    /** POST /geofences */
    public function storeGeofence(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = Database::insert(
            'INSERT INTO geofences (name, latitude, longitude, radius_m, status) VALUES (?,?,?,?,?)',
            [
                $request->input('name', 'Site'),
                (float)$request->input('latitude'),
                (float)$request->input('longitude'),
                (int)$request->input('radius_m', 200),
                $request->input('status', 'active'),
            ]
        );
        Activity::log(Auth::id(), 'geofence.create', 'geofences', (string)$id, null, $request->ip());
        Response::success(['id' => $id], 'Geofence created.', 201);
    }

    /** DELETE /geofences/{id} */
    public function destroyGeofence(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        Database::run('DELETE FROM geofences WHERE id = ?', [(int)$request->params['id']]);
        Response::success(null, 'Geofence deleted.');
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Shift;
use App\Support\Activity;
use App\Support\Guard;

final class ShiftController
{
    /** GET /shifts */
    public function index(Request $request): void
    {
        Response::success(Shift::withCounts());
    }

    /** POST /shifts */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        if ($v = $this->validate($request)) {
            Response::error('Validation failed.', 422, $v);
        }
        $id = Shift::create($this->data($request));
        Activity::log(Auth::id(), 'shift.create', 'shifts', (string)$id, null, $request->ip());
        Response::success(Shift::find($id), 'Shift created.', 201);
    }

    /** PUT /shifts/{id} */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Shift::find($id)) {
            Response::error('Shift not found.', 404);
        }
        if ($v = $this->validate($request)) {
            Response::error('Validation failed.', 422, $v);
        }
        Shift::update($id, $this->data($request));
        Activity::log(Auth::id(), 'shift.update', 'shifts', (string)$id, null, $request->ip());
        Response::success(Shift::find($id), 'Shift updated.');
    }

    /** DELETE /shifts/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Shift::find($id)) {
            Response::error('Shift not found.', 404);
        }
        $assigned = (int)Database::scalar('SELECT COUNT(*) FROM users WHERE shift_id = ?', [$id]);
        if ($assigned > 0) {
            Response::error("Cannot delete: {$assigned} employee(s) are assigned to this shift.", 409);
        }
        Shift::delete($id);
        Activity::log(Auth::id(), 'shift.delete', 'shifts', (string)$id, null, $request->ip());
        Response::success(null, 'Shift deleted.');
    }

    private function validate(Request $request): ?array
    {
        $v = new Validator($request->body, [
            'name'          => 'required|max:80',
            'start_time'    => 'required',
            'end_time'      => 'required',
            'grace_minutes' => 'nullable|integer',
        ]);
        return $v->fails() ? $v->errors() : null;
    }

    private function data(Request $request): array
    {
        return [
            'name'          => trim((string)$request->input('name')),
            'start_time'    => (string)$request->input('start_time'),
            'end_time'      => (string)$request->input('end_time'),
            'grace_minutes' => (int)$request->input('grace_minutes', 15),
            'status'        => $request->input('status', 'active'),
        ];
    }
}

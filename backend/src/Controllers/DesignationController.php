<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Designation;
use App\Support\Activity;
use App\Support\Guard;

final class DesignationController
{
    public function index(Request $request): void
    {
        Response::success(Designation::withDepartment());
    }

    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, [
            'name'          => 'required|max:120',
            'department_id' => 'nullable|integer',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Designation::create([
            'name'          => trim((string)$request->input('name')),
            'department_id' => $request->input('department_id') ?: null,
            'status'        => $request->input('status', 'active'),
        ]);
        Activity::log(Auth::id(), 'designation.create', 'designations', (string)$id, null, $request->ip());
        Response::success(Designation::find($id), 'Designation created.', 201);
    }

    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Designation::find($id)) {
            Response::error('Designation not found.', 404);
        }
        Designation::update($id, $request->only(['name', 'department_id', 'status']));
        Activity::log(Auth::id(), 'designation.update', 'designations', (string)$id, null, $request->ip());
        Response::success(Designation::find($id), 'Designation updated.');
    }

    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Designation::find($id)) {
            Response::error('Designation not found.', 404);
        }
        Designation::delete($id);
        Activity::log(Auth::id(), 'designation.delete', 'designations', (string)$id, null, $request->ip());
        Response::success(null, 'Designation deleted.');
    }
}

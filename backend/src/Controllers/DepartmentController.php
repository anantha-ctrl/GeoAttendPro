<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Department;
use App\Support\Activity;
use App\Support\Guard;

final class DepartmentController
{
    public function index(Request $request): void
    {
        Response::success(Department::withCounts());
    }

    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, ['name' => 'required|max:120']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Department::create([
            'name'        => trim((string)$request->input('name')),
            'description' => $request->input('description'),
            'status'      => $request->input('status', 'active'),
        ]);
        Activity::log(Auth::id(), 'department.create', 'departments', (string)$id, null, $request->ip());
        Response::success(Department::find($id), 'Department created.', 201);
    }

    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Department::find($id)) {
            Response::error('Department not found.', 404);
        }
        Department::update($id, $request->only(['name', 'description', 'status']));
        Activity::log(Auth::id(), 'department.update', 'departments', (string)$id, null, $request->ip());
        Response::success(Department::find($id), 'Department updated.');
    }

    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Department::find($id)) {
            Response::error('Department not found.', 404);
        }
        Department::delete($id);
        Activity::log(Auth::id(), 'department.delete', 'departments', (string)$id, null, $request->ip());
        Response::success(null, 'Department deleted.');
    }
}

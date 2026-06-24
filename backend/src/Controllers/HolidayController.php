<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Holiday;
use App\Support\Activity;
use App\Support\Guard;

final class HolidayController
{
    /** GET /holidays */
    public function index(Request $request): void
    {
        Response::success(Holiday::upcoming());
    }

    /** POST /holidays */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, [
            'name'         => 'required|max:120',
            'holiday_date' => 'required|date',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Holiday::create([
            'name'         => trim((string)$request->input('name')),
            'holiday_date' => $request->input('holiday_date'),
            'recurring'    => $request->input('recurring') ? 1 : 0,
        ]);
        Activity::log(Auth::id(), 'holiday.create', 'holidays', (string)$id, null, $request->ip());
        Response::success(Holiday::find($id), 'Holiday added.', 201);
    }

    /** DELETE /holidays/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Holiday::find($id)) {
            Response::error('Holiday not found.', 404);
        }
        Holiday::delete($id);
        Activity::log(Auth::id(), 'holiday.delete', 'holidays', (string)$id, null, $request->ip());
        Response::success(null, 'Holiday removed.');
    }
}

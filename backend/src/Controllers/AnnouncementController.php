<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Announcement;
use App\Support\Activity;
use App\Support\Guard;

final class AnnouncementController
{
    /** GET /announcements — everyone reads the notice board. */
    public function index(Request $request): void
    {
        Response::success(Announcement::feed());
    }

    /** POST /announcements — admin posts a notice. */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, ['title' => 'required|max:180', 'body' => 'required']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Announcement::create([
            'title'      => trim((string)$request->input('title')),
            'body'       => trim((string)$request->input('body')),
            'pinned'     => $request->input('pinned') ? 1 : 0,
            'created_by' => Auth::id(),
        ]);
        Activity::log(Auth::id(), 'announcement.create', 'announcements', (string)$id, null, $request->ip());
        Response::success(Announcement::find($id), 'Announcement posted.', 201);
    }

    /** PUT /announcements/{id} */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Announcement::find($id)) {
            Response::error('Announcement not found.', 404);
        }
        $v = new Validator($request->body, ['title' => 'required|max:180', 'body' => 'required']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        Announcement::update($id, [
            'title'  => trim((string)$request->input('title')),
            'body'   => trim((string)$request->input('body')),
            'pinned' => $request->input('pinned') ? 1 : 0,
        ]);
        Response::success(Announcement::find($id), 'Announcement updated.');
    }

    /** DELETE /announcements/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Announcement::find($id)) {
            Response::error('Announcement not found.', 404);
        }
        Announcement::delete($id);
        Activity::log(Auth::id(), 'announcement.delete', 'announcements', (string)$id, null, $request->ip());
        Response::success(null, 'Announcement deleted.');
    }
}

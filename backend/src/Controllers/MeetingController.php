<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Meeting;
use App\Models\Notification;
use App\Support\Activity;
use App\Support\Guard;

final class MeetingController
{
    /** GET /meetings — all (admin) or the caller's invited meetings (employee). */
    public function index(Request $request): void
    {
        $status = $request->query['status'] ?? null;
        $rows = Guard::isAdmin()
            ? Meeting::listAll($status)
            : Meeting::listForUser(Auth::id(), $status);
        Response::success($rows);
    }

    /** GET /meetings/{id} — meeting detail + attendee roster. */
    public function show(Request $request): void
    {
        $id = (int)$request->params['id'];
        $meeting = Meeting::find($id);
        if (!$meeting) {
            Response::error('Meeting not found.', 404);
        }
        $meeting['attendees'] = Meeting::attendees($id);
        Response::success($meeting);
    }

    /** POST /meetings — any employee schedules a meeting and invites colleagues. */
    public function store(Request $request): void
    {
        $v = new Validator($request->body, [
            'title'        => 'required|max:180',
            'meeting_date' => 'required',
            'attendees'    => 'required',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $attendees = $this->normalizeAttendees($request->input('attendees'));
        if ($attendees === []) {
            Response::error('Select at least one attendee.', 422, ['attendees' => ['Select at least one attendee.']]);
        }

        $id = Meeting::create([
            'title'            => trim((string)$request->input('title')),
            'agenda'           => $request->input('agenda') ?: null,
            'meeting_date'     => $this->parseDate((string)$request->input('meeting_date')),
            'duration_minutes' => (int)$request->input('duration_minutes', 30) ?: 30,
            'location'         => $request->input('location') ?: null,
            'meeting_link'     => $this->resolveLink($request->input('meeting_link')),
            'status'           => 'scheduled',
            'created_by'       => Auth::id(),
        ]);
        Meeting::setAttendees($id, $attendees);

        $when = date('d M Y, h:i A', strtotime((string)$request->input('meeting_date')));
        foreach ($attendees as $uid) {
            Notification::push($uid, 'meeting_invite', 'Meeting invitation',
                trim((string)$request->input('title')) . ' · ' . $when);
        }
        Activity::log(Auth::id(), 'meeting.create', 'meetings', (string)$id, null, $request->ip());
        Response::success(Meeting::find($id), 'Meeting scheduled.', 201);
    }

    /** PUT /meetings/{id} — admin or organizer edits a meeting (and optionally re-invites). */
    public function update(Request $request): void
    {
        $id = (int)$request->params['id'];
        $meeting = Meeting::find($id);
        if (!$meeting) {
            Response::error('Meeting not found.', 404);
        }
        if (!$this->canManage($meeting)) {
            Response::error('Forbidden.', 403);
        }
        Meeting::update($id, [
            'title'            => trim((string)$request->input('title')),
            'agenda'           => $request->input('agenda') ?: null,
            'meeting_date'     => $this->parseDate((string)$request->input('meeting_date')),
            'duration_minutes' => (int)$request->input('duration_minutes', 30) ?: 30,
            'location'         => $request->input('location') ?: null,
            'meeting_link'     => $this->resolveLink($request->input('meeting_link')),
            'status'           => $request->input('status', 'scheduled'),
        ]);
        if ($request->input('attendees') !== null) {
            $attendees = $this->normalizeAttendees($request->input('attendees'));
            if ($attendees !== []) {
                Meeting::setAttendees($id, $attendees);
            }
        }
        Activity::log(Auth::id(), 'meeting.update', 'meetings', (string)$id, null, $request->ip());
        Response::success(Meeting::find($id), 'Meeting updated.');
    }

    /** DELETE /meetings/{id} — admin or organizer cancels/removes a meeting. */
    public function destroy(Request $request): void
    {
        $id = (int)$request->params['id'];
        $meeting = Meeting::find($id);
        if (!$meeting) {
            Response::error('Meeting not found.', 404);
        }
        if (!$this->canManage($meeting)) {
            Response::error('Forbidden.', 403);
        }
        Meeting::delete($id); // attendees cascade
        Activity::log(Auth::id(), 'meeting.delete', 'meetings', (string)$id, null, $request->ip());
        Response::success(null, 'Meeting deleted.');
    }

    /** PATCH /meetings/{id}/respond — invitee accepts / declines. */
    public function respond(Request $request): void
    {
        $id = (int)$request->params['id'];
        $v = new Validator($request->body, ['response' => 'required|in:accepted,declined']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $n = Database::run(
            'UPDATE meeting_attendees SET response = ? WHERE meeting_id = ? AND user_id = ?',
            [(string)$request->input('response'), $id, Auth::id()]
        );
        if ($n === 0) {
            Response::error('You are not invited to this meeting.', 403);
        }
        Response::success(null, 'Response saved.');
    }

    /** POST /meetings/{id}/attend — invitee marks themselves present (joins). */
    public function attend(Request $request): void
    {
        $id = (int)$request->params['id'];
        $n = Database::run(
            "UPDATE meeting_attendees
             SET attended = 1, attended_at = NOW(), response = IF(response = 'declined', 'accepted', response)
             WHERE meeting_id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        if ($n === 0) {
            Response::error('You are not invited to this meeting.', 403);
        }
        Activity::log(Auth::id(), 'meeting.attend', 'meetings', (string)$id, null, $request->ip());
        Response::success(null, 'Attendance marked.');
    }

    /**
     * Use the admin-supplied link, or auto-generate an instant video-call room.
     * Real Google Meet links need the Google Calendar API + OAuth/Workspace, so
     * we generate a Jitsi Meet room instead: visiting the URL creates/joins the
     * room immediately with no API key. Format mirrors Meet's `xxx-xxxx-xxx` code.
     */
    private function resolveLink(mixed $link): string
    {
        $link = is_string($link) ? trim($link) : '';
        if ($link !== '') {
            return $link;
        }
        $code = $this->randCode(3) . '-' . $this->randCode(4) . '-' . $this->randCode(3);
        return 'https://meet.jit.si/CloudHawk-' . $code;
    }

    private function randCode(int $len): string
    {
        $s = '';
        for ($i = 0; $i < $len; $i++) {
            $s .= chr(random_int(97, 122)); // a-z
        }
        return $s;
    }

    /** Admins manage any meeting; everyone else only the ones they organised. */
    private function canManage(array $meeting): bool
    {
        return Guard::isAdmin() || (int)($meeting['created_by'] ?? 0) === Auth::id();
    }

    /** Accept attendees as an array, JSON string, or CSV. */
    private function normalizeAttendees(mixed $raw): array
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : explode(',', $raw);
        }
        if (!is_array($raw)) {
            return [];
        }
        return array_values(array_filter(array_map('intval', $raw), fn($v) => $v > 0));
    }

    /** Normalise a datetime-local value to MySQL DATETIME. */
    private function parseDate(string $value): string
    {
        $ts = strtotime($value);
        return $ts ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
    }
}

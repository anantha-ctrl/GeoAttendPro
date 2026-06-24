<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Ticket;
use App\Models\Notification;
use App\Support\Activity;
use App\Support\Guard;

final class TicketController
{
    /** GET /tickets — own (employee) or all (admin via ?user_id & ?status). */
    public function index(Request $request): void
    {
        $status = $request->query['status'] ?? null;
        if (Guard::isAdmin()) {
            $userId = isset($request->query['user_id']) ? (int)$request->query['user_id'] : null;
        } else {
            $userId = Auth::id();
        }
        Response::success(Ticket::listFor($userId, $status));
    }

    /** POST /tickets — employee raises a support ticket. */
    public function store(Request $request): void
    {
        $v = new Validator($request->body, [
            'subject'     => 'required|max:180',
            'description' => 'required',
            'priority'    => 'nullable|in:low,medium,high',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Ticket::create([
            'user_id'     => Auth::id(),
            'subject'     => trim((string)$request->input('subject')),
            'category'    => $request->input('category', 'IT') ?: 'IT',
            'description' => trim((string)$request->input('description')),
            'priority'    => $request->input('priority', 'medium'),
            'status'      => 'open',
        ]);
        Activity::log(Auth::id(), 'ticket.create', 'tickets', (string)$id, null, $request->ip());
        foreach (Database::fetchAll('SELECT id FROM users WHERE role_id IN (1,2) AND status="active"') as $a) {
            Notification::push((int)$a['id'], 'ticket_new', 'New support ticket',
                Auth::user()['full_name'] . ' raised: ' . trim((string)$request->input('subject')));
        }
        Response::success(Ticket::find($id), 'Ticket raised.', 201);
    }

    /** PATCH /tickets/{id} — admin updates status / remarks; employee can close own. */
    public function update(Request $request): void
    {
        $id  = (int)$request->params['id'];
        $row = Ticket::find($id);
        if (!$row) {
            Response::error('Ticket not found.', 404);
        }
        $isOwner = (int)$row['user_id'] === Auth::id();
        if (!$isOwner && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }

        $data = [];
        if ($request->input('status') !== null) {
            $v = new Validator($request->body, ['status' => 'in:open,in_progress,resolved,closed']);
            if ($v->fails()) {
                Response::error('Validation failed.', 422, $v->errors());
            }
            // Employees may only close/reopen their own ticket; admins set any status.
            if (!Guard::isAdmin() && !in_array($request->input('status'), ['closed', 'open'], true)) {
                Response::error('You can only close or reopen your ticket.', 403);
            }
            $data['status'] = (string)$request->input('status');
        }
        if (Guard::isAdmin()) {
            if ($request->input('admin_remarks') !== null) $data['admin_remarks'] = $request->input('admin_remarks');
            if ($request->input('assigned_to') !== null) $data['assigned_to'] = $request->input('assigned_to') ?: null;
        }
        if ($data === []) {
            Response::error('Nothing to update.', 422);
        }
        Ticket::update($id, $data);
        Activity::log(Auth::id(), 'ticket.update', 'tickets', (string)$id, $data['status'] ?? null, $request->ip());

        if (Guard::isAdmin() && isset($data['status'])) {
            Notification::push((int)$row['user_id'], 'ticket_status', 'Ticket ' . $data['status'],
                "Your ticket \"{$row['subject']}\" is now {$data['status']}.");
        }
        Response::success(Ticket::find($id), 'Ticket updated.');
    }

    /** DELETE /tickets/{id} — owner or admin. */
    public function destroy(Request $request): void
    {
        $id  = (int)$request->params['id'];
        $row = Ticket::find($id);
        if (!$row) {
            Response::error('Ticket not found.', 404);
        }
        if ((int)$row['user_id'] !== Auth::id() && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }
        Ticket::delete($id);
        Response::success(null, 'Ticket deleted.');
    }
}

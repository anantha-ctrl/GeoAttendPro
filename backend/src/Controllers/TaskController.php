<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Task;
use App\Models\Notification;
use App\Support\Activity;
use App\Support\Guard;

final class TaskController
{
    /** GET /tasks — own (employee) or all (admin via ?user_id & ?status). */
    public function index(Request $request): void
    {
        $status = $request->query['status'] ?? null;
        if (Guard::isAdmin()) {
            $assignee = isset($request->query['user_id']) ? (int)$request->query['user_id'] : null;
        } else {
            $assignee = Auth::id();
        }
        Response::success(Task::listFor($assignee, $status));
    }

    /** POST /tasks — admin/manager assigns a task. */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $v = new Validator($request->body, [
            'title'       => 'required|max:180',
            'assigned_to' => 'required|integer',
            'priority'    => 'nullable|in:low,medium,high',
            'due_date'    => 'nullable|date',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $id = Task::create([
            'title'       => trim((string)$request->input('title')),
            'description' => $request->input('description') ?: null,
            'assigned_to' => (int)$request->input('assigned_to'),
            'assigned_by' => Auth::id(),
            'due_date'    => $request->input('due_date') ?: null,
            'priority'    => $request->input('priority', 'medium'),
            'status'      => 'todo',
        ]);
        Activity::log(Auth::id(), 'task.create', 'tasks', (string)$id, null, $request->ip());
        Notification::push((int)$request->input('assigned_to'), 'task_assigned', 'New task assigned',
            'You have been assigned: ' . trim((string)$request->input('title')));
        Response::success(Task::find($id), 'Task assigned.', 201);
    }

    /** PATCH /tasks/{id}/status — assignee (or admin) updates progress. */
    public function setStatus(Request $request): void
    {
        $id  = (int)$request->params['id'];
        $row = Task::find($id);
        if (!$row) {
            Response::error('Task not found.', 404);
        }
        if ((int)$row['assigned_to'] !== Auth::id() && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }
        $v = new Validator($request->body, ['status' => 'required|in:todo,in_progress,done']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        Task::update($id, ['status' => (string)$request->input('status')]);
        Activity::log(Auth::id(), 'task.status', 'tasks', (string)$id, (string)$request->input('status'), $request->ip());
        Response::success(Task::find($id), 'Task updated.');
    }

    /** PUT /tasks/{id} — admin edits a task. */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Task::find($id)) {
            Response::error('Task not found.', 404);
        }
        Task::update($id, [
            'title'       => trim((string)$request->input('title')),
            'description' => $request->input('description') ?: null,
            'assigned_to' => (int)$request->input('assigned_to'),
            'due_date'    => $request->input('due_date') ?: null,
            'priority'    => $request->input('priority', 'medium'),
            'status'      => $request->input('status', 'todo'),
        ]);
        Response::success(Task::find($id), 'Task updated.');
    }

    /** DELETE /tasks/{id} — admin only. */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Task::find($id)) {
            Response::error('Task not found.', 404);
        }
        Task::delete($id);
        Response::success(null, 'Task deleted.');
    }
}

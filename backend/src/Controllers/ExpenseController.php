<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\ExpenseClaim;
use App\Models\Notification;
use App\Core\Database;
use App\Support\Activity;
use App\Support\Guard;
use App\Support\Uploader;

final class ExpenseController
{
    /** GET /expenses — own (employee) or all (admin via ?user_id & ?status). */
    public function index(Request $request): void
    {
        $status = $request->query['status'] ?? null;
        if (Guard::isAdmin()) {
            $userId = isset($request->query['user_id']) ? (int)$request->query['user_id'] : null;
        } else {
            $userId = Auth::id();
        }
        Response::success(ExpenseClaim::listFor($userId, $status));
    }

    /** POST /expenses — employee submits a reimbursement claim (optional receipt). */
    public function store(Request $request): void
    {
        $v = new Validator($request->body, [
            'title'        => 'required|max:180',
            'amount'       => 'required|numeric',
            'expense_date' => 'nullable|date',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $receipt = null;
        if (!empty($request->files['receipt'])) {
            [$receipt] = Uploader::fromDocument($request->files['receipt'], 'receipts', 'rcpt_' . Auth::id());
        }

        $id = ExpenseClaim::create([
            'user_id'      => Auth::id(),
            'title'        => trim((string)$request->input('title')),
            'category'     => $request->input('category', 'Travel') ?: 'Travel',
            'amount'       => round((float)$request->input('amount'), 2),
            'expense_date' => $request->input('expense_date') ?: date('Y-m-d'),
            'receipt_path' => $receipt,
            'notes'        => $request->input('notes') ?: null,
            'status'       => 'pending',
        ]);

        Activity::log(Auth::id(), 'expense.apply', 'expense_claims', (string)$id, null, $request->ip());
        foreach (Database::fetchAll('SELECT id FROM users WHERE role_id IN (1,2) AND status="active"') as $a) {
            Notification::push((int)$a['id'], 'expense_request', 'New expense claim',
                Auth::user()['full_name'] . ' submitted a reimbursement claim.');
        }
        Response::success(ExpenseClaim::find($id), 'Expense claim submitted.', 201);
    }

    /** PATCH /expenses/{id}/approve */
    public function approve(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'approved');
    }

    /** PATCH /expenses/{id}/reject */
    public function reject(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'rejected');
    }

    private function decide(Request $request, string $decision): void
    {
        $id  = (int)$request->params['id'];
        $row = ExpenseClaim::find($id);
        if (!$row) {
            Response::error('Claim not found.', 404);
        }
        if ($row['status'] !== 'pending') {
            Response::error('This claim has already been ' . $row['status'] . '.', 409);
        }
        ExpenseClaim::update($id, [
            'status'        => $decision,
            'reviewed_by'   => Auth::id(),
            'reviewed_at'   => date('Y-m-d H:i:s'),
            'admin_remarks' => $request->input('admin_remarks'),
        ]);
        Activity::log(Auth::id(), 'expense.' . $decision, 'expense_claims', (string)$id, null, $request->ip());
        Notification::push((int)$row['user_id'], 'expense_status', 'Expense ' . $decision,
            "Your expense claim \"{$row['title']}\" (₹{$row['amount']}) was {$decision}.", true);
        Response::success(ExpenseClaim::find($id), 'Claim ' . $decision . '.');
    }

    /** DELETE /expenses/{id} — owner (pending) or admin. */
    public function destroy(Request $request): void
    {
        $id  = (int)$request->params['id'];
        $row = ExpenseClaim::find($id);
        if (!$row) {
            Response::error('Claim not found.', 404);
        }
        if ((int)$row['user_id'] !== Auth::id() && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }
        if (!Guard::isAdmin() && $row['status'] !== 'pending') {
            Response::error('Only pending claims can be deleted.', 409);
        }
        ExpenseClaim::delete($id);
        Response::success(null, 'Claim deleted.');
    }
}

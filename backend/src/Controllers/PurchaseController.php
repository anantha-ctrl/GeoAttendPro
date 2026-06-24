<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Purchase;
use App\Support\Activity;
use App\Support\Guard;

final class PurchaseController
{
    /** GET /purchases */
    public function index(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 10)));
        $filters = [
            'search'         => $request->query['search'] ?? null,
            'category'       => $request->query['category'] ?? null,
            'payment_status' => $request->query['payment_status'] ?? null,
            'from'           => $request->query['from'] ?? null,
            'to'             => $request->query['to'] ?? null,
        ];
        Response::success(Purchase::paginate($filters, $page, $perPage));
    }

    /** POST /purchases */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        if ($errors = $this->validate($request)) {
            Response::error('Validation failed.', 422, $errors);
        }
        $data = $this->data($request);
        $data['created_by'] = Auth::id();
        $id = Purchase::create($data);
        Activity::log(Auth::id(), 'purchase.create', 'purchases', (string)$id,
            'Purchased ' . $data['item_name'], $request->ip());
        Response::success(Purchase::find($id), 'Purchase recorded.', 201);
    }

    /** PUT /purchases/{id} */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Purchase::find($id)) {
            Response::error('Purchase not found.', 404);
        }
        if ($errors = $this->validate($request)) {
            Response::error('Validation failed.', 422, $errors);
        }
        Purchase::update($id, $this->data($request));
        Activity::log(Auth::id(), 'purchase.update', 'purchases', (string)$id, null, $request->ip());
        Response::success(Purchase::find($id), 'Purchase updated.');
    }

    /** DELETE /purchases/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Purchase::find($id)) {
            Response::error('Purchase not found.', 404);
        }
        Purchase::delete($id);
        Activity::log(Auth::id(), 'purchase.delete', 'purchases', (string)$id, null, $request->ip());
        Response::success(null, 'Purchase deleted.');
    }

    private function validate(Request $request): ?array
    {
        $v = new Validator($request->body, [
            'item_name'      => 'required|max:150',
            'quantity'       => 'nullable|integer',
            'unit_price'     => 'nullable|numeric',
            'purchase_date'  => 'nullable|date',
            'payment_status' => 'nullable|in:paid,pending',
        ]);
        return $v->fails() ? $v->errors() : null;
    }

    private function data(Request $request): array
    {
        $qty   = max(1, (int)$request->input('quantity', 1));
        $price = round((float)$request->input('unit_price', 0), 2);
        return [
            'item_name'      => trim((string)$request->input('item_name')),
            'category'       => $request->input('category', 'Office Supplies') ?: 'Office Supplies',
            'vendor'         => $request->input('vendor') ?: null,
            'quantity'       => $qty,
            'unit_price'     => $price,
            'total_amount'   => round($qty * $price, 2),   // server-computed (never trust client total)
            'purchase_date'  => $request->input('purchase_date') ?: date('Y-m-d'),
            'payment_status' => $request->input('payment_status', 'paid'),
            'invoice_no'     => $request->input('invoice_no') ?: null,
            'notes'          => $request->input('notes') ?: null,
        ];
    }
}

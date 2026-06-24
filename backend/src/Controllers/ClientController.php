<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Client;
use App\Support\Activity;
use App\Support\Guard;

final class ClientController
{
    /** GET /clients */
    public function index(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 10)));
        $filters = [
            'search' => $request->query['search'] ?? null,
            'type'   => $request->query['type'] ?? null,
            'status' => $request->query['status'] ?? null,
        ];
        Response::success(Client::paginate($filters, $page, $perPage));
    }

    /** POST /clients */
    public function store(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        if ($errors = $this->validate($request)) {
            Response::error('Validation failed.', 422, $errors);
        }
        $data = $this->data($request);
        $data['created_by'] = Auth::id();
        $id = Client::create($data);
        Activity::log(Auth::id(), 'client.create', 'clients', (string)$id, 'Added ' . $data['name'], $request->ip());
        Response::success(Client::find($id), 'Client saved.', 201);
    }

    /** PUT /clients/{id} */
    public function update(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Client::find($id)) {
            Response::error('Client not found.', 404);
        }
        if ($errors = $this->validate($request)) {
            Response::error('Validation failed.', 422, $errors);
        }
        Client::update($id, $this->data($request));
        Activity::log(Auth::id(), 'client.update', 'clients', (string)$id, null, $request->ip());
        Response::success(Client::find($id), 'Client updated.');
    }

    /** DELETE /clients/{id} */
    public function destroy(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $id = (int)$request->params['id'];
        if (!Client::find($id)) {
            Response::error('Client not found.', 404);
        }
        Client::delete($id);
        Activity::log(Auth::id(), 'client.delete', 'clients', (string)$id, null, $request->ip());
        Response::success(null, 'Client deleted.');
    }

    private function validate(Request $request): ?array
    {
        $v = new Validator($request->body, [
            'name'   => 'required|max:150',
            'email'  => 'nullable|email',
            'phone'  => 'nullable|max:20',
            'type'   => 'nullable|in:client,customer,vendor',
            'status' => 'nullable|in:active,inactive',
        ]);
        return $v->fails() ? $v->errors() : null;
    }

    private function data(Request $request): array
    {
        return [
            'name'         => trim((string)$request->input('name')),
            'company_name' => $request->input('company_name') ?: null,
            'email'        => $request->input('email') ? strtolower(trim((string)$request->input('email'))) : null,
            'phone'        => $request->input('phone') ?: null,
            'address'      => $request->input('address') ?: null,
            'gst_number'   => $request->input('gst_number') ?: null,
            'type'         => $request->input('type', 'client'),
            'status'       => $request->input('status', 'active'),
            'notes'        => $request->input('notes') ?: null,
        ];
    }
}

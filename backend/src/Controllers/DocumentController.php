<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\Document;
use App\Support\Activity;
use App\Support\Guard;
use App\Support\Uploader;

final class DocumentController
{
    /** GET /documents — own (employee) or any user's (admin via ?user_id). */
    public function index(Request $request): void
    {
        if (Guard::isAdmin()) {
            $userId = isset($request->query['user_id']) ? (int)$request->query['user_id'] : null;
        } else {
            $userId = Auth::id();
        }
        Response::success(Document::listFor($userId));
    }

    /** POST /documents — upload a document (multipart). */
    public function store(Request $request): void
    {
        $title    = trim((string)$request->input('title'));
        $category = trim((string)$request->input('category', 'other')) ?: 'other';
        if ($title === '') {
            Response::error('Please provide a document title.', 422, ['title' => ['Title is required.']]);
        }

        $file = $request->files['file'] ?? null;
        if (!$file) {
            Response::error('Please choose a file to upload.', 422);
        }

        // Admins may upload on behalf of an employee; others upload to themselves.
        $ownerId = Auth::id();
        if (Guard::isAdmin() && $request->input('user_id')) {
            $ownerId = (int)$request->input('user_id');
        }

        [$url, $mime, $size] = Uploader::fromDocument($file, 'documents', 'doc_' . $ownerId);

        $id = Document::create([
            'user_id'     => $ownerId,
            'title'       => $title,
            'category'    => $category,
            'file_path'   => $url,
            'mime'        => $mime,
            'size_bytes'  => $size,
            'uploaded_by' => Auth::id(),
        ]);

        Activity::log(Auth::id(), 'document.upload', 'documents', (string)$id,
            "Uploaded {$title}", $request->ip());
        Response::success(Document::find($id), 'Document uploaded.', 201);
    }

    /** DELETE /documents/{id} */
    public function destroy(Request $request): void
    {
        $id  = (int)$request->params['id'];
        $doc = Document::find($id);
        if (!$doc) {
            Response::error('Document not found.', 404);
        }
        // Owner or admin only.
        if ((int)$doc['user_id'] !== Auth::id() && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }
        // Best-effort delete of the stored file.
        $abs = dirname(__DIR__, 2) . '/public' . $doc['file_path'];
        if (is_file($abs)) {
            @unlink($abs);
        }
        Document::delete($id);
        Activity::log(Auth::id(), 'document.delete', 'documents', (string)$id, null, $request->ip());
        Response::success(null, 'Document deleted.');
    }
}

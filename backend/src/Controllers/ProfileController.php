<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\User;
use App\Support\Activity;
use App\Support\Uploader;

/**
 * Self-service profile for the logged-in user (any role).
 */
final class ProfileController
{
    /** GET /profile */
    public function show(Request $request): void
    {
        $user = User::detailed(Auth::id());
        unset($user['password_hash']);
        // Expose whether a face is enrolled; keep the raw descriptor too (own data)
        // so the browser can match it locally at check-in time.
        $user['face_enrolled'] = !empty($user['face_descriptor']);
        Response::success($user);
    }

    /** POST /profile/face — enroll / replace the logged-in user's face descriptor.
     *  The 128-float descriptor is computed client-side by face-api.js.
     */
    public function enrollFace(Request $request): void
    {
        $descriptor = $request->input('descriptor');
        if (!is_array($descriptor) || count($descriptor) < 64) {
            Response::error('No valid face was detected. Please try again in good lighting.', 422);
        }
        // Store as a compact JSON array of floats.
        $clean = array_map(static fn($v) => round((float)$v, 6), array_values($descriptor));
        User::update(Auth::id(), ['face_descriptor' => json_encode($clean)]);
        Activity::log(Auth::id(), 'profile.face_enroll', 'users', (string)Auth::id(),
            'Enrolled face descriptor', $request->ip());
        Response::success(['face_enrolled' => true], 'Face enrolled successfully.');
    }

    /** DELETE /profile/face — remove enrolled face. */
    public function removeFace(Request $request): void
    {
        User::update(Auth::id(), ['face_descriptor' => null]);
        Activity::log(Auth::id(), 'profile.face_remove', 'users', (string)Auth::id(), null, $request->ip());
        Response::success(['face_enrolled' => false], 'Face removed.');
    }

    /** PUT /profile — limited self-editable fields. */
    public function update(Request $request): void
    {
        $v = new Validator($request->body, [
            'full_name' => 'nullable|max:150',
            'phone'     => 'nullable|digits_between:7,15',
            'address'   => 'nullable|max:255',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $data = $request->only(['full_name', 'phone', 'address']);
        if ($request->input('profile_photo')) {
            $data['profile_photo'] = Uploader::fromBase64((string)$request->input('profile_photo'), 'profiles', 'me');
        }
        User::update(Auth::id(), $data);
        Activity::log(Auth::id(), 'profile.update', 'users', (string)Auth::id(), null, $request->ip());

        $user = User::detailed(Auth::id());
        unset($user['password_hash']);
        Response::success($user, 'Profile updated.');
    }
}

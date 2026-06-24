<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\User;
use App\Support\Activity;
use App\Support\Mailer;

final class AuthController
{
    /** POST /auth/login */
    public function login(Request $request): void
    {
        $v = new Validator($request->body, [
            'email'    => 'required|email',
            'password' => 'required',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $email = strtolower(trim((string)$request->input('email')));
        $user  = User::findByEmail($email);

        if (!$user || !password_verify((string)$request->input('password'), $user['password_hash'])) {
            Activity::loginFailed($email, $request);
            Response::error('Invalid email or password.', 401);
        }
        if ($user['status'] !== 'active') {
            Response::error('Your account is ' . $user['status'] . '. Contact your administrator.', 403);
        }

        $token = Auth::startSession((int)$user['id'], $request);
        Database::run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [$user['id']]);
        Activity::loginSuccess((int)$user['id'], $email, $request);
        Activity::log((int)$user['id'], 'auth.login', 'users', (string)$user['id'], 'User logged in', $request->ip());

        // Re-fetch with role/department joins so the response carries role info.
        $detailed = User::detailed((int)$user['id']);

        Response::success([
            'token'      => $token,
            'csrf_token' => Csrf::tokenFor($token),
            'user'       => self::publicUser($detailed),
        ], 'Login successful.');
    }

    /** POST /auth/logout */
    public function logout(Request $request): void
    {
        $user = Auth::user();
        if ($user) {
            Activity::logout((int)$user['id'], $request);
            Activity::log((int)$user['id'], 'auth.logout', 'users', (string)$user['id'], 'User logged out', $request->ip());
            Auth::destroy((string)$user['session_id']);
        }
        Response::success(null, 'Logged out.');
    }

    /** GET /auth/me */
    public function me(Request $request): void
    {
        $user = Auth::user();
        Response::success([
            'user'       => self::publicUser($user),
            'csrf_token' => Csrf::tokenFor((string)$user['session_id']),
        ]);
    }

    /** POST /auth/forgot-password */
    public function forgotPassword(Request $request): void
    {
        $v = new Validator($request->body, ['email' => 'required|email']);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        $email = strtolower(trim((string)$request->input('email')));
        $user  = User::findByEmail($email);

        // Always respond success to avoid user enumeration.
        if ($user) {
            // 6-digit OTP, valid 10 minutes.
            $otp     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expires = date('Y-m-d H:i:s', time() + 10 * 60);

            // Invalidate any previous unused OTPs for this email.
            Database::run('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [$email]);
            Database::run(
                'INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?,?,?)',
                [$email, hash('sha256', $otp), $expires]
            );

            $html = "<div style='font-family:Arial,sans-serif'>
                <h2 style='color:#4f46e5'>GeoAttend Pro — Password Reset</h2>
                <p>Use this One-Time Password (OTP) to reset your password:</p>
                <p style='font-size:30px;font-weight:bold;letter-spacing:6px;color:#1e293b'>{$otp}</p>
                <p>This OTP is valid for <b>10 minutes</b>. If you did not request this, ignore this email.</p></div>";
            Mailer::send($email, 'Your GeoAttend Pro password reset OTP', $html);
            Activity::log((int)$user['id'], 'auth.forgot_password', 'users', (string)$user['id'], 'OTP requested', $request->ip());
        }

        Response::success(null, 'If the email exists, an OTP has been sent to it.');
    }

    /** POST /auth/reset-password — verify OTP and set a new password. */
    public function resetPassword(Request $request): void
    {
        // Accept either `otp` (new flow) or `token` (legacy link) under the same field.
        $code = (string)($request->input('otp') ?? $request->input('token') ?? '');
        $request->body['otp'] = $code;

        $v = new Validator($request->body, [
            'email'    => 'required|email',
            'otp'      => 'required',
            'password' => 'required|min:8|confirmed',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $email = strtolower(trim((string)$request->input('email')));
        $row = Database::fetch(
            'SELECT * FROM password_resets
             WHERE email = ? AND token_hash = ? AND used = 0 AND expires_at > NOW()
             ORDER BY id DESC LIMIT 1',
            [$email, hash('sha256', $code)]
        );
        if (!$row) {
            Response::error('Invalid or expired OTP.', 422);
        }

        $user = User::findByEmail($email);
        if (!$user) {
            Response::error('Account not found.', 404);
        }

        Database::run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [password_hash((string)$request->input('password'), PASSWORD_BCRYPT), $user['id']]);
        Database::run('UPDATE password_resets SET used = 1 WHERE id = ?', [$row['id']]);
        // Invalidate all existing sessions on password change
        Database::run('DELETE FROM user_sessions WHERE user_id = ?', [$user['id']]);
        Activity::log((int)$user['id'], 'auth.reset_password', 'users', (string)$user['id'], 'Password reset completed', $request->ip());

        Response::success(null, 'Password updated. Please log in.');
    }

    /** POST /auth/change-password  (authenticated) */
    public function changePassword(Request $request): void
    {
        $user = Auth::user();
        $v = new Validator($request->body, [
            'current_password' => 'required',
            'password'         => 'required|min:8|confirmed',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }
        if (!password_verify((string)$request->input('current_password'), $user['password_hash'])) {
            Response::error('Current password is incorrect.', 422);
        }
        Database::run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [password_hash((string)$request->input('password'), PASSWORD_BCRYPT), $user['id']]);
        Activity::log((int)$user['id'], 'auth.change_password', 'users', (string)$user['id'], 'Password changed', $request->ip());
        Response::success(null, 'Password changed successfully.');
    }

    public static function publicUser(array $user): array
    {
        return [
            'id'              => (int)$user['id'],
            'employee_code'   => $user['employee_code'],
            'full_name'       => $user['full_name'],
            'email'           => $user['email'],
            'phone'           => $user['phone'] ?? null,
            'role'            => $user['role_slug'] ?? null,
            'role_name'       => $user['role_name'] ?? null,
            'department'      => $user['department_name'] ?? null,
            'designation'     => $user['designation_name'] ?? null,
            'profile_photo'   => $user['profile_photo'] ?? null,
            'joining_date'    => $user['joining_date'] ?? null,
            'shift_name'      => $user['shift_name'] ?? null,
            'manager_name'    => $user['manager_name'] ?? null,
            'subordinate_count' => (int)($user['subordinate_count'] ?? 0),
            'is_manager'      => (int)($user['subordinate_count'] ?? 0) > 0,
            'must_change_password' => (bool)($user['must_change_password'] ?? false),
        ];
    }
}

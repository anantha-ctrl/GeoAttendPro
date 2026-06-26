<?php
/**
 * GeoAttend Pro — API front controller.
 * All requests are routed through here (see public/.htaccess).
 */

declare(strict_types=1);

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Controllers\AuthController;
use App\Controllers\EmployeeController;
use App\Controllers\DepartmentController;
use App\Controllers\DesignationController;
use App\Controllers\AttendanceController;
use App\Controllers\LeaveController;
use App\Controllers\DashboardController;
use App\Controllers\ReportController;
use App\Controllers\NotificationController;
use App\Controllers\ProfileController;
use App\Controllers\SecurityController;
use App\Controllers\SettingsController;
use App\Controllers\HolidayController;
use App\Controllers\ShiftController;
use App\Controllers\RegularizationController;
use App\Controllers\DocumentController;
use App\Controllers\PayrollController;
use App\Controllers\CelebrationController;
use App\Controllers\ClientController;
use App\Controllers\PurchaseController;
use App\Controllers\AnnouncementController;
use App\Controllers\ExpenseController;
use App\Controllers\TaskController;
use App\Controllers\TicketController;
use App\Controllers\MeetingController;

require dirname(__DIR__) . '/config/bootstrap.php';

/* ---- CORS (SPA on a different origin / port) ---- */
// Allow the frontend from any host (localhost, LAN IP, etc.) on port 5173.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];
// Also allow the request's own hostname on :5173 (covers any LAN/IP access).
$serverHost = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? '';
if ($serverHost) {
    $allowed[] = 'http://' . preg_replace('/:\d+$/', '', $serverHost) . ':5173';
}
if (in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} elseif ($origin) {
    // Fallback: if origin looks like a dev frontend on :5173, allow it.
    if (preg_match('#^https?://[\w.\-]+:5173$#', $origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
} else {
    // No Origin header (e.g. direct browser hit) — use configured default.
    $frontend = (string)env('FRONTEND_URL', '*');
    header('Access-Control-Allow-Origin: ' . $frontend);
}
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Session-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ---- Global exception handler -> JSON ---- */
set_exception_handler(function (\Throwable $e): void {
    $debug = (bool)env('APP_DEBUG', false);
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    Response::error(
        $debug ? $e->getMessage() : 'Internal server error.',
        500,
        $debug ? ['trace' => explode("\n", $e->getTraceAsString())] : []
    );
});

$router  = new Router();
$auth    = [AuthMiddleware::class];                       // authenticated
$secured = [AuthMiddleware::class, CsrfMiddleware::class]; // authenticated + CSRF

/* ============================ ROUTES ============================ */

// Health check
$router->get('/health', [SettingsController::class, 'lookups']); // light ping (returns lookups)

// ---- Auth (public) ----
$router->post('/auth/login',           [AuthController::class, 'login']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/reset-password',  [AuthController::class, 'resetPassword']);
// ---- Auth (protected) ----
$router->get ('/auth/me',              [AuthController::class, 'me'],             $auth);
$router->post('/auth/logout',          [AuthController::class, 'logout'],         $secured);
$router->post('/auth/change-password', [AuthController::class, 'changePassword'], $secured);

// ---- Lookups ----
$router->get('/lookups', [SettingsController::class, 'lookups'], $auth);

// ---- Dashboards ----
$router->get('/dashboard/admin',      [DashboardController::class, 'admin'],     $auth);
$router->get('/dashboard/employee',   [DashboardController::class, 'employee'],  $auth);
$router->get('/dashboard/live-board', [DashboardController::class, 'liveBoard'], $auth);

// ---- Employees ----
$router->get   ('/employees',              [EmployeeController::class, 'index'],     $auth);
$router->post  ('/employees',              [EmployeeController::class, 'store'],     $secured);
$router->post  ('/employees/import',       [EmployeeController::class, 'import'],    $secured);
$router->get   ('/employees/{id}',         [EmployeeController::class, 'show'],      $auth);
$router->put   ('/employees/{id}',         [EmployeeController::class, 'update'],    $secured);
$router->delete('/employees/{id}',         [EmployeeController::class, 'destroy'],   $secured);
$router->patch ('/employees/{id}/status',  [EmployeeController::class, 'setStatus'], $secured);

// ---- Departments ----
$router->get   ('/departments',      [DepartmentController::class, 'index'],   $auth);
$router->post  ('/departments',      [DepartmentController::class, 'store'],   $secured);
$router->put   ('/departments/{id}', [DepartmentController::class, 'update'],  $secured);
$router->delete('/departments/{id}', [DepartmentController::class, 'destroy'], $secured);

// ---- Designations ----
$router->get   ('/designations',      [DesignationController::class, 'index'],   $auth);
$router->post  ('/designations',      [DesignationController::class, 'store'],   $secured);
$router->put   ('/designations/{id}', [DesignationController::class, 'update'],  $secured);
$router->delete('/designations/{id}', [DesignationController::class, 'destroy'], $secured);

// ---- Attendance ----
$router->get ('/attendance/today',     [AttendanceController::class, 'today'],    $auth);
$router->get ('/attendance/history',   [AttendanceController::class, 'history'],  $auth);
$router->get ('/attendance/calendar',  [AttendanceController::class, 'calendar'], $auth);
$router->get ('/attendance/locations', [EmployeeController::class, 'locations'],  $auth);
$router->post('/attendance/check-in',  [AttendanceController::class, 'checkIn'],  $secured);
$router->post('/attendance/check-out', [AttendanceController::class, 'checkOut'], $secured);
$router->post('/attendance/activity',  [AttendanceController::class, 'activity'], $secured);
$router->get ('/attendance/live',          [AttendanceController::class, 'live'],          $auth);
$router->post('/attendance/rest-start',    [AttendanceController::class, 'restStart'],     $secured);
$router->post('/attendance/rest-end',      [AttendanceController::class, 'restEnd'],       $secured);
$router->post('/attendance/overtime-start',[AttendanceController::class, 'overtimeStart'], $secured);
$router->post('/attendance/logout',        [AttendanceController::class, 'logout'],        $secured);

// ---- Leaves ----
$router->get  ('/leaves',             [LeaveController::class, 'index'],   $auth);
$router->get  ('/leaves/types',       [LeaveController::class, 'types'],   $auth);
$router->get  ('/leaves/balance',     [LeaveController::class, 'balance'], $auth);
$router->post ('/leaves',             [LeaveController::class, 'store'],   $secured);
$router->patch('/leaves/{id}/approve',[LeaveController::class, 'approve'], $secured);
$router->patch('/leaves/{id}/reject', [LeaveController::class, 'reject'],  $secured);
$router->patch('/leaves/{id}/cancel', [LeaveController::class, 'cancel'],  $secured);

// ---- Reports ----
$router->get('/reports/daily',      [ReportController::class, 'daily'],      $auth);
$router->get('/reports/monthly',    [ReportController::class, 'monthly'],    $auth);
$router->get('/reports/employee',   [ReportController::class, 'employee'],   $auth);
$router->get('/reports/department', [ReportController::class, 'department'], $auth);
$router->get('/reports/late',       [ReportController::class, 'late'],       $auth);
$router->get('/reports/leave',      [ReportController::class, 'leave'],      $auth);

// ---- Notifications ----
$router->get  ('/notifications',      [NotificationController::class, 'index'],    $auth);
$router->patch('/notifications/read', [NotificationController::class, 'markRead'], $secured);

// ---- Profile (self) ----
$router->get   ('/profile',      [ProfileController::class, 'show'],       $auth);
$router->put   ('/profile',      [ProfileController::class, 'update'],     $secured);
$router->post  ('/profile/face', [ProfileController::class, 'enrollFace'], $secured);
$router->delete('/profile/face', [ProfileController::class, 'removeFace'], $secured);

// ---- Documents ----
$router->get   ('/documents',      [DocumentController::class, 'index'],   $auth);
$router->post  ('/documents',      [DocumentController::class, 'store'],   $secured);
$router->delete('/documents/{id}', [DocumentController::class, 'destroy'], $secured);

// ---- Payroll ----
$router->get('/payroll', [PayrollController::class, 'index'], $auth);

// ---- Celebrations (birthdays / anniversaries) ----
$router->get('/celebrations', [CelebrationController::class, 'index'], $auth);

// ---- Clients / Customers ----
$router->get   ('/clients',      [ClientController::class, 'index'],   $auth);
$router->post  ('/clients',      [ClientController::class, 'store'],   $secured);
$router->put   ('/clients/{id}', [ClientController::class, 'update'],  $secured);
$router->delete('/clients/{id}', [ClientController::class, 'destroy'], $secured);

// ---- Purchases (office expenses) ----
$router->get   ('/purchases',      [PurchaseController::class, 'index'],   $auth);
$router->post  ('/purchases',      [PurchaseController::class, 'store'],   $secured);
$router->put   ('/purchases/{id}', [PurchaseController::class, 'update'],  $secured);
$router->delete('/purchases/{id}', [PurchaseController::class, 'destroy'], $secured);

// ---- Notice Board ----
$router->get   ('/announcements',      [AnnouncementController::class, 'index'],   $auth);
$router->post  ('/announcements',      [AnnouncementController::class, 'store'],   $secured);
$router->put   ('/announcements/{id}', [AnnouncementController::class, 'update'],  $secured);
$router->delete('/announcements/{id}', [AnnouncementController::class, 'destroy'], $secured);

// ---- Expense / Reimbursement claims ----
$router->get   ('/expenses',             [ExpenseController::class, 'index'],   $auth);
$router->post  ('/expenses',             [ExpenseController::class, 'store'],   $secured);
$router->patch ('/expenses/{id}/approve',[ExpenseController::class, 'approve'], $secured);
$router->patch ('/expenses/{id}/reject', [ExpenseController::class, 'reject'],  $secured);
$router->delete('/expenses/{id}',        [ExpenseController::class, 'destroy'], $secured);

// ---- Tasks / To-Do ----
$router->get   ('/tasks',            [TaskController::class, 'index'],     $auth);
$router->post  ('/tasks',            [TaskController::class, 'store'],     $secured);
$router->patch ('/tasks/{id}/status',[TaskController::class, 'setStatus'], $secured);
$router->put   ('/tasks/{id}',       [TaskController::class, 'update'],    $secured);
$router->delete('/tasks/{id}',       [TaskController::class, 'destroy'],   $secured);

// ---- Help Desk tickets ----
$router->get   ('/tickets',      [TicketController::class, 'index'],   $auth);
$router->post  ('/tickets',      [TicketController::class, 'store'],   $secured);
$router->patch ('/tickets/{id}', [TicketController::class, 'update'],  $secured);
$router->delete('/tickets/{id}', [TicketController::class, 'destroy'], $secured);

// ---- Meetings ----
$router->get   ('/meetings',             [MeetingController::class, 'index'],   $auth);
$router->get   ('/meetings/{id}',        [MeetingController::class, 'show'],    $auth);
$router->post  ('/meetings',             [MeetingController::class, 'store'],   $secured);
$router->put   ('/meetings/{id}',        [MeetingController::class, 'update'],  $secured);
$router->delete('/meetings/{id}',        [MeetingController::class, 'destroy'], $secured);
$router->patch ('/meetings/{id}/respond',[MeetingController::class, 'respond'], $secured);
$router->post  ('/meetings/{id}/attend', [MeetingController::class, 'attend'],  $secured);

// ---- Security (admin) ----
$router->get('/security/login-history', [SecurityController::class, 'loginHistory'],  $auth);
$router->get('/security/activity-logs', [SecurityController::class, 'activityLogs'],  $auth);
$router->get('/security/sessions',      [SecurityController::class, 'activeSessions'],$auth);

// ---- Holidays ----
$router->get   ('/holidays',      [HolidayController::class, 'index'],   $auth);
$router->post  ('/holidays',      [HolidayController::class, 'store'],   $secured);
$router->delete('/holidays/{id}', [HolidayController::class, 'destroy'], $secured);

// ---- Shifts ----
$router->get   ('/shifts',      [ShiftController::class, 'index'],   $auth);
$router->post  ('/shifts',      [ShiftController::class, 'store'],   $secured);
$router->put   ('/shifts/{id}', [ShiftController::class, 'update'],  $secured);
$router->delete('/shifts/{id}', [ShiftController::class, 'destroy'], $secured);

// ---- Team (manager view) ----
$router->get('/team', [EmployeeController::class, 'team'], $auth);

// ---- Regularizations ----
$router->get  ('/regularizations',             [RegularizationController::class, 'index'],   $auth);
$router->post ('/regularizations',             [RegularizationController::class, 'store'],   $secured);
$router->patch('/regularizations/{id}/approve',[RegularizationController::class, 'approve'],  $secured);
$router->patch('/regularizations/{id}/reject', [RegularizationController::class, 'reject'],   $secured);

// ---- Settings & Geofences ----
$router->get   ('/settings',       [SettingsController::class, 'index'],           $auth);
$router->put   ('/settings',       [SettingsController::class, 'update'],          $secured);
$router->get   ('/geofences',      [SettingsController::class, 'geofences'],       $auth);
$router->post  ('/geofences',      [SettingsController::class, 'storeGeofence'],   $secured);
$router->delete('/geofences/{id}', [SettingsController::class, 'destroyGeofence'], $secured);

$router->dispatch(new Request());

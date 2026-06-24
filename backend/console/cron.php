<?php
/**
 * CLI cron worker. Schedule via Windows Task Scheduler / cron, e.g. hourly:
 *   php console/cron.php
 *
 * Tasks:
 *  - Purge expired sessions (auto-logout).
 *  - Mark yesterday's no-shows as 'absent' (so reports are complete).
 *  - Send attendance reminders to employees who have not checked in today.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Auth;
use App\Core\Database;
use App\Models\Holiday;
use App\Models\Notification;

echo "[cron] " . date('c') . "\n";

/* 1. Purge expired sessions */
$purged = Auth::purgeExpired();
echo "  purged {$purged} expired sessions\n";

/* 2. Mark yesterday's absentees (skip holidays) */
$yesterday = date('Y-m-d', strtotime('-1 day'));
if (Holiday::isHoliday($yesterday)) {
    echo "  {$yesterday} is a holiday — skipping absent marking\n";
    $absentees = [];
} else {
$absentees = Database::fetchAll(
    'SELECT u.id FROM users u
     WHERE u.role_id = 3 AND u.status = "active"
       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.attendance_date = ?)',
    [$yesterday]
);
foreach ($absentees as $u) {
    Database::run(
        'INSERT INTO attendance (user_id, attendance_date, status, remarks)
         VALUES (?,?,"absent","Auto-marked by system")
         ON DUPLICATE KEY UPDATE status = status',
        [$u['id'], $yesterday]
    );
}
echo "  marked " . count($absentees) . " absentees for {$yesterday}\n";
}

/* 3. Attendance reminders for today (run this in the morning) */
$today = date('Y-m-d');
$pending = Database::fetchAll(
    'SELECT u.id FROM users u
     WHERE u.role_id = 3 AND u.status = "active"
       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.attendance_date = ?)',
    [$today]
);
foreach ($pending as $u) {
    Notification::push((int)$u['id'], 'attendance_reminder', 'Mark your attendance',
        'You have not checked in yet today. Please mark your attendance.');
}
echo "  sent " . count($pending) . " attendance reminders\n";

/* 4. Birthday & work-anniversary alerts (today only) */
$celebrations = \App\Controllers\CelebrationController::compute(1);
$sent = 0;
foreach ($celebrations['today']['birthdays'] as $b) {
    Notification::push((int)$b['user_id'], 'birthday', '🎂 Happy Birthday!',
        'Wishing you a wonderful birthday from the whole team!', true);
    $sent++;
}
foreach ($celebrations['today']['anniversaries'] as $a) {
    Notification::push((int)$a['user_id'], 'work_anniversary', '🎉 Happy Work Anniversary!',
        "Congratulations on {$a['years']} year(s) with us!", true);
    $sent++;
}
echo "  sent {$sent} celebration alerts\n";
echo "[cron] done\n";

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

final class CelebrationController
{
    /** GET /celebrations?days=30 — today's + upcoming birthdays & work anniversaries. */
    public function index(Request $request): void
    {
        $days = min(90, max(1, (int)($request->query['days'] ?? 30)));
        Response::success(self::compute($days));
    }

    /** Build the celebrations payload. Reused by the cron worker. */
    public static function compute(int $days): array
    {
        $users = Database::fetchAll(
            'SELECT u.id, u.full_name, u.employee_code, u.profile_photo, u.date_of_birth, u.joining_date,
                    d.name AS department_name
             FROM users u LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.status = "active"'
        );

        $today = new \DateTimeImmutable('today');
        $todayList = ['birthdays' => [], 'anniversaries' => []];
        $upcoming  = [];

        $nextOccurrence = static function (string $date) use ($today): array {
            $d   = new \DateTimeImmutable($date);
            $occ = $d->setDate((int)$today->format('Y'), (int)$d->format('m'), (int)$d->format('d'));
            if ($occ < $today) {
                $occ = $occ->setDate((int)$today->format('Y') + 1, (int)$d->format('m'), (int)$d->format('d'));
            }
            return [$occ, (int)$today->diff($occ)->days];
        };

        foreach ($users as $u) {
            $base = [
                'user_id'         => (int)$u['id'],
                'full_name'       => $u['full_name'],
                'employee_code'   => $u['employee_code'],
                'profile_photo'   => $u['profile_photo'],
                'department_name' => $u['department_name'],
            ];

            if (!empty($u['date_of_birth'])) {
                [$occ, $away] = $nextOccurrence($u['date_of_birth']);
                if ($away === 0) {
                    $todayList['birthdays'][] = $base;
                } elseif ($away <= $days) {
                    $upcoming[] = $base + ['type' => 'birthday', 'date' => $occ->format('Y-m-d'), 'days_away' => $away];
                }
            }

            if (!empty($u['joining_date'])) {
                [$occ, $away] = $nextOccurrence($u['joining_date']);
                $years = (int)$occ->format('Y') - (int)(new \DateTimeImmutable($u['joining_date']))->format('Y');
                if ($years >= 1) {
                    if ($away === 0) {
                        $todayList['anniversaries'][] = $base + ['years' => $years];
                    } elseif ($away <= $days) {
                        $upcoming[] = $base + ['type' => 'anniversary', 'date' => $occ->format('Y-m-d'), 'days_away' => $away, 'years' => $years];
                    }
                }
            }
        }

        usort($upcoming, static fn($a, $b) => $a['days_away'] <=> $b['days_away']);

        return ['today' => $todayList, 'upcoming' => $upcoming];
    }
}

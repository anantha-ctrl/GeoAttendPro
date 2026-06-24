<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\Database;

/**
 * Geolocation utilities + geo-fencing.
 */
final class Geo
{
    /** Great-circle distance between two points, in metres (Haversine). */
    public static function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6_371_000.0; // metres
        $dLat  = deg2rad($lat2 - $lat1);
        $dLng  = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Validate a coordinate against active geofences.
     * Returns [bool $allowed, ?array $matchedFence, ?float $distance].
     * If geofencing is disabled or no fences exist, the location is allowed.
     */
    public static function withinFence(float $lat, float $lng): array
    {
        $enabled = (int)(Settings::get('geofence_enabled', '0'));
        if ($enabled !== 1) {
            return [true, null, null];
        }

        $fences = Database::fetchAll('SELECT * FROM geofences WHERE status = "active"');
        if ($fences === []) {
            return [true, null, null];
        }

        $closest = null;
        $closestDist = INF;
        foreach ($fences as $f) {
            $dist = self::distanceMeters($lat, $lng, (float)$f['latitude'], (float)$f['longitude']);
            if ($dist <= (float)$f['radius_m']) {
                return [true, $f, $dist];
            }
            if ($dist < $closestDist) {
                $closestDist = $dist;
                $closest = $f;
            }
        }
        return [false, $closest, $closestDist === INF ? null : $closestDist];
    }
}

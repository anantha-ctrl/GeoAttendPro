<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Encapsulates the incoming HTTP request (method, path, query, JSON/body, files, headers).
 */
final class Request
{
    public string $method;
    public string $path;
    public array  $query;
    public array  $body;
    public array  $files;
    public array  $params = [];   // route params e.g. /employees/{id}

    public function __construct()
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->query  = $_GET ?? [];
        $this->files  = $_FILES ?? [];

        // Path relative to the front controller
        $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        $this->path = '/' . trim(rawurldecode($uri), '/');

        $this->body = $this->parseBody();
    }

    private function parseBody(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'application/json')) {
            $raw     = file_get_contents('php://input') ?: '';
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        return $_POST ?? [];
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function only(array $keys): array
    {
        $out = [];
        foreach ($keys as $key) {
            if (array_key_exists($key, $this->body)) {
                $out[$key] = $this->body[$key];
            }
        }
        return $out;
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        if (!empty($_SERVER[$key])) {
            return $_SERVER[$key];
        }
        // Apache sometimes exposes Authorization only via the rewritten REDIRECT_ var.
        if (!empty($_SERVER['REDIRECT_' . $key])) {
            return $_SERVER['REDIRECT_' . $key];
        }
        // Fallback: getallheaders()/apache_request_headers() (case-insensitive match).
        $all = self::allHeaders();
        foreach ($all as $hName => $hValue) {
            if (strcasecmp($hName, $name) === 0) {
                return $hValue;
            }
        }
        return null;
    }

    /** Cached, case-preserving list of request headers (works on Apache, CGI, FPM). */
    private static function allHeaders(): array
    {
        static $headers = null;
        if ($headers !== null) {
            return $headers;
        }
        if (function_exists('getallheaders')) {
            $headers = getallheaders() ?: [];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers() ?: [];
        } else {
            $headers = [];
            foreach ($_SERVER as $k => $v) {
                if (str_starts_with($k, 'HTTP_')) {
                    $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
                    $headers[$name] = $v;
                }
            }
        }
        return $headers;
    }

    public function bearerToken(): ?string
    {
        $auth = $this->header('Authorization') ?? '';
        if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
            return $m[1];
        }
        // Fallback: token in X-Session-Token header or cookie
        return $this->header('X-Session-Token') ?? ($_COOKIE['gap_token'] ?? null);
    }

    public function ip(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
            if (!empty($_SERVER[$k])) {
                return trim(explode(',', $_SERVER[$k])[0]);
            }
        }
        return '0.0.0.0';
    }

    public function userAgent(): string
    {
        return substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 255);
    }
}

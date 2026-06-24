<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Tiny regex-based HTTP router with middleware support.
 * Route handlers are [ControllerClass, 'method'] arrays.
 */
final class Router
{
    /** @var array<int, array{method:string, pattern:string, handler:array, middleware:array}> */
    private array $routes = [];

    public function get(string $path, array $handler, array $mw = []): void    { $this->add('GET', $path, $handler, $mw); }
    public function post(string $path, array $handler, array $mw = []): void   { $this->add('POST', $path, $handler, $mw); }
    public function put(string $path, array $handler, array $mw = []): void    { $this->add('PUT', $path, $handler, $mw); }
    public function patch(string $path, array $handler, array $mw = []): void  { $this->add('PATCH', $path, $handler, $mw); }
    public function delete(string $path, array $handler, array $mw = []): void { $this->add('DELETE', $path, $handler, $mw); }

    private function add(string $method, string $path, array $handler, array $mw): void
    {
        // Convert /employees/{id} -> regex with named groups
        $pattern = preg_replace('#\{([a-zA-Z_]+)\}#', '(?P<$1>[^/]+)', $path);
        $this->routes[] = [
            'method'     => $method,
            'pattern'    => '#^' . $pattern . '$#',
            'handler'    => $handler,
            'middleware' => $mw,
        ];
    }

    public function dispatch(Request $request): void
    {
        $allowedForPath = [];

        foreach ($this->routes as $route) {
            if (!preg_match($route['pattern'], $request->path, $matches)) {
                continue;
            }
            $allowedForPath[] = $route['method'];
            if ($route['method'] !== $request->method) {
                continue;
            }

            // Extract named params
            foreach ($matches as $key => $val) {
                if (!is_int($key)) {
                    $request->params[$key] = $val;
                }
            }

            // Run middleware chain (each returns the (possibly enriched) request or halts)
            foreach ($route['middleware'] as $mwClass) {
                (new $mwClass())->handle($request);
            }

            [$class, $action] = $route['handler'];
            (new $class())->{$action}($request);
            return;
        }

        if ($allowedForPath !== []) {
            Response::error('Method not allowed.', 405, ['allowed' => $allowedForPath]);
        }
        Response::error('Resource not found.', 404);
    }
}

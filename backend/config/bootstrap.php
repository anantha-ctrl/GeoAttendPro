<?php
/**
 * Application bootstrap.
 * - Loads environment
 * - Registers a PSR-4 style autoloader for the App\ namespace
 * - Configures error handling & timezone
 */

declare(strict_types=1);

require __DIR__ . '/env.php';

date_default_timezone_set('Asia/Kolkata');

error_reporting(E_ALL);
ini_set('display_errors', env('APP_DEBUG', false) ? '1' : '0');
ini_set('log_errors', '1');

$storage = dirname(__DIR__) . '/storage/logs';
if (!is_dir($storage)) {
    @mkdir($storage, 0775, true);
}
ini_set('error_log', $storage . '/php-error.log');

/**
 * Autoloader: App\Foo\Bar  ->  backend/src/Foo/Bar.php
 */
spl_autoload_register(function (string $class): void {
    $prefix  = 'App\\';
    $baseDir = dirname(__DIR__) . '/src/';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file     = $baseDir . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

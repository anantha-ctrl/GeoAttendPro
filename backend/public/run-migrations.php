<?php
declare(strict_types=1);

header('Content-Type: text/plain');

echo "Starting migrations...\n\n";

// Disable error display limits
ini_set('display_errors', '1');
error_reporting(E_ALL);

try {
    echo "--- Phase 3 Migration ---\n";
    // We use ob to capture output from phase3.php
    ob_start();
    include dirname(__DIR__) . '/database/phase3.php';
    $phase3_out = ob_get_clean();
    echo $phase3_out;
} catch (\Throwable $e) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    echo "Exception in Phase 3: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

try {
    echo "\n--- Phase 4 Migration ---\n";
    ob_start();
    include dirname(__DIR__) . '/database/phase4.php';
    $phase4_out = ob_get_clean();
    echo $phase4_out;
} catch (\Throwable $e) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    echo "Exception in Phase 4: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

echo "\nDone running migrations.\n";

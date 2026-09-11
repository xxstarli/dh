<?php
// Copy to config.local.php, or keep outside the release and set DH_CONFIG in FPM.
return [
    'database' => __DIR__ . '/storage/navigation.db',
    'icons' => __DIR__ . '/storage/icons',
    'state' => __DIR__ . '/storage/php-state',
    'origin' => 'http://localhost:3000',
    'session_hours' => 12,
];

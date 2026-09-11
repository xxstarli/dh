<?php
declare(strict_types=1);

// Private application files are never the web root.
ini_set('display_errors', '0');
error_reporting(E_ALL);
foreach (['response', 'config', 'db', 'validation', 'auth', 'categories', 'sites', 'storage', 'favicon'] as $module) {
    require_once __DIR__ . '/' . $module . '.php';
}

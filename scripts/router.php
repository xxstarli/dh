<?php
// Development server only. Production Nginx serves public/ and routes /api/.
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (strpos($path, '/api/') === 0) {
    require dirname(__DIR__) . '/public/api/index.php';
} elseif ($path === '/' || $path === '/index.php') {
    require dirname(__DIR__) . '/public/index.php';
} elseif (preg_match('#^/assets/[a-zA-Z0-9_.-]+$#D', $path) && is_file(dirname(__DIR__) . '/public' . $path)) {
    return false;
} else {
    http_response_code(404);
    echo 'Not found';
}

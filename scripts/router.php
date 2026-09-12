<?php
// Development server only. Production Nginx serves public/ and routes /api/.
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (strpos($path, '/api/') === 0) {
    require dirname(__DIR__) . '/public/api/index.php';
} elseif ($path === '/' || $path === '/index.php') {
    // Buffer the development server's HTML response instead of many small writes.
    ob_start();
    require dirname(__DIR__) . '/public/index.php';
} elseif ((preg_match('#^/assets/(?:theme/doraemon/)?[a-zA-Z0-9_.-]+$#D', $path) || preg_match('#^/assets/theme/doraemon/(?:哆啦A梦_(?:顶部人物|Logo)|云朵_(?:顶部|底部)|任意门|铃铛|竹蜻蜓)\.png$#uD', rawurldecode($path))) && is_file(dirname(__DIR__) . '/public' . rawurldecode($path))) {
    return false;
} else {
    http_response_code(404);
    echo 'Not found';
}

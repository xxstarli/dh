<?php
declare(strict_types=1);

function config(): array
{
    static $config;
    if ($config !== null) return $config;
    $root = dirname(__DIR__);
    $path = getenv('DH_CONFIG') ?: $root . '/config.local.php';
    $values = is_file($path) ? require $path : [];
    if (!is_array($values)) throw new RuntimeException('Invalid configuration');
    $config = array_merge([
        'database' => $root . '/storage/navigation.db',
        'icons' => $root . '/storage/icons',
        'state' => $root . '/storage/php-state',
        'origin' => 'http://localhost:3000',
        'session_hours' => 12,
    ], $values);
    $origin = parse_url($config['origin']);
    if (!$origin || !in_array($origin['scheme'] ?? '', ['http', 'https'], true)
        || empty($origin['host']) || isset($origin['user']) || isset($origin['pass'])
        || isset($origin['query']) || isset($origin['fragment']) || !empty($origin['path'])) {
        throw new RuntimeException('APP_ORIGIN must be an exact origin without a path');
    }
    return $config;
}

function ensure_directory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
        throw new RuntimeException('Cannot create persistent directory');
    }
}

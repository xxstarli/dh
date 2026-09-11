<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$required = ['pdo_sqlite','curl','fileinfo','session','json','openssl','mbstring','zlib'];
$missing = array_values(array_filter($required, static fn($extension) => !extension_loaded($extension)));
if (PHP_VERSION_ID < 70400 || $missing) {
    fwrite(STDERR, 'Requires PHP 7.4+ and extensions: ' . implode(', ', $missing) . "\n"); exit(1);
}
$failed = false;
$root = dirname(__DIR__);
chdir($root);
$binary = strpos(PHP_BINARY, $root) === 0 ? substr(PHP_BINARY, strlen($root) + 1) : PHP_BINARY;
foreach (['app','public','scripts','tests/php'] as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory));
    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'php') continue;
        passthru(escapeshellarg($binary) . ' -l ' . escapeshellarg($file->getPathname()), $code);
        if ($code !== 0) $failed = true;
    }
}
exit($failed ? 1 : 0);

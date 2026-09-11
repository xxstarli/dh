<?php
declare(strict_types=1);
// Controlled transport integration fixture; never routed by the production API.
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__, 2) . '/app/bootstrap.php';
$path = $argv[1] ?? '/ok';
if (!in_array($path, ['/ok','/large','/stream','/slow','/redirect'], true)) exit(1);
$start = microtime(true);
try {
    $response = curl_download(['url'=>'http://transport.invalid:3133'.$path, 'host'=>'transport.invalid','port'=>3133,'ip'=>'127.0.0.1'], $start + ($path === '/slow' ? 0.25 : 3));
    echo json_encode(['ok'=>true,'status'=>$response['status'],'body'=>$response['body'],'seconds'=>microtime(true)-$start]);
} catch (Throwable $error) {
    echo json_encode(['ok'=>false,'seconds'=>microtime(true)-$start]);
}

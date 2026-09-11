<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
$path = config()['database'];
ensure_directory(dirname($path));
ensure_directory(config()['icons']);
ensure_directory(config()['state']);
$existing = is_file($path);
$connection = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if (!$existing) {
    $hash = trim(stream_get_contents(STDIN));
    if (!preg_match('/^\$2[aby]\$\d{2}\$[.\/A-Za-z0-9]{53}$/D', $hash)) {
        $connection = null; unlink($path);
        fwrite(STDERR, "A bcrypt hash on stdin is required for a new database. Existing databases are never reseeded.\n"); exit(1);
    }
    $connection->beginTransaction();
    try {
        $connection->exec(file_get_contents(dirname(__DIR__) . '/database/schema.sql'));
        $statement = $connection->prepare("INSERT INTO settings (id, site_name, admin_password_hash, created_at, updated_at) VALUES ('singleton', '我的导航', ?, ?, ?)");
        $statement->execute([$hash, now_ms(), now_ms()]);
        $connection->commit();
    } catch (Throwable $error) { $connection->rollBack(); throw $error; }
    chmod($path, 0640);
}
foreach (['categories' => ['id','name','sort_order','created_at','updated_at'], 'sites' => ['id','category_id','name','url','icon_type','icon_url','description','sort_order','created_at','updated_at'], 'settings' => ['id','site_name','site_logo','admin_password_hash','created_at','updated_at'], 'admin_sessions' => ['id','expires_at','created_at']] as $table => $columns) {
    $actual = array_column($connection->query('PRAGMA table_info(' . $table . ')')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (array_diff($columns, $actual)) throw new RuntimeException('Incompatible schema: ' . $table);
}
if ($connection->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') throw new RuntimeException('Database integrity failed');
if ($connection->query('PRAGMA foreign_key_check')->fetch()) throw new RuntimeException('Database relationships failed');
echo $existing ? "Existing V1 database validated; business schema and settings unchanged.\n" : "Database initialized without sample data.\n";

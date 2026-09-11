<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo;
    if ($pdo) return $pdo;
    if (!is_file(config()['database'])) throw new RuntimeException('Database is not initialized');
    $pdo = new PDO('sqlite:' . config()['database'], null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    return $pdo;
}

function query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function transaction(callable $work)
{
    // Acquire the write reservation before reading positions/relationships.
    db()->exec('BEGIN IMMEDIATE');
    try {
        $result = $work();
        db()->exec('COMMIT');
        return $result;
    } catch (Throwable $error) {
        db()->exec('ROLLBACK');
        throw $error;
    }
}

function now_ms(): int { return (int) floor(microtime(true) * 1000); }
function new_id(): string { return 'n' . bin2hex(random_bytes(16)); }
function ordered_row(array $row): array
{
    // PHP 7.4 PDO SQLite returns scalar columns as strings on some builds.
    $row['sort_order'] = (int) $row['sort_order'];
    return $row;
}

function navigation_data(): array
{
    $settings = query("SELECT site_name, site_logo FROM settings WHERE id = 'singleton'")->fetch();
    if (!$settings) throw new RuntimeException('Settings are not initialized');
    $categories = array_map('ordered_row', query('SELECT * FROM categories ORDER BY sort_order, created_at, id')->fetchAll());
    $sites = array_map('ordered_row', query('SELECT * FROM sites ORDER BY sort_order, created_at, id')->fetchAll());
    $byCategory = [];
    foreach ($sites as $site) $byCategory[$site['category_id']][] = $site;
    foreach ($categories as &$category) $category['sites'] = $byCategory[$category['id']] ?? [];
    return ['settings' => $settings, 'categories' => $categories];
}

<?php
declare(strict_types=1);

const ADMIN_COOKIE = 'navigation_admin';

function cookie_token(): ?string
{
    $token = $_COOKIE[ADMIN_COOKIE] ?? '';
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token) ? $token : null;
}

function authenticated(): bool
{
    $token = cookie_token();
    if (!$token) return false;
    $expires = query('SELECT expires_at FROM admin_sessions WHERE id = ?', [hash('sha256', $token)])->fetchColumn();
    if ($expires === false) return false;
    $time = is_numeric($expires) ? (float) $expires : strtotime($expires . ' UTC') * 1000;
    return $time > now_ms();
}

function csrf_token(): ?string
{
    $token = cookie_token();
    return $token ? hash_hmac('sha256', 'navigation-csrf-v1', $token) : null;
}

function require_admin(): void
{
    if (!authenticated()) throw new AppError('UNAUTHORIZED', '管理会话已失效，请重新验证', 401);
}

function same_origin(): void
{
    $source = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($source === null && isset($_SERVER['HTTP_REFERER'])) {
        $parts = parse_url($_SERVER['HTTP_REFERER']);
        if ($parts && isset($parts['scheme'], $parts['host']) && !isset($parts['user']) && !isset($parts['pass'])) {
            $source = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
        }
    }
    if (!is_string($source) || !hash_equals(config()['origin'], $source)) throw new AppError('INVALID_ORIGIN', '请求来源无效，请从站点页面操作', 403);
}

function require_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals(csrf_token() ?? '', $sent) || !$sent) throw new AppError('INVALID_CSRF', '请求验证已失效，请刷新页面后重试', 403);
}

function set_admin_cookie(string $token, int $expires): void
{
    setcookie(ADMIN_COOKIE, $token, ['expires' => $expires, 'path' => '/',
        'secure' => strpos(config()['origin'], 'https://') === 0,
        'httponly' => true, 'samesite' => 'Strict']);
}

function login_rate_limit(): void
{
    ensure_directory(config()['state']);
    // One small global bucket retains the original single-administrator limit;
    // flock makes it work across FPM workers without trusting proxy headers.
    $handle = fopen(config()['state'] . '/login-rate.json', 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('Cannot lock rate limiter');
    try {
        $times = json_decode(stream_get_contents($handle), true) ?: [];
        $times = array_values(array_filter($times, static fn($time) => is_int($time) && $time > time() - 60));
        if (count($times) >= 10) throw new AppError('RATE_LIMITED', '尝试次数过多，请一分钟后重试', 429);
        $times[] = time();
        rewind($handle);
        ftruncate($handle, 0);
        if (fwrite($handle, json_encode($times)) === false) throw new RuntimeException('Cannot persist rate limiter');
        fflush($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function login_admin($password): array
{
    if (!is_string($password) || strlen($password) > 1024 || $password === '') throw new AppError('INVALID_PASSWORD', '管理密码错误，请重新输入', 401);
    login_rate_limit();
    $hash = query("SELECT admin_password_hash FROM settings WHERE id = 'singleton'")->fetchColumn();
    if (!$hash || !password_verify($password, $hash)) throw new AppError('INVALID_PASSWORD', '管理密码错误，请重新输入', 401);
    $token = bin2hex(random_bytes(32));
    $expires = time() + max(1, min(24, (int) config()['session_hours'])) * 3600;
    transaction(static function () use ($token, $expires): void {
        query('DELETE FROM admin_sessions WHERE expires_at <= ? OR id = ?', [now_ms(), hash('sha256', cookie_token() ?? '')]);
        query('INSERT INTO admin_sessions (id, expires_at, created_at) VALUES (?, ?, ?)', [hash('sha256', $token), $expires * 1000, now_ms()]);
    });
    set_admin_cookie($token, $expires);
    $_COOKIE[ADMIN_COOKIE] = $token;
    return ['success' => true, 'csrf_token' => csrf_token()];
}

function logout_admin(): void
{
    $token = cookie_token();
    if ($token) query('DELETE FROM admin_sessions WHERE id = ?', [hash('sha256', $token)]);
    set_admin_cookie('', time() - 3600);
    unset($_COOKIE[ADMIN_COOKIE]);
}

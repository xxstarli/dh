<?php
declare(strict_types=1);
require_once __DIR__ . '/dns.php';

function public_ip(string $ip): bool
{
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    $binary = inet_pton($ip);
    if (strlen($binary) === 4) {
        $value = unpack('N', $binary)[1];
        foreach ([['0.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as [$network, $bits]) {
            $mask = (0xffffffff << (32 - $bits)) & 0xffffffff;
            if (($value & $mask) === (unpack('N', inet_pton($network))[1] & $mask)) return false;
        }
        return true;
    }
    // Restrict IPv6 to global unicast, excluding transition/documentation blocks.
    return (ord($binary[0]) & 224) === 32
        && substr($binary, 0, 4) !== "\x20\x01\x0d\xb8"
        && substr($binary, 0, 2) !== "\x20\x02"
        && !(substr($binary, 0, 2) === "\x20\x01" && ord($binary[2]) < 2);
}

function safe_target(string $url, float $deadline, ?callable $resolver = null): array
{
    $url = normalize_url($url);
    $parts = parse_url($url);
    $host = trim($parts['host'], '[]');
    $port = $parts['port'] ?? ($parts['scheme'] === 'https' ? 443 : 80);
    if (!in_array($port, [80, 443], true) || preg_match('/(^|\.)(localhost|local|internal)$/i', rtrim($host, '.'))) throw new RuntimeException('Private target');
    $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : ($resolver ?? 'dns_addresses')($host, $deadline);
    if (!$addresses) throw new RuntimeException('DNS unavailable');
    foreach ($addresses as $ip) if (!public_ip($ip)) throw new RuntimeException('Private target');
    return ['url' => $url, 'host' => $host, 'port' => $port, 'ip' => $addresses[0]];
}

function relative_url(string $base, string $value): string
{
    $value = trim(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $value)) return normalize_url($value);
    $parts = parse_url($base);
    if (substr($value, 0, 2) === '//') return normalize_url($parts['scheme'] . ':' . $value);
    $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if ($value === '') return $base;
    if ($value[0] === '/') return normalize_url($origin . $value);
    $path = $parts['path'] ?? '/';
    if ($value[0] === '?') return normalize_url($origin . $path . $value);
    $segments = explode('/', substr($path, 0, strrpos($path, '/') + 1) . $value);
    $resolved = [];
    foreach ($segments as $part) { if ($part === '..') array_pop($resolved); elseif ($part !== '.') $resolved[] = $part; }
    return normalize_url($origin . '/' . ltrim(implode('/', $resolved), '/'));
}

function curl_download(array $target, float $deadline): array
{
    $remaining = (int) (($deadline - microtime(true)) * 1000);
    if ($remaining <= 0) throw new RuntimeException('Download timeout');
    $handle = curl_init($target['url']);
    $body = ''; $headers = []; $headerBytes = 0;
    $ip = strpos($target['ip'], ':') !== false ? '[' . $target['ip'] . ']' : $target['ip'];
    curl_setopt_array($handle, [
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_MAXREDIRS => 0,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_CONNECTTIMEOUT_MS => min(2000, $remaining), CURLOPT_TIMEOUT_MS => $remaining,
        CURLOPT_PROXY => '', CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_RESOLVE => [$target['host'] . ':' . $target['port'] . ':' . $ip],
        CURLOPT_USERAGENT => 'PersonalNavigation/1.1',
        CURLOPT_HTTPHEADER => ['Accept: text/html,image/png,image/jpeg,image/webp,image/x-icon'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > MAX_ICON_BYTES) return 0;
            $body .= $chunk; return strlen($chunk);
        },
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$headers, &$headerBytes): int {
            $headerBytes += strlen($line);
            if ($headerBytes > 32768) return 0;
            if (strpos($line, ':') !== false) { [$key, $value] = explode(':', $line, 2); $headers[strtolower(trim($key))] = trim($value); }
            if (isset($headers['content-length']) && (float) $headers['content-length'] > MAX_ICON_BYTES) return 0;
            return strlen($line);
        },
    ]);
    try {
        if (!curl_exec($handle)) throw new RuntimeException('Download failed');
        return ['status' => curl_getinfo($handle, CURLINFO_RESPONSE_CODE), 'headers' => $headers, 'body' => $body];
    } finally { curl_close($handle); }
}

function fetch_public(string $url, float $deadline, ?callable $resolver = null, ?callable $transport = null): array
{
    for ($redirect = 0; $redirect <= 3; $redirect++) {
        $target = safe_target($url, $deadline, $resolver);
        if (microtime(true) >= $deadline) throw new RuntimeException('Download timeout');
        $response = ($transport ?? 'curl_download')($target, $deadline);
        if (microtime(true) >= $deadline || strlen($response['body']) > MAX_ICON_BYTES) throw new RuntimeException('Download limit');
        if (in_array($response['status'], [301, 302, 303, 307, 308], true)) {
            if ($redirect === 3 || empty($response['headers']['location'])) throw new RuntimeException('Redirect limit');
            $url = relative_url($target['url'], $response['headers']['location']);
            continue;
        }
        if ($response['status'] !== 200) throw new RuntimeException('Download status');
        $response['url'] = $target['url'];
        return $response;
    }
    throw new RuntimeException('Redirect limit');
}

function fetch_favicon(string $url): ?string
{
    $deadline = microtime(true) + 6;
    try {
        $url = normalize_url($url);
        $candidates = [];
        try {
            $page = fetch_public($url, $deadline);
            if (strpos($page['headers']['content-type'] ?? '', 'image/') === 0) return store_icon(png_from_ico($page['body']));
            preg_match_all('/<link\b[^>]{0,2048}>/i', $page['body'], $tags);
            foreach (array_slice($tags[0], 0, 100) as $tag) {
                if (!preg_match('/\brel\s*=\s*[\x22\x27]([^\x22\x27]+)[\x22\x27]/i', $tag, $rel) || !preg_match('/(^|\s)(icon|apple-touch-icon)(\s|$)/i', $rel[1])) continue;
                if (preg_match('/\bhref\s*=\s*[\x22\x27]([^\x22\x27]+)[\x22\x27]/i', $tag, $href)) {
                    try { $candidates[] = relative_url($page['url'], $href[1]); } catch (Throwable $ignored) {}
                }
                if (count($candidates) >= 5) break;
            }
        } catch (Throwable $ignored) {}
        $candidates[] = relative_url($url, '/favicon.ico');
        foreach (array_unique($candidates) as $candidate) {
            if (microtime(true) >= $deadline) break;
            try { return store_icon(png_from_ico(fetch_public($candidate, $deadline)['body'])); } catch (Throwable $ignored) {}
        }
    } catch (Throwable $ignored) {}
    return null;
}

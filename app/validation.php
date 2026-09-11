<?php
declare(strict_types=1);

function text_value($value, string $field, int $max, bool $required = true): string
{
    if (!is_string($value)) throw new AppError('INVALID_INPUT', '字段格式无效', 400, [$field => '字段格式无效']);
    $value = preg_replace('/^[\s\x{FEFF}]+|[\s\x{FEFF}]+$/u', '', $value);
    if ($value === null || !mb_check_encoding($value, 'UTF-8')) throw new AppError('INVALID_INPUT', '文字编码无效');
    $message = $required && $value === '' ? ($field === 'category_id' ? '请选择所属分类' : '名称不能为空') : '';
    if (strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 > $max) {
        $message = ($field === 'description' ? '说明' : '名称') . '最多 ' . $max . ' 字符';
    }
    if ($message) throw new AppError('INVALID_INPUT', $message, 400, [$field => $message]);
    return $value;
}

function only_fields(array $value, array $allowed): void
{
    if (array_diff(array_keys($value), $allowed)) throw new AppError('INVALID_INPUT', '包含不支持的字段');
}

function normalize_url($input): string
{
    $error = static function (): void { throw new AppError('INVALID_URL', '请输入正确的 HTTP / HTTPS 网站地址', 400, ['url' => '请输入正确的 HTTP / HTTPS 网站地址']); };
    if (!is_string($input) || strlen($input) > 8192 || mb_strlen($input, 'UTF-8') > 2048) $error();
    $raw = trim($input);
    if ($raw === '' || preg_match('/[\s\\\\\x00-\x1f\x7f]/u', $raw)) $error();
    $hasScheme = preg_match('/^[a-z][a-z0-9+.-]*:/i', $raw) && !preg_match('/^[^\/:]+\.\w+:\d+(\/|$)/', $raw);
    $parts = parse_url($hasScheme ? $raw : 'https://' . $raw);
    if (!$parts) $error();
    $scheme = strtolower($parts['scheme'] ?? '');
    $host = strtolower($parts['host'] ?? '');
    if (!in_array($scheme, ['http', 'https'], true) || !$host || isset($parts['user']) || isset($parts['pass'])) $error();
    if (preg_match('/[^\x00-\x7f]/', $host)) {
        $host = function_exists('idn_to_ascii') ? idn_to_ascii($host, 0, INTL_IDNA_VARIANT_UTS46) : false;
        if (!$host) $error();
    }
    if ($host[0] === '[') {
        if (!filter_var(substr($host, 1, -1), FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) $error();
    } elseif (!filter_var($host, FILTER_VALIDATE_IP)) {
        if (($host !== 'localhost' && strpos($host, '.') === false)
            || !preg_match('/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.?$/i', $host)
            || strpos($host, '..') !== false) $error();
    }
    $port = $parts['port'] ?? null;
    if ($port !== null && ($port < 1 || $port > 65535)) $error();
    $portPart = $port && !(($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) ? ':' . $port : '';
    $tail = ($parts['path'] ?? '/') ?: '/';
    if (isset($parts['query'])) $tail .= '?' . $parts['query'];
    if (isset($parts['fragment'])) $tail .= '#' . $parts['fragment'];
    $tail = preg_replace_callback('/[^\x21-\x7e]/u', static fn($m) => rawurlencode($m[0]), $tail);
    return $scheme . '://' . $host . $portPart . $tail;
}

function category_input(array $value): array
{
    only_fields($value, ['name']);
    return ['name' => text_value($value['name'] ?? '', 'name', 30)];
}

function site_input(array $value): array
{
    only_fields($value, ['name', 'url', 'description', 'category_id', 'icon_type', 'icon_url']);
    $name = text_value($value['name'] ?? '', 'name', 30);
    $url = normalize_url($value['url'] ?? '');
    $description = text_value($value['description'] ?? '', 'description', 50, false);
    $category = text_value($value['category_id'] ?? '', 'category_id', 200);
    $type = $value['icon_type'] ?? 'default';
    $icon = $value['icon_url'] ?? null;
    if (!in_array($type, ['auto', 'custom', 'default'], true)
        || ($icon !== null && (!is_string($icon) || !preg_match('#^/api/icons/[a-f0-9]{64}\.(?:png|jpg|webp)$#D', $icon)))
        || (($type === 'default') !== ($icon === null))) {
        throw new AppError('INVALID_INPUT', '图标状态无效', 400, ['icon_url' => '图标状态无效']);
    }
    return ['name' => $name, 'url' => $url, 'description' => $description ?: null,
        'category_id' => $category, 'icon_type' => $type, 'icon_url' => $icon];
}

function sort_ids($ids): array
{
    if (!is_array($ids) || count($ids) > 10000 || array_values($ids) !== $ids) throw new AppError('INVALID_SORT_DATA', '排序数据无效');
    foreach ($ids as $id) if (!is_string($id) || $id === '' || strlen($id) > 200) throw new AppError('INVALID_SORT_DATA', '排序 ID 无效');
    if (count(array_unique($ids)) !== count($ids)) throw new AppError('INVALID_SORT_DATA', '排序不能包含重复 ID');
    return $ids;
}

function exact_ids(array $ids, array $rows): void
{
    $current = array_column($rows, 'id');
    if (count($ids) !== count($current) || array_diff($current, $ids)) throw new AppError('INVALID_SORT_DATA', '排序数据已变化，请刷新后重试', 409);
}

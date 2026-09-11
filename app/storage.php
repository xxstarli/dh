<?php
declare(strict_types=1);

const MAX_ICON_BYTES = 2097152;

function icon_file(string $name): string
{
    if (!preg_match('/^[a-f0-9]{64}\.(png|jpg|webp)$/D', $name)) throw new AppError('INVALID_FILE_TYPE', '图标地址无效', 404);
    return config()['icons'] . '/' . $name;
}

function image_format(string $bytes, ?string $declared = null): array
{
    $size = strlen($bytes);
    if ($size > MAX_ICON_BYTES) throw new AppError('UPLOAD_TOO_LARGE', '图片大小不能超过 2MB', 413);
    $bad = static function (): void { throw new AppError('INVALID_FILE_TYPE', '图片无法识别或已经损坏，仅支持 PNG、JPG、WebP'); };
    if ($size < 12) $bad();
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
    $formats = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
    if (!isset($formats[$mime]) || ($declared !== null && $declared !== $mime)) $bad();
    $dimensions = @getimagesizefromstring($bytes);
    if (!$dimensions || $dimensions[0] < 1 || $dimensions[1] < 1 || $dimensions[0] * $dimensions[1] > 16000000) $bad();
    if ($mime === 'image/png') {
        if (substr($bytes, 0, 8) !== "\x89PNG\r\n\x1a\n") $bad();
        $offset = 8; $idat = ''; $ended = false;
        while ($offset + 12 <= $size) {
            $length = unpack('N', substr($bytes, $offset, 4))[1];
            if ($length > $size - $offset - 12) $bad();
            $type = substr($bytes, $offset + 4, 4);
            $chunk = substr($bytes, $offset + 4, $length + 4);
            if (hash('crc32b', $chunk, true) !== substr($bytes, $offset + 8 + $length, 4)) $bad();
            if ($offset === 8 && ($type !== 'IHDR' || $length !== 13)) $bad();
            if ($type === 'IDAT') $idat .= substr($bytes, $offset + 8, $length);
            $offset += $length + 12;
            if ($type === 'IEND') { $ended = $length === 0 && $offset === $size; break; }
        }
        if (!$ended || $idat === '' || @gzuncompress($idat, 67108864) === false) $bad();
    } elseif ($mime === 'image/jpeg') {
        if (substr($bytes, 0, 3) !== "\xff\xd8\xff" || substr($bytes, -2) !== "\xff\xd9") $bad();
        $offset = 2; $scan = false;
        while ($offset < $size - 2) {
            if (ord($bytes[$offset++]) !== 255) $bad();
            while ($offset < $size && ord($bytes[$offset]) === 255) $offset++;
            if ($offset >= $size) $bad();
            $marker = ord($bytes[$offset++]);
            if ($scan && ($marker === 0 || ($marker >= 208 && $marker <= 215))) continue;
            if ($marker === 217) break;
            if ($offset + 2 > $size) $bad();
            $length = unpack('n', substr($bytes, $offset, 2))[1];
            if ($length < 2 || $offset + $length > $size - 2) $bad();
            $offset += $length;
            if ($marker === 218) $scan = true;
            if ($scan) {
                $next = strpos($bytes, "\xff", $offset);
                if ($next === false) $bad();
                $offset = $next;
            }
        }
        if (!$scan) $bad();
    } else {
        if (substr($bytes, 0, 4) !== 'RIFF' || substr($bytes, 8, 4) !== 'WEBP'
            || unpack('V', substr($bytes, 4, 4))[1] + 8 !== $size) $bad();
        $offset = 12; $image = false;
        while ($offset + 8 <= $size) {
            $type = substr($bytes, $offset, 4);
            $length = unpack('V', substr($bytes, $offset + 4, 4))[1];
            if ($length > $size - $offset - 8) $bad();
            if (in_array($type, ['VP8 ', 'VP8L', 'ANMF'], true)) $image = $length > 4;
            $offset += 8 + $length + ($length % 2);
        }
        if (!$image || $offset !== $size) $bad();
    }
    return ['mime' => $mime, 'extension' => $formats[$mime]];
}

function store_icon(string $bytes, ?string $declared = null): string
{
    $format = image_format($bytes, $declared);
    ensure_directory(config()['icons']);
    $name = hash('sha256', $bytes) . '.' . $format['extension'];
    $path = icon_file($name);
    if (!is_file($path)) {
        $temp = tempnam(config()['icons'], '.upload-');
        if ($temp === false) throw new RuntimeException('Cannot create icon');
        try {
            if (file_put_contents($temp, $bytes, LOCK_EX) !== strlen($bytes) || !rename($temp, $path)) throw new RuntimeException('Cannot store icon');
            chmod($path, 0640);
        } finally { if (is_file($temp)) unlink($temp); }
    }
    return '/api/icons/' . $name;
}

function upload_icon(): string
{
    $file = $_FILES['file'] ?? null;
    if (!$file || !is_array($file) || is_array($file['error'] ?? null)) throw new AppError('INVALID_FILE_TYPE', '请选择图片');
    if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) throw new AppError('UPLOAD_TOO_LARGE', '图片大小不能超过 2MB', 413);
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) throw new AppError('INVALID_FILE_TYPE', '图片上传失败，请重试');
    if ($file['size'] > MAX_ICON_BYTES) throw new AppError('UPLOAD_TOO_LARGE', '图片大小不能超过 2MB', 413);
    $bytes = file_get_contents($file['tmp_name'], false, null, 0, MAX_ICON_BYTES + 1);
    if ($bytes === false) throw new RuntimeException('Cannot read upload');
    return store_icon($bytes, $file['type']);
}

function serve_icon(string $name): void
{
    $file = icon_file($name);
    if (!is_file($file)) throw new AppError('NOT_FOUND', '图标不存在', 404);
    $mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp'][pathinfo($name, PATHINFO_EXTENSION)];
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') readfile($file);
}

function png_from_ico(string $bytes): string
{
    if (substr($bytes, 0, 4) !== "\0\0\1\0" || strlen($bytes) < 22) return $bytes;
    $count = unpack('v', substr($bytes, 4, 2))[1];
    if (!$count || $count > 64 || strlen($bytes) < 6 + 16 * $count) throw new RuntimeException('Invalid ICO');
    for ($i = 0; $i < $count; $i++) {
        $entry = unpack('Vsize/Voffset', substr($bytes, 6 + 16 * $i + 8, 8));
        if ($entry['offset'] < 6 + 16 * $count || $entry['size'] > strlen($bytes) - $entry['offset']) continue;
        $png = substr($bytes, $entry['offset'], $entry['size']);
        if (substr($png, 0, 8) === "\x89PNG\r\n\x1a\n") return $png;
    }
    throw new RuntimeException('Unsupported ICO');
}

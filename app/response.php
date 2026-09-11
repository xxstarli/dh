<?php
declare(strict_types=1);

final class AppError extends RuntimeException
{
    public string $errorCode;
    public int $status;
    public array $fields;
    public function __construct(string $code, string $message, int $status = 400, array $fields = [])
    {
        parent::__construct($message);
        $this->errorCode = $code;
        $this->status = $status;
        $this->fields = $fields;
    }
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function request_json(): array
{
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        throw new AppError('INVALID_INPUT', '请使用 JSON 请求');
    }
    $raw = file_get_contents('php://input', false, null, 0, 262145);
    if ($raw === false || strlen($raw) > 262144) {
        throw new AppError('INVALID_INPUT', '请求内容过大', 413);
    }
    try {
        $value = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        throw new AppError('INVALID_INPUT', '请求格式无效');
    }
    if (!is_array($value) || substr(ltrim($raw), 0, 1) !== '{') {
        throw new AppError('INVALID_INPUT', '请求格式无效');
    }
    return $value;
}

<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/app/bootstrap.php';

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($method === 'GET' && $path === '/api/navigation') {
        json_response(navigation_data());
    } elseif (in_array($method, ['GET', 'HEAD'], true) && preg_match('#^/api/icons/([^/]+)$#D', $path, $match)) {
        serve_icon($match[1]);
    } elseif ($method === 'GET' && $path === '/api/admin/session') {
        $admin = authenticated();
        json_response(['authenticated' => $admin, 'csrf_token' => $admin ? csrf_token() : null]);
    } elseif ($method === 'POST' && $path === '/api/admin/login') {
        same_origin();
        json_response(login_admin(request_json()['password'] ?? null));
    } elseif (strpos($path, '/api/admin/') === 0) {
        require_admin();
        same_origin();
        require_csrf();
        $resource = substr($path, strlen('/api/admin/'));
        if ($method === 'POST' && $resource === 'logout') {
            logout_admin(); json_response(['success' => true]);
        } elseif ($method === 'POST' && $resource === 'categories') {
            json_response(save_category(null, request_json()), 201);
        } elseif ($method === 'POST' && $resource === 'sites') {
            json_response(save_site(null, request_json()), 201);
        } elseif ($method === 'PUT' && $resource === 'categories/reorder') {
            reorder_categories(request_json()['category_ids'] ?? null); json_response(['success' => true]);
        } elseif ($method === 'PUT' && $resource === 'sites/reorder') {
            $body = request_json();
            reorder_sites(text_value($body['category_id'] ?? '', 'category_id', 200), $body['site_ids'] ?? null);
            json_response(['success' => true]);
        } elseif (preg_match('#^(categories|sites)/([^/]+)$#D', $resource, $match) && in_array($method, ['PATCH', 'DELETE'], true)) {
            $id = rawurldecode($match[2]);
            $category = $match[1] === 'categories';
            $result = $method === 'DELETE' ? ($category ? delete_category($id) : delete_site($id))
                : ($category ? save_category($id, request_json()) : save_site($id, request_json()));
            json_response($result);
        } elseif ($method === 'POST' && $resource === 'uploads/site-icon') {
            json_response(['icon_url' => upload_icon()], 201);
        } elseif ($method === 'POST' && $resource === 'favicon') {
            $url = normalize_url(request_json()['url'] ?? '');
            $icon = fetch_favicon($url);
            json_response(['success' => $icon !== null, 'icon_url' => $icon]);
        } else throw new AppError('NOT_FOUND', '接口不存在', 404);
    } else throw new AppError('NOT_FOUND', '接口不存在', 404);
} catch (AppError $error) {
    json_response(['success' => false, 'code' => $error->errorCode, 'message' => $error->getMessage(), 'fields' => $error->fields], $error->status);
} catch (Throwable $error) {
    error_log('Navigation API failed: ' . get_class($error));
    json_response(['success' => false, 'code' => 'SAVE_FAILED', 'message' => '保存失败，请稍后重试'], 500);
}

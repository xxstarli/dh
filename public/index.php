<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
require_once dirname(__DIR__) . '/app/view.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
try {
    $data = navigation_data();
    $admin = authenticated();
    $initial = ['data' => $data, 'admin' => $admin, 'csrf' => $admin ? csrf_token() : null];
} catch (Throwable $error) {
    error_log('Navigation page failed: ' . get_class($error));
    http_response_code(503);
    $data = ['settings' => ['site_name' => '我的导航', 'site_logo' => null], 'categories' => []];
    $initial = ['error' => true];
}
?><!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?= h($data['settings']['site_name']) ?></title><link rel="icon" href="/assets/brand.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/app.css"><script defer src="/assets/sortable.min.js"></script><script type="module" src="/assets/app.js"></script></head>
<body>
<header class="topbar"><div class="topbar-inner"><div class="brand"><?= $data['settings']['site_logo'] ? site_icon($data['settings']['site_logo'], '站点') : '<span class="brand-icon">' . svg('Compass', 27) . '</span>' ?><div><h1><?= h($data['settings']['site_name']) ?></h1><p>高效上网，从这里开始</p></div></div><div class="search-box"><?= svg('Search') ?><input aria-label="搜索网站" placeholder="搜索网站..." id="search"><button class="icon-button" aria-label="清除搜索" data-action="clear-search" hidden><?= svg('X', 17) ?></button></div><button class="button primary manage-button" disabled><?= svg('Settings', 18) ?><span>管理</span></button></div></header>
<main class="page-content"><?php if (!empty($initial['error'])): ?><div class="empty-state"><h2>加载失败，请稍后重试</h2><button class="button secondary" data-action="retry">重新加载</button></div><?php else: ?><div id="categories"><?php render_categories($data['categories']); ?></div><?php if (!array_filter($data['categories'], static fn($c) => count($c['sites']) > 0)): ?><div class="empty-state"><?= svg('FolderOpen', 36) ?><h2><?= $data['categories'] ? '暂无网站' : '还没有添加分类' ?></h2><p>进入管理模式，开始整理你的常用网站。</p></div><?php endif; ?><?php endif; ?></main>
<script type="application/json" id="initial-data"><?= json_encode($initial, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) ?></script>
<noscript><p class="notice">浏览网站可直接点击卡片，搜索与管理需要启用 JavaScript。</p></noscript>
</body></html>

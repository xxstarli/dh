<?php
declare(strict_types=1);

function h($text): string { return htmlspecialchars((string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function svg(string $name, int $size = 20, string $class = '', string $label = ''): string
{
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' . ($name === 'Compass' ? '1.6' : '2') . '" stroke-linecap="round" stroke-linejoin="round" class="' . h($class) . '" ' . ($label ? 'role="img" aria-label="' . h($label) . '"' : 'aria-hidden="true"') . '><use href="/assets/icons.svg#' . h($name) . '"></use></svg>';
}
function site_icon(?string $url, string $name): string
{
    return '<span class="site-icon">' . ($url ? '<img src="' . h($url) . '" alt="' . h($name) . '图标" width="44" height="44">' : svg('Globe2', 30, '', '默认网站图标')) . '</span>';
}
function category_icon(string $name): string
{
    foreach (['/常用/' => 'Star', '/AI|人工智能/i' => 'Bot', '/开发/' => 'Monitor', '/办公/' => 'Briefcase', '/设计/' => 'Palette', '/卡牌/' => 'WalletCards'] as $pattern => $icon) {
        if (preg_match($pattern, $name)) return svg($icon, 21, 'category-icon ' . ($icon === 'Star' ? 'star' : ''));
    }
    return svg('Folder', 21, 'category-icon');
}
function render_categories(array $categories): void
{
    foreach ($categories as $category) {
        if (!$category['sites']) continue;
        echo '<section class="category" aria-label="' . h($category['name']) . '" data-category-id="' . h($category['id']) . '"><header class="category-header">' . category_icon($category['name']) . '<h2>' . h($category['name']) . '</h2><span class="count" aria-label="' . count($category['sites']) . ' 个网站">' . count($category['sites']) . '</span></header><div class="site-grid">';
        foreach ($category['sites'] as $site) {
            $description = $site['description'] ?: parse_url($site['url'], PHP_URL_HOST);
            echo '<div class="site-wrap" data-site-id="' . h($site['id']) . '"><a class="site-card" href="' . h($site['url']) . '" target="_blank" rel="noopener noreferrer" title="' . h($site['name'] . ' — ' . $description) . '">' . site_icon($site['icon_url'], $site['name']) . '<span class="site-text"><strong>' . h($site['name']) . '</strong><span>' . h($description) . '</span></span></a></div>';
        }
        echo '</div></section>';
    }
}

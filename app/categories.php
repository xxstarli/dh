<?php
declare(strict_types=1);

function category_row(string $id): array
{
    $row = query('SELECT * FROM categories WHERE id = ?', [$id])->fetch();
    if (!$row) throw new AppError('CATEGORY_NOT_FOUND', '分类不存在，请刷新后重试', 404);
    return ordered_row($row);
}

function save_category(?string $id, array $input): array
{
    $value = category_input($input);
    return transaction(static function () use ($id, $value): array {
        $now = now_ms();
        if ($id !== null) {
            category_row($id);
            query('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?', [$value['name'], $now, $id]);
        } else {
            $id = new_id();
            $order = (int) query('SELECT COALESCE(MAX(sort_order), 0) FROM categories')->fetchColumn() + 1;
            query('INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [$id, $value['name'], $order, $now, $now]);
        }
        return category_row($id);
    });
}

function delete_category(string $id): array
{
    return transaction(static function () use ($id): array {
        $row = category_row($id);
        $count = (int) query('SELECT COUNT(*) FROM sites WHERE category_id = ?', [$id])->fetchColumn();
        if ($count) throw new AppError('CATEGORY_NOT_EMPTY', "当前分类下还有 {$count} 个网站，请先移动或删除这些网站。");
        query('DELETE FROM categories WHERE id = ?', [$id]);
        return $row;
    });
}

function reorder_categories($input): void
{
    $ids = sort_ids($input);
    transaction(static function () use ($ids): void {
        exact_ids($ids, query('SELECT id FROM categories')->fetchAll());
        foreach ($ids as $i => $id) query('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?', [$i + 1, now_ms(), $id]);
    });
}

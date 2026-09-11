<?php
declare(strict_types=1);

function site_row(string $id): array
{
    $row = query('SELECT * FROM sites WHERE id = ?', [$id])->fetch();
    if (!$row) throw new AppError('SITE_NOT_FOUND', '网站不存在，请刷新后重试', 404);
    return ordered_row($row);
}

function save_site(?string $id, array $input): array
{
    $value = site_input($input);
    if ($value['icon_url'] && !is_file(icon_file(basename($value['icon_url'])))) throw new AppError('INVALID_INPUT', '图标文件不存在，请重新上传');
    return transaction(static function () use ($id, $value): array {
        category_row($value['category_id']);
        $old = $id !== null ? site_row($id) : null;
        $order = $old && $old['category_id'] === $value['category_id'] ? $old['sort_order']
            : (int) query('SELECT COALESCE(MAX(sort_order), 0) FROM sites WHERE category_id = ?', [$value['category_id']])->fetchColumn() + 1;
        $value['sort_order'] = $order;
        $value['updated_at'] = now_ms();
        if ($id !== null) {
            $assign = implode(', ', array_map(static fn($key) => $key . ' = ?', array_keys($value)));
            query('UPDATE sites SET ' . $assign . ' WHERE id = ?', array_merge(array_values($value), [$id]));
        } else {
            $id = new_id();
            $value['id'] = $id;
            $value['created_at'] = $value['updated_at'];
            query('INSERT INTO sites (' . implode(', ', array_keys($value)) . ') VALUES (' . implode(', ', array_fill(0, count($value), '?')) . ')', array_values($value));
        }
        return site_row($id);
    });
}

function delete_site(string $id): array
{
    return transaction(static function () use ($id): array {
        $row = site_row($id);
        query('DELETE FROM sites WHERE id = ?', [$id]);
        return $row;
    });
}

function reorder_sites(string $categoryId, $input): void
{
    $ids = sort_ids($input);
    transaction(static function () use ($categoryId, $ids): void {
        category_row($categoryId);
        exact_ids($ids, query('SELECT id FROM sites WHERE category_id = ?', [$categoryId])->fetchAll());
        foreach ($ids as $i => $id) query('UPDATE sites SET sort_order = ?, updated_at = ? WHERE id = ?', [$i + 1, now_ms(), $id]);
    });
}

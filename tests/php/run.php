<?php
declare(strict_types=1);
// All mutations use an isolated copy. V1_DATABASE_COPY is optional for private
// local compatibility verification; production data is never sent to CI.
ob_start();
$root = dirname(__DIR__, 2);
$folder = $root . '/storage/php-tests-' . getmypid();
mkdir($folder, 0700, true);
$config = $folder . '/config.php';
file_put_contents($config, '<?php return ' . var_export(['database' => $folder . '/test.db', 'icons' => $folder . '/icons', 'state' => $folder . '/state', 'origin' => 'http://localhost:3100', 'session_hours' => 12], true) . ';');
putenv('DH_CONFIG=' . $config);
$copy = getenv('V1_DATABASE_COPY');
if ($copy) {
    if (!copy($copy, $folder . '/test.db')) throw new RuntimeException('Cannot copy V1 database');
} else {
    $pdo = new PDO('sqlite:' . $folder . '/test.db');
    $pdo->exec(file_get_contents($root . '/database/schema.sql'));
    $statement = $pdo->prepare("INSERT INTO settings (id, site_name, admin_password_hash, created_at, updated_at) VALUES ('singleton', '我的导航', ?, 1, 1)");
    $statement->execute([password_hash('Navigation-test-only-2026', PASSWORD_BCRYPT, ['cost' => 12])]);
    $pdo = null;
}
require $root . '/app/bootstrap.php';
require $root . '/app/view.php';
$images = json_decode(file_get_contents(dirname(__DIR__) . '/images.json'), true);
$passed = []; $failures = []; $assertions = 0;
function check(bool $condition, string $message = 'Assertion failed'): void
{
    global $assertions; $assertions++;
    if (!$condition) throw new RuntimeException($message . ' at assertion line ' . (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[0]['line'] ?? 0));
}
function rejects(callable $action, ?string $code = null): void
{
    try { $action(); } catch (Throwable $error) {
        check($code === null || ($error instanceof AppError && $error->errorCode === $code), 'Wrong error: ' . get_class($error)); return;
    }
    throw new RuntimeException('Expected rejection');
}
function run_test(string $name, callable $action): void
{
    global $passed, $failures;
    try { $action(); $passed[] = $name; } catch (Throwable $error) { $failures[] = ['test' => $name, 'error' => $error->getMessage(), 'line' => $error->getLine()]; }
}
run_test('V1 schema, settings, IDs, sorting and old WebP compatibility', static function () use ($images): void {
    $before = query("SELECT * FROM settings WHERE id = 'singleton'")->fetch();
    $oldHash = $before['admin_password_hash'];
    check(strpos($oldHash, '$2') === 0);
    $url = store_icon(base64_decode($images['webp']), 'image/webp');
    $id = 'cllegacycategory00000000001'; $site = 'cllegacysite0000000000001';
    query('INSERT INTO categories (id,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?)', [$id,'旧分类',10,1700000000000,1700000000000]);
    query('INSERT INTO sites (id,category_id,name,url,icon_type,icon_url,description,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [$site,$id,'旧网站','https://example.com/','custom',$url,'旧说明',7,1700000000000,1700000000000]);
    $data = navigation_data();
    $category = array_values(array_filter($data['categories'], static fn($row) => $row['id'] === $id))[0];
    check($category['sites'][0]['id'] === $site);
    check($category['sites'][0]['sort_order'] === 7);
    check($category['sites'][0]['icon_url'] === $url);
    check(file_get_contents(icon_file(basename($url))) === base64_decode($images['webp']));
    check(query("SELECT * FROM settings WHERE id = 'singleton'")->fetch() === $before);
    check(!isset($data['settings']['admin_password_hash']));
    delete_site($site); delete_category($id);
});
run_test('URL normalization and unsafe protocol rejection', static function (): void {
    check(normalize_url(' example.com ') === 'https://example.com/');
    check(normalize_url('http://example.com') === 'http://example.com/');
    check(normalize_url('example.com:8080/test') === 'https://example.com:8080/test');
    check(normalize_url('https://Example.COM:443/a?b=1#c') === 'https://example.com/a?b=1#c');
    foreach (['','bad','javascript:alert(1)','data:text/html,x','file:///etc/passwd','ftp://example.com','https://user:pass@example.com','https://exa mple.com','https://example.com\\@localhost','http://[invalid]','https://example.com:99999'] as $url) rejects(static fn() => normalize_url($url));
});
run_test('Required fields, length, trim, extra fields and icon paths', static function (): void {
    check(category_input(['name' => ' 常用 '])['name'] === '常用');
    foreach (['',' ',str_repeat('a',31),str_repeat('中',31),str_repeat('😀',16)] as $name) rejects(static fn() => category_input(['name' => $name]));
    rejects(static fn() => category_input(['name' => 'ok', 'id' => 'evil']));
    $value = ['name'=>' Example ','url'=>'example.com','category_id'=>'x','description'=>' note '];
    check(site_input($value)['description'] === 'note');
    foreach ([['name'=>' '],['category_id'=>''],['description'=>str_repeat('x',51)],['icon_type'=>'custom','icon_url'=>'https://evil.example/x.png'],['icon_type'=>'auto','icon_url'=>null],['icon_url'=>'/api/icons/../../secret']] as $override) rejects(static fn() => site_input(array_merge($value,$override)));
    check(site_input(array_merge($value,['description'=>null]))['description'] === null);
});
run_test('PNG JPEG WebP valid signatures, MIME and unchanged stored bytes', static function () use ($images): void {
    foreach ($images as $type => $encoded) {
        $bytes = base64_decode($encoded);
        $url = store_icon($bytes,'image/'.$type);
        check((bool) preg_match('#^/api/icons/[a-f0-9]{64}\.(png|jpg|webp)$#', $url));
        check(file_get_contents(icon_file(basename($url))) === $bytes);
        check(store_icon($bytes,'image/'.$type) === $url);
    }
});
run_test('Reject TXT HTML MIME spoof empty oversize and corrupted images', static function () use ($images): void {
    foreach (['','plain text','<html><script>alert(1)</script></html>',"\x89PNG\r\n\x1a\nnot-an-image"] as $bytes) rejects(static fn() => store_icon($bytes,'image/png'));
    rejects(static fn() => store_icon(str_repeat('a',MAX_ICON_BYTES+1),'image/png'),'UPLOAD_TOO_LARGE');
    rejects(static fn() => store_icon(base64_decode($images['png']),'image/jpeg'));
    foreach ($images as $type=>$encoded) {
        $bytes=base64_decode($encoded);
        rejects(static fn() => store_icon(substr($bytes,0,-8),'image/'.$type));
        rejects(static fn() => store_icon($bytes.'extra','image/'.$type));
    }
    $png=base64_decode($images['png']); $png[44]=chr(ord($png[44])^1);
    rejects(static fn() => store_icon($png,'image/png'));
    rejects(static fn() => icon_file('../../config.local.php'));
});
run_test('PNG-in-ICO extraction and malformed ICO rejection', static function () use ($images): void {
    $png=base64_decode($images['png']);
    $ico=pack('vvv',0,1,1).pack('CCCCvvVV',64,64,0,0,1,32,strlen($png),22).$png;
    check(png_from_ico($ico)===$png);
    check(store_icon(png_from_ico($ico))===store_icon($png));
    rejects(static fn() => png_from_ico(substr($ico,0,30)));
});
run_test('SSRF IP ranges, local names, protocols and ports', static function (): void {
    foreach (['127.0.0.1','10.0.0.1','172.16.1.1','192.168.0.1','169.254.169.254','0.0.0.0','100.64.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','224.0.0.1','198.18.0.1','192.0.2.1','2001:db8::1','2002:7f00:1::'] as $ip) check(!public_ip($ip), 'Allowed private IP');
    check(public_ip('1.1.1.1')); check(public_ip('2606:4700:4700::1111'));
    foreach (['http://localhost','http://thing.local','http://127.0.0.1','http://2130706433','http://169.254.169.254','http://[::1]','http://example.com:8080','ftp://example.com'] as $url) rejects(static fn() => safe_target($url,microtime(true)+1));
});
run_test('SSRF mixed DNS, pinned IP, redirect to private and loops', static function (): void {
    $resolver=static fn()=>['1.1.1.1'];
    rejects(static fn()=>safe_target('http://example.com',microtime(true)+1,static fn()=>['1.1.1.1','10.1.1.1']));
    $target=safe_target('https://example.com',microtime(true)+1,$resolver);
    check($target['ip']==='1.1.1.1' && $target['host']==='example.com' && $target['port']===443);
    $count=0;
    $transport=static function () use (&$count): array { $count++;return ['status'=>302,'headers'=>['location'=>'http://127.0.0.1'],'body'=>'']; };
    rejects(static fn()=>fetch_public('https://example.com',microtime(true)+1,$resolver,$transport)); check($count===1);
    $count=0;
    $loop=static function () use (&$count): array { $count++;return ['status'=>302,'headers'=>['location'=>'/loop'],'body'=>'']; };
    rejects(static fn()=>fetch_public('https://example.com',microtime(true)+1,$resolver,$loop)); check($count===4);
});
run_test('SSRF timeouts, body limits, malformed DNS and safe fallback', static function (): void {
    rejects(static fn()=>fetch_public('http://example.com',microtime(true)-1,static fn()=>['1.1.1.1']));
    rejects(static fn()=>fetch_public('http://example.com',microtime(true)+1,static fn()=>['1.1.1.1'],static fn()=>['status'=>200,'headers'=>[],'body'=>str_repeat('a',MAX_ICON_BYTES+1)]));
    rejects(static fn()=>fetch_public('http://example.com',microtime(true)+0.01,static fn()=>['1.1.1.1'],static function ():array { usleep(20000);return ['status'=>200,'headers'=>[],'body'=>'ok']; }));
    $offset=0; rejects(static function () use (&$offset):void { dns_name("\xc0\0",$offset); });
    $started=microtime(true); check(fetch_favicon('http://127.0.0.1')===null); check(microtime(true)-$started<1);
    check(relative_url('https://example.com/a/b','../icon.png')==='https://example.com/icon.png');
});
run_test('CRUD duplicate names, foreign keys, sorting transactions and move-to-end', static function (): void {
    $a=save_category(null,['name'=>'A']); $b=save_category(null,['name'=>'B']); $c=save_category(null,['name'=>'A']);
    check($a['sort_order']<$b['sort_order'] && $b['sort_order']<$c['sort_order']);
    $edited=save_category($a['id'],['name'=>' A edited ']); check($edited['id']===$a['id'] && $edited['sort_order']===$a['sort_order']);
    $input=['name'=>'site','url'=>'example.com','category_id'=>$a['id']];
    $one=save_site(null,$input); $two=save_site(null,$input); $three=save_site(null,array_merge($input,['category_id'=>$b['id']]));
    check($two['sort_order']===$one['sort_order']+1);
    rejects(static fn()=>delete_category($a['id']),'CATEGORY_NOT_EMPTY');
    rejects(static fn()=>query('DELETE FROM categories WHERE id=?',[$a['id']]));
    rejects(static fn()=>save_site(null,array_merge($input,['category_id'=>'missing'])),'CATEGORY_NOT_FOUND');
    check(save_site($one['id'],array_merge($input,['name'=>'edited']))['sort_order']===$one['sort_order']);
    reorder_sites($a['id'],[$two['id'],$one['id']]);
    rejects(static fn()=>reorder_sites($a['id'],[$two['id'],$two['id']]));
    rejects(static fn()=>reorder_sites($a['id'],[$two['id'],$three['id']]));
    rejects(static fn()=>reorder_sites($a['id'],[$one['id']]));
    check(array_column(query('SELECT id FROM sites WHERE category_id=? ORDER BY sort_order',[$a['id']])->fetchAll(),'id')===[$two['id'],$one['id']]);
    check(save_site($one['id'],array_merge($input,['category_id'=>$b['id']]))['sort_order']===$three['sort_order']+1);
    $all=array_column(query('SELECT id FROM categories ORDER BY sort_order')->fetchAll(),'id');
    $reversed=array_reverse($all); reorder_categories($reversed);
    rejects(static fn()=>reorder_categories([$a['id'],$a['id']]));
    check(array_column(query('SELECT id FROM categories ORDER BY sort_order')->fetchAll(),'id')===$reversed);
    delete_site($two['id']);delete_category($a['id']);delete_site($one['id']);delete_site($three['id']);delete_category($b['id']);delete_category($c['id']);
    rejects(static fn()=>delete_site('missing'),'SITE_NOT_FOUND');
    check(query('PRAGMA integrity_check')->fetchColumn()==='ok');
    check(!query('PRAGMA foreign_key_check')->fetch());
});
run_test('Origin Referer validation and CSRF token checks', static function (): void {
    unset($_SERVER['HTTP_ORIGIN'],$_SERVER['HTTP_REFERER']); rejects('same_origin','INVALID_ORIGIN');
    $_SERVER['HTTP_ORIGIN']='http://evil.example'; rejects('same_origin','INVALID_ORIGIN');
    $_SERVER['HTTP_ORIGIN']='null'; rejects('same_origin','INVALID_ORIGIN');
    $_SERVER['HTTP_ORIGIN']='http://localhost:3100'; same_origin();
    unset($_SERVER['HTTP_ORIGIN']); $_SERVER['HTTP_REFERER']='http://localhost:3100/'; same_origin();
    $_COOKIE[ADMIN_COOKIE]=str_repeat('a',64); $_SERVER['HTTP_X_CSRF_TOKEN']='wrong';rejects('require_csrf','INVALID_CSRF');
    $_SERVER['HTTP_X_CSRF_TOKEN']=csrf_token(); require_csrf();
    unset($_COOKIE[ADMIN_COOKIE]); rejects('require_admin','UNAUTHORIZED');
    check(h('<script>"&')==='&lt;script&gt;&quot;&amp;');
});
run_test('Bcrypt session lifecycle expiry logout and persistent rate limit', static function () use ($copy): void {
    if ($copy) {
        // Real hash is checked privately before fixtures replace it in this copy.
        $hash=query("SELECT admin_password_hash FROM settings WHERE id='singleton'")->fetchColumn(); check(strpos($hash,'$2')===0);
        query("UPDATE settings SET admin_password_hash=? WHERE id='singleton'",[password_hash('Navigation-test-only-2026',PASSWORD_BCRYPT,['cost'=>12])]);
    }
    $_SERVER['HTTP_ORIGIN']='http://localhost:3100';
    rejects(static fn()=>login_admin('wrong'),'INVALID_PASSWORD');
    login_admin('Navigation-test-only-2026'); check(authenticated());
    $token=cookie_token(); check(strlen($token)===64);
    check(query('SELECT id FROM admin_sessions WHERE id=?',[$token])->fetch()===false);
    check(query('SELECT id FROM admin_sessions WHERE id=?',[hash('sha256',$token)])->fetchColumn()===hash('sha256',$token));
    query('UPDATE admin_sessions SET expires_at=? WHERE id=?',[now_ms()-1,hash('sha256',$token)]);check(!authenticated());
    login_admin('Navigation-test-only-2026'); $previous=cookie_token();
    login_admin('Navigation-test-only-2026');check(cookie_token()!==$previous);
    check(query('SELECT id FROM admin_sessions WHERE id=?',[hash('sha256',$previous)])->fetch()===false);
    logout_admin();check(!authenticated());
    for($i=0;$i<6;$i++) rejects(static fn()=>login_admin('wrong'),'INVALID_PASSWORD');
    rejects(static fn()=>login_admin('wrong'),'RATE_LIMITED');
});
$result=['passed'=>count($passed),'failed'=>count($failures),'assertions'=>$assertions,'tests'=>$passed,'failures'=>$failures,'php'=>PHP_VERSION,'sqlite'=>query('SELECT sqlite_version()')->fetchColumn(),'v1_backup_copy'=>(bool)$copy];
ob_end_clean();
echo json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),"\n";
exit($failures ? 1 : 0);

<?php

/**
 * Seed real image/video files for every `/storage/...` URL stored in the DB.
 *
 * The database (categories, products, banners, vendors, stores) already holds
 * absolute image URLs such as
 *
 *     http://localhost:8001/storage/category-images/abc123.webp
 *
 * but `backend/storage/app/public/` never received the matching files, so every
 * one of those URLs 404s. This script writes a real file to
 *
 *     backend/storage/app/public/<path-from-the-url>
 *
 * using the exact filename the database already references, so nothing in the
 * database has to change.
 *
 * Content is fetched from free, key-less sources (TheMealDB for dishes,
 * Wikipedia for wide/editorial photos, Picsum as the last resort) and then
 * resized + re-encoded into the format the stored extension demands
 * (.jpg / .png / .webp / .gif), so the bytes always match the filename.
 *
 * Usage:  php scripts/seed-storage-images.php [--force]
 *   --force   overwrite files that already exist
 *
 * Idempotent: existing non-empty files are skipped unless --force is given.
 */

declare(strict_types=1);

$force = in_array('--force', $argv, true);
$root = dirname(__DIR__);
$backend = $root . '/backend';
$publicStorage = $backend . '/storage/app/public';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** Row -> "storage directory" -> target canvas. */
$plans = [
    ['table' => 'categories', 'col' => 'image',      'keyword' => 'name',          'dir' => 'category-images', 'w' => 400,  'h' => 300, 'kind' => 'food'],
    ['table' => 'products',   'col' => 'image',      'keyword' => 'name',          'dir' => 'products',        'w' => 600,  'h' => 400, 'kind' => 'food'],
    ['table' => 'banners',    'col' => 'image',      'keyword' => 'title',         'dir' => 'banner-images',   'w' => 1000, 'h' => 440, 'kind' => 'banner'],
    ['table' => 'banners',    'col' => 'poster_image', 'keyword' => 'title',       'dir' => 'banner-images',   'w' => 1000, 'h' => 440, 'kind' => 'banner'],
    ['table' => 'banners',    'col' => 'video',      'keyword' => 'title',         'dir' => 'banner-videos',   'w' => 0,    'h' => 0,   'kind' => 'video'],
    ['table' => 'vendors',    'col' => 'logo',       'keyword' => 'business_name', 'dir' => 'vendor-images',   'w' => 400,  'h' => 400, 'kind' => 'logo'],
    ['table' => 'vendors',    'col' => 'cover_image','keyword' => 'business_name', 'dir' => 'vendor-images',   'w' => 900,  'h' => 500, 'kind' => 'cover'],
    ['table' => 'stores',     'col' => 'logo',       'keyword' => 'name',          'dir' => 'store-images',    'w' => 400,  'h' => 400, 'kind' => 'logo'],
    ['table' => 'stores',     'col' => 'cover_image','keyword' => 'name',          'dir' => 'store-images',    'w' => 900,  'h' => 500, 'kind' => 'cover'],
];

/** Wide, food-adjacent Wikipedia pages used when a row has no useful name. */
$bannerPool = [
    'Indian cuisine', 'Fast food', 'Buffet', 'Street food', 'Restaurant',
    'Cuisine of India', 'Dining room', 'Food photography',
];

/** TheMealDB ingredient searches — each returns ~15-30 real dish photos. */
$mealPool = ['chicken', 'rice', 'potato', 'cheese', 'tomato', 'egg', 'lamb', 'cream', 'bread', 'beans'];

/** Repo photographs used as a final local fallback before Picsum. */
$localPool = glob($root . '/customer-web/src/assets/*.{jpg,jpeg,png,webp}', GLOB_BRACE) ?: [];

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

function loadEnv(string $file): array
{
    $out = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $v = trim($v);
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[0] === substr($v, -1)) {
            $v = substr($v, 1, -1);
        }
        $out[trim($k)] = $v;
    }
    return $out;
}

$env = loadEnv($backend . '//.env');
$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $env['DB_HOST'] ?? '127.0.0.1',
    $env['DB_PORT'] ?? '3306',
    $env['DB_DATABASE'] ?? 'vooket'
);

try {
    $pdo = new PDO($dsn, $env['DB_USERNAME'] ?? 'root', $env['DB_PASSWORD'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to the database: {$e->getMessage()}\n");
    exit(1);
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function httpGet(string $url, int $timeout = 20): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'VooketSeed/1.0 (local development seeding)',
        CURLOPT_HTTPHEADER => ['Accept: */*'],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        return null;
    }
    return ['body' => $body, 'type' => $type];
}

/** TheMealDB photo for a dish name, else null. */
function mealDbThumb(string $keyword): ?string
{
    $kw = trim($keyword);
    if ($kw !== '') {
        $res = httpGet('https://www.themealdb.com/api/json/v1/1/search.php?s=' . rawurlencode($kw));
        if ($res) {
            $data = json_decode($res['body'], true);
            if (!empty($data['meals'][0]['strMealThumb'])) {
                return $data['meals'][0]['strMealThumb'];
            }
        }
        // Fall back to a single word ("Chicken Biryani" -> "biryani").
        $words = preg_split('/\s+/', strtolower($kw));
        foreach (array_reverse($words) as $word) {
            if (strlen($word) < 4) {
                continue;
            }
            $res = httpGet('https://www.themealdb.com/api/json/v1/1/search.php?s=' . rawurlencode($word));
            if ($res) {
                $data = json_decode($res['body'], true);
                if (!empty($data['meals'][0]['strMealThumb'])) {
                    return $data['meals'][0]['strMealThumb'];
                }
            }
        }
    }
    return null;
}

/** A random-but-stable dish photo, used so fallbacks are not all identical. */
function mealDbPoolThumb(string $seed, array $pool): ?string
{
    $ingredient = $pool[crc32($seed) % count($pool)];
    $res = httpGet('https://www.themealdb.com/api/json/v1/1/filter.php?i=' . $ingredient);
    if (!$res) {
        return null;
    }
    $data = json_decode($res['body'], true);
    $meals = $data['meals'] ?? [];
    if (!$meals) {
        return null;
    }
    $pick = $meals[crc32($seed . $ingredient) % count($meals)];
    return $pick['strMealThumb'] ?? null;
}

/** Wikipedia summary photo for a page title, else null. */
function wikiThumb(string $title): ?string
{
    $title = trim($title);
    if ($title === '') {
        return null;
    }
    $res = httpGet('https://en.wikipedia.org/api/rest_v1/page/summary/' . rawurlencode(str_replace(' ', '_', $title)));
    if (!$res) {
        return null;
    }
    $data = json_decode($res['body'], true);
    foreach (['originalimage', 'thumbnail'] as $key) {
        if (!empty($data[$key]['source'])) {
            // Strip the API's tracking query string and ask for a large thumb.
            $src = strtok($data[$key]['source'], '?');
            return preg_replace('#/\d+px-#', '/1400px-', $src) ?? $src;
        }
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* Image decoding / encoding (GD)                                      */
/* ------------------------------------------------------------------ */

function decode(string $bytes): ?GdImage
{
    $info = @getimagesizefromstring($bytes);
    if ($info === false) {
        return null;
    }
    $img = @imagecreatefromstring($bytes);
    return $img instanceof GdImage ? $img : null;
}

/** Cover-crop the source to exactly $w x $h. */
function fit(GdImage $src, int $w, int $h): GdImage
{
    $sw = imagesx($src);
    $sh = imagesy($src);
    $scale = max($w / $sw, $h / $sh);
    $cw = (int) round($w / $scale);
    $ch = (int) round($h / $scale);
    $sx = (int) (($sw - $cw) / 2);
    $sy = (int) (($sh - $ch) / 2);

    $dst = imagecreatetruecolor($w, $h);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $w, $h, $transparent);
    imagealphablending($dst, true);
    imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $w, $h, $cw, $ch);
    return $dst;
}

function encode(GdImage $img, string $ext): ?string
{
    ob_start();
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            imagejpeg($img, null, 88);
            break;
        case 'png':
            imagepng($img, null, 6);
            break;
        case 'webp':
            imagewebp($img, null, 88);
            break;
        case 'gif':
            imagegif($img);
            break;
        default:
            ob_end_clean();
            return null;
    }
    return (string) ob_get_clean();
}

/** Flat branded placeholder — used when no source image could be fetched. */
function placeholder(int $w, int $h, string $label, string $ext): ?string
{
    $img = imagecreatetruecolor($w, $h);
    $bg = imagecolorallocate($img, 233, 231, 227);
    imagefilledrectangle($img, 0, 0, $w, $h, $bg);
    $accent = imagecolorallocate($img, 226, 50, 66);
    imagefilledrectangle($img, 0, (int) ($h * 0.62), $w, (int) ($h * 0.62) + (int) ($h * 0.04), $accent);
    $ink = imagecolorallocate($img, 60, 57, 52);
    $label = strtoupper(mb_substr($label, 0, 24));
    $font = 5;
    $tw = imagefontwidth($font) * strlen($label);
    imagestring($img, $font, (int) (($w - $tw) / 2), (int) ($h * 0.45), $label, $ink);
    return encode($img, $ext);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

$rows = [];
foreach ($plans as $plan) {
    $sql = sprintf(
        'SELECT id, `%s` AS src, `%s` AS keyword FROM `%s` WHERE `%s` IS NOT NULL AND `%s` != \'\'',
        $plan['col'],
        $plan['keyword'],
        $plan['table'],
        $plan['col'],
        $plan['col']
    );
    foreach ($pdo->query($sql) as $row) {
        if (!preg_match('#/storage/(.+)$#', (string) $row['src'], $m)) {
            continue;
        }
        $rows[] = [
            'rel' => $m[1],
            'keyword' => trim((string) $row['keyword']),
            'dir' => $plan['dir'],
            'kind' => $plan['kind'],
            'w' => $plan['w'],
            'h' => $plan['h'],
            'ref' => $plan['table'] . '#' . $row['id'] . ':' . $plan['col'],
        ];
    }
}

$created = $skipped = $failed = 0;
$localIndex = 0;

foreach ($rows as $row) {
    $target = $publicStorage . '/' . $row['rel'];
    if (!$force && is_file($target) && filesize($target) > 0) {
        $skipped++;
        continue;
    }
    @mkdir(dirname($target), 0755, true);

    $ext = strtolower(pathinfo($row['rel'], PATHINFO_EXTENSION));
    $dir = dirname($row['rel']);

    /* ---- video: a small CC0 sample clip ---------------------------- */
    if ($row['kind'] === 'video') {
        $sources = [
            'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
        ];
        $saved = false;
        foreach ($sources as $src) {
            $res = httpGet($src, 45);
            if ($res && str_contains($res['type'], 'video')) {
                file_put_contents($target, $res['body']);
                $saved = true;
                break;
            }
        }
        if ($saved) {
            $created++;
            echo "[video] {$row['ref']} -> {$row['rel']}\n";
        } else {
            $failed++;
            echo "[FAIL ] {$row['ref']} could not fetch a video\n";
        }
        continue;
    }

    /* ---- images: pick a source by kind ----------------------------- */
    $kw = $row['keyword'];
    $candidates = [];
    if ($row['kind'] === 'food') {
        $candidates[] = fn () => mealDbThumb($kw);
        $candidates[] = fn () => wikiThumb($kw);
        $candidates[] = fn () => mealDbPoolThumb($row['rel'], $mealPool);
    } elseif ($row['kind'] === 'banner') {
        $candidates[] = fn () => wikiThumb($bannerPool[crc32($row['rel']) % count($bannerPool)]);
        $candidates[] = fn () => mealDbThumb($kw);
        $candidates[] = fn () => wikiThumb('Indian cuisine');
    } else { // logo / cover
        $candidates[] = fn () => wikiThumb($kw);
        $candidates[] = fn () => wikiThumb($row['kind'] === 'cover' ? 'Restaurant' : 'Fast food');
        $candidates[] = fn () => mealDbPoolThumb($row['rel'], $mealPool);
    }

    $bytes = null;
    foreach ($candidates as $candidate) {
        $url = $candidate();
        if (!$url) {
            continue;
        }
        $res = httpGet($url, 30);
        if ($res && ($img = decode($res['body'])) !== null) {
            $out = encode(fit($img, $row['w'], $row['h']), $ext);
            if ($out !== null) {
                $bytes = $out;
                imagedestroy($img);
                break;
            }
            imagedestroy($img);
        }
    }

    /* ---- last resort: a repo photo, then a generated placeholder --- */
    if ($bytes === null && $localPool) {
        $src = $localPool[$localIndex++ % count($localPool)];
        $raw = file_get_contents($src);
        $img = $raw !== false ? decode($raw) : null;
        if ($img instanceof GdImage) {
            $bytes = encode(fit($img, $row['w'], $row['h']), $ext);
            imagedestroy($img);
        }
    }
    if ($bytes === null) {
        $bytes = placeholder($row['w'], $row['h'], $kw !== '' ? $kw : basename($row['rel'], '.' . $ext), $ext);
    }

    if ($bytes === null) {
        $failed++;
        echo "[FAIL ] {$row['ref']} ({$dir}) unsupported extension .{$ext}\n";
        continue;
    }

    file_put_contents($target, $bytes);
    $created++;
    echo "[ok   ] {$row['ref']} -> {$row['rel']} (" . number_format(strlen($bytes)) . " B)\n";
}

printf(
    "\nDone. %d created, %d already present, %d failed (of %d database paths).\n",
    $created,
    $skipped,
    $failed,
    count($rows)
);
exit($failed > 0 ? 1 : 0);

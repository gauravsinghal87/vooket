<?php

declare(strict_types=1);

/**
 * Composes a 4:3 category collage from already downloaded, already framed source
 * images. Used by fetch_catalog_images.py for parent categories so a category tile
 * always shows exactly the subjects that category groups.
 *
 * Usage: php collage.php <dest.jpg> <cellW> <cellH> <src1> <src2> [...]
 */

$dest = $argv[1] ?? null;
$cellW = (int) ($argv[2] ?? 900);
$cellH = (int) ($argv[3] ?? 675);
$sources = array_slice($argv, 4);

if (! $dest || ! $sources) {
    fwrite(STDERR, "usage: collage.php <dest> <cellW> <cellH> <src...>\n");
    exit(1);
}

$white = static fn () => imagecolorallocate(GLOBALS['canvas'], 255, 255, 255);

$cols = count($sources) === 1 ? 1 : (count($sources) === 2 ? 2 : 3);
$rows = (int) ceil(count($sources) / $cols);
$pad = 6;

$canvasW = ($cellW * $cols) + ($pad * ($cols - 1));
$canvasH = ($cellH * $rows) + ($pad * ($rows - 1));

$canvas = imagecreatetruecolor($canvasW, $canvasH);
imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));

foreach ($sources as $i => $src) {
    if (! is_file($src)) {
        continue;
    }
    $image = match (exif_imagetype($src)) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($src),
        IMAGETYPE_PNG => @imagecreatefrompng($src),
        default => null,
    };
    if ($image === false || $image === null) {
        continue;
    }

    $srcW = imagesx($image);
    $srcH = imagesy($image);
    $scale = max($cellW / $srcW, $cellH / $srcH);
    $newW = (int) ceil($srcW * $scale);
    $newH = (int) ceil($srcH * $scale);
    $cell = imagecreatetruecolor($cellW, $cellH);
    imagefill($cell, 0, 0, imagecolorallocate($cell, 255, 255, 255));
    imagecopyresampled($cell, $image, intdiv($cellW - $newW, 2), intdiv($cellH - $newH, 2),
        0, 0, $newW, $newH, $srcW, $srcH);

    imagecopy($canvas, $cell, ($i % $cols) * ($cellW + $pad), intdiv($i, $cols) * ($cellH + $pad),
        0, 0, $cellW, $cellH);
}

// Land every tile on the same frame so the category grid stays visually even.
$finalW = (int) round($cellW * 4 / 3);
$finalH = (int) round($cellH * 4 / 3);
$final = imagecreatetruecolor($finalW, $finalH);
imagefill($final, 0, 0, imagecolorallocate($final, 255, 255, 255));
imagecopyresampled($final, $canvas, 0, 0, $finalW, $finalH, 0, 0, $canvasW, $canvasH);
imagejpeg($final, $dest, 82);

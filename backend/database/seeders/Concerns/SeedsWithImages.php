<?php

namespace Database\Seeders\Concerns;

trait SeedsWithImages
{
    private function placeholderImage(string $seed, int $width = 600, int $height = 400): string
    {
        return 'https://picsum.photos/seed/'.rawurlencode($seed).'/'.$width.'/'.$height;
    }
}

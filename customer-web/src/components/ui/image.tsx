import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { imageUrl, IMAGES } from '@/config/images';

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  eager?: boolean;
}

export function Image({ src, eager = false, className, alt, ...rest }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const href = errored ? IMAGES.placeholder : imageUrl(src);

  return (
    <img
      src={href}
      alt={alt ?? ''}
      loading={eager ? 'eager' : 'lazy'}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      aria-hidden={alt ? undefined : true}
      className={cn('transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
      {...rest}
    />
  );
}
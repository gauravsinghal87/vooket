import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/utils';
import { imageUrl, IMAGES } from '@/shared/config/images';

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
      decoding={eager ? 'auto' : 'async'}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      aria-hidden={alt ? undefined : true}
      className={cn('transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
      {...rest}
    />
  );
}
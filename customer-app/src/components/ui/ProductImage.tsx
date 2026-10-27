import { useState } from 'react';
import { Image, View, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { imageUrl } from '@/lib/images';
import { colors } from '@/theme';

interface ProductImageProps {
  src?: string | null;
  style?: StyleProp<ImageStyle>;
  size?: number;
  rounded?: boolean;
  fallbackBg?: string;
  /** Defaults to 'cover'; category tiles use 'contain' to avoid cropping. */
  resizeMode?: ImageResizeMode;
}

/**
 * Image with a grey placeholder box fallback (replaces the web app's SVG
 * data-URI placeholder, which React Native cannot render).
 *
 * The placeholder is also used when the image fails to load, so a broken
 * URL degrades to an empty plate instead of the platform's broken-image
 * glyph — the box keeps the exact geometry of the image it replaces.
 */
export function ProductImage({
  src,
  style,
  size,
  rounded = true,
  fallbackBg = colors.ink[100],
  resizeMode = 'cover',
}: ProductImageProps) {
  const uri = imageUrl(src);
  // The URL that failed to load. Keeping the URL (instead of a boolean)
  // means a new source is never hidden by an older failure.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const broken = uri !== null && failedUri === uri;
  const resolved: StyleProp<ImageStyle> = [style, size ? { width: size, height: size } : null];
  // `rounded` only adds the default radius — it never clears a radius the
  // caller set on the style (the notched card rounds only the top corners).
  const radius = rounded ? { borderRadius: 12 } : null;

  if (!uri || broken) {
    return <View style={[resolved, radius, { backgroundColor: fallbackBg }]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[resolved, radius]}
      resizeMode={resizeMode}
      onError={() => {
        if (__DEV__) console.warn(`[Image] failed to load: ${uri}`);
        setFailedUri(uri);
      }}
    />
  );
}

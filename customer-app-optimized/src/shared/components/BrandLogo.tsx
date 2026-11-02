import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/shared/theme';
import { useBranding } from '@/shared/hooks/useBranding';
import { brandInitials } from '@/shared/utils/branding';
import { imageUrl } from '@/shared/utils/images';

const DIMS = { sm: 24, md: 32, lg: 40 } as const;
const FONT = { sm: 10, md: 13, lg: 16 } as const;
const RADIUS = { sm: 8, md: 10, lg: 12 } as const;

export function BrandLogo({
  size = 'md',
  tone = 'dark',
  showText = false,
}: {
  size?: keyof typeof DIMS;
  tone?: 'dark' | 'light';
  showText?: boolean;
}) {
  const { name, logo } = useBranding();
  const [imageFailed, setImageFailed] = useState(false);

  const dim = DIMS[size];
  const radius = RADIUS[size];
  const logoUri = logo ? imageUrl(logo) : '';
  const showLogo = Boolean(logoUri) && !imageFailed;

  // Preserve the Super[accent]Basket wordmark styling for an arbitrary platform
  // name: leading words in the base tone, the final word in the brand accent.
  const words = name.trim().split(/\s+/).filter(Boolean);
  const leading = words.length > 1 ? words.slice(0, -1).join(' ') : '';
  const finalWord = words[words.length - 1] ?? '';

  return (
    <View style={styles.row}>
      {showLogo ? (
        <Image
          source={{ uri: logoUri }}
          style={{ width: dim, height: dim, borderRadius: radius }}
          resizeMode="contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={[colors.accent[400], colors.accent[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.mark, { width: dim, height: dim, borderRadius: radius }]}
        >
          <Text style={[styles.markText, { fontSize: FONT[size] }]}>{brandInitials(name)}</Text>
        </LinearGradient>
      )}
      {showText ? (
        <Text style={[styles.wordmark, { color: tone === 'light' ? colors.white : colors.ink[900] }]}>
          {leading ? `${leading} ` : null}
          <Text style={styles.accent}>{finalWord}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  markText: {
    color: '#fff',
    fontWeight: '900',
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  accent: {
    color: colors.accent[500],
  },
});
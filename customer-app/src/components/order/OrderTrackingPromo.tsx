import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ProductImage } from '@/components/ui/ProductImage';
import { bannerRoute } from '@/lib/banner';
import { colors } from '@/theme';
import type { Banner } from '@/types/catalog';

interface OrderTrackingPromoProps {
  banners: Banner[];
  /** First-load state, so the banner area can hold its shape before data lands. */
  loading?: boolean;
}

/**
 * One-banner-per-slide promotional carousel for the order-tracking page
 * (native port of customer-web's `OrderTrackingPromo`).
 *
 * Renders only the Admin-managed `order_tracking` placement for the order's
 * service, so a banner aimed at a home hero can never appear here. It is
 * intentionally edge-to-edge (the order page renders it outside the padded
 * content, with no rounding), so the artwork reads as a full-width hero band
 * rather than a card. Each slide is exactly the full viewport width — there is
 * no partial "next banner" preview — and the centered pagination dots overlay
 * the bottom of the image, just above the compact tracking card that overlaps
 * this section. Swipe works natively; tapping a slide follows the banner's own
 * admin-configured target. Targeting and loading/empty behaviour are preserved.
 */
export function OrderTrackingPromo({ banners, loading = false }: OrderTrackingPromoProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const height = Math.round(width / 2);
  const [index, setIndex] = useState(0);

  const count = banners.length;
  const showChrome = count > 1;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(next, count - 1)));
  };

  if (count === 0) {
    if (!loading) return null;
    return <View style={[styles.skeleton, { width, height }]} />;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
      >
        {banners.map((b) => (
          <Pressable
            key={b.id}
            accessibilityLabel={b.title}
            onPress={() => router.push(bannerRoute(b) as never)}
            style={({ pressed }) => [styles.slide, { width, height }, pressed && styles.slidePressed]}
          >
            <ProductImage src={b.image} style={StyleSheet.absoluteFill} rounded={false} />
            {/* Top-weighted scrim keeps the copy legible while leaving the
                lower edge open for the overlapping tracking card. */}
            <LinearGradient
              colors={['rgba(16,14,10,0.85)', 'rgba(16,14,10,0.25)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            {/* Light bottom scrim keeps the pagination dots readable over bright
                imagery while leaving the lower edge open for the overlapping card. */}
            <LinearGradient colors={['transparent', 'rgba(16,14,10,0.55)']} style={styles.bottomScrim} />
            <View style={styles.copy}>
              {b.cta_text ? (
                <View style={styles.cta}>
                  <Text style={styles.ctaText}>{b.cta_text}</Text>
                </View>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {b.title}
              </Text>
              {b.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {b.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {showChrome ? (
        <View style={styles.dots} pointerEvents="none">
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  skeleton: {
    backgroundColor: colors.neutral[200],
  },
  slide: {
    overflow: 'hidden',
    backgroundColor: colors.ink[950],
  },
  slidePressed: {
    opacity: 0.94,
  },
  copy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  cta: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  ctaText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.ink[900],
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    color: '#fff',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#fff',
  },
});

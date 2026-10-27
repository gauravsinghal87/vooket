import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Banner } from '@/types/catalog';
import { ProductImage } from '@/components/ui/ProductImage';
import { bannerRoute } from '@/lib/banner';
import { colors } from '@/theme';

/**
 * Rapido-style "Everything in Minutes" promo mosaic for the Rides home
 * (native port of customer-web's `RidesPromoMosaic`).
 *
 * Cards are Admin-managed banners from the dedicated `rides_promotions`
 * placement (the page fetches only that placement), laid into a two-column
 * asymmetric mosaic in `sort_order`. Left column takes the first half of the
 * banners, right column the rest, so four banners read as the reference layout:
 * Parcel + everyday rides on the left, Bike Taxi + All Services on the right.
 *
 * Copy (title/subtitle) and artwork come from the banner. Tapping any card
 * opens the Drop Location screen via `onCardPress` (the same navigation the
 * "Where do you want to go?" input uses); when no handler is given the tap
 * target falls back to the shared `bannerRoute` mapper — nothing is inferred
 * from the label text. Soft pastel tints are assigned per slot purely for styling.
 */
const SLOT_TINTS = [colors.brand[50], '#fffbeb', colors.emerald[50], '#f5f3ff'];

export function RidesPromoMosaic({
  banners,
  onCardPress,
}: {
  banners: Banner[];
  onCardPress?: () => void;
}) {
  const router = useRouter();

  const cards = banners.slice(0, 4);
  if (cards.length === 0) return null;

  const half = Math.ceil(cards.length / 2);
  const columns = [cards.slice(0, half), cards.slice(half)].filter((column) => column.length > 0);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Everything in Minutes</Text>
      <View style={styles.mosaic}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={[styles.column, columnIndex === 0 ? styles.columnWide : styles.columnNarrow]}>
            {column.map((b, cardIndex) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={b.title}
                onPress={() => (onCardPress ? onCardPress() : router.push(bannerRoute(b) as never))}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: SLOT_TINTS[(columnIndex * half + cardIndex) % SLOT_TINTS.length] },
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.title} numberOfLines={2}>
                  {b.title}
                </Text>
                {b.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {b.subtitle}
                  </Text>
                ) : null}
                {b.image ? (
                  <ProductImage src={b.image} resizeMode="contain" style={styles.art} rounded={false} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    paddingTop: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.ink[900],
  },
  mosaic: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    gap: 12,
  },
  columnWide: {
    flex: 1.08,
  },
  columnNarrow: {
    flex: 0.92,
  },
  card: {
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
    color: colors.ink[900],
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: colors.neutral[500],
  },
  art: {
    marginTop: 8,
    width: '100%',
    height: 64,
  },
});

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceModuleSwitcher } from '@/components/ServiceModuleSwitcher';

/**
 * The bar pinned to the bottom of every screen: the Food / Grocery / Rides
 * module switcher.
 *
 * This slot used to hold the five-item page nav (Home / Orders / Rides /
 * Wallet / You). The app is organised by module, so what belongs at the bottom
 * is the control that moves between modules — the page links now live on the
 * Profile screen.
 *
 * It is a full-width light frosted band instead of the solid black plate it
 * was, so no dark colour shows around the switcher. Content never scrolls
 * beneath it (Screen lays it out in normal flow), so a backdrop blur would have
 * nothing to blur — the glass read comes from layered translucency, the
 * switcher's gradient sheen and its hairline highlight, without needing a
 * native blur module. The white is near-opaque so the surface always resolves
 * to one flat colour and nothing behind it can show through as a band.
 * `Screen` gives the scroll body its space; the dock itself owns the safe-area
 * inset so it runs flush to the physical bottom edge.
 */
export function BottomNav() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <ServiceModuleSwitcher />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(23, 20, 15, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingTop: 4,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronDown,
  MapPin,
  Wallet,
} from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/SearchBar';
import { GroceryEtaRow } from '@/components/grocery';
import { LocationSelector } from '@/components/LocationSelector';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { useBranding } from '@/hooks/useBranding';
import { GROCERY_ORDER_HEADER_BG, HERO_THEMES, ORDER_HEADER_BG, activeService, routeTheme, serviceTheme } from '@/theme';
import { colors } from '@/theme';

const TOP_ROUTES = ['/food', '/grocery', '/rides'];

interface AppHeaderProps {
  /** 'themed' paints the hero band + switcher + search; 'dark' is the plain sub-route header; 'auto' picks by route. 'overlay' drops the band so the same controls can sit on top of the Food hero media. */
  variant?: 'themed' | 'dark' | 'auto' | 'overlay';
  /** Title for the dark variant (sub-routes). Falls back to the configured platform name. */
  title?: string;
  /**
   * Recolors the dark header band to match the order hero below it. `food` and
   * `grocery` paint that service's order-tracking gradient (ending exactly where
   * the order hero below begins, so the two read as one section); omit / `brand`
   * keeps the dark band.
   */
  tone?: 'brand' | 'food' | 'grocery';
  /** Shown instead of the default themed content on top routes (e.g. grocery category header). */
  customHeader?: React.ReactNode;
}

/**
 * The one shared header (native port of customer-web Header.tsx).
 *
 * The three service routes share one themed band — location row, the connected
 * module switcher and search — painted from the route's hero theme. Every other
 * route keeps the plain dark header (back + title/actions).
 */
export function AppHeader({ variant = 'auto', customHeader, title, tone }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { name } = useBranding();
  const resolvedTitle = title ?? name;

  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const locationState = useAppStore((s) => s.location);
  const service = useAppStore((s) => s.service);
  // Owned by the app store so any screen (including the Food unavailable-location
  // empty state) can open this shared sheet instead of its own copy.
  const locOpen = useAppStore((s) => s.locationSelectorOpen);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const setLocOpen = (open: boolean) => (open ? openLocationSelector() : closeLocationSelector());

  const activeLoc = locationState ?? DEFAULT_LOCATION;
  const themeId = routeTheme(pathname);
  const hero = HERO_THEMES[themeId];
  const theme = serviceTheme(service);

  const isTop = TOP_ROUTES.includes(pathname);
  const overlay = variant === 'overlay';
  const useDark = variant === 'dark' || (variant === 'auto' && !isTop);
  const isGrocery = pathname === '/grocery';
  // The Rides home owns a full-height map + booking sheet and its destination
  // search lives inside that flow (`/rides/destination`), so its band drops the
  // shared search row — location, wallet and avatar stay exactly as they are.
  // Every other top route keeps the search field.
  const isRidesHome = pathname === '/rides';
  const showBandSearch = isTop && !overlay && !isRidesHome;

  if (useDark) {
    // The Grocery order gradient is light gold, so its back/title must flip to
    // near-black to stay legible (the Food gradient stays dark with white).
    const orderTone = tone === 'food' || tone === 'grocery';
    const orderFg = tone === 'grocery' ? colors.ink[900] : '#fff';
    const darkRow = (
      <View style={styles.darkRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Go back">
          <ArrowLeft size={22} color={orderTone ? orderFg : '#fff'} />
        </Pressable>
        <View style={styles.darkMiddle}>
          <Text style={[styles.darkTitle, orderTone && { color: orderFg }]} numberOfLines={1}>
            {resolvedTitle}
          </Text>
        </View>
        <View style={styles.iconBtn} />
      </View>
    );

    // Order tracking: paint the band with the order's service gradient (which
    // ends exactly where the order hero starts) and drop the shadow so the
    // header and hero read as one continuous Food red / Grocery gold section.
    if (orderTone) {
      return (
        <LinearGradient
          colors={tone === 'grocery' ? GROCERY_ORDER_HEADER_BG : ORDER_HEADER_BG}
          style={{ paddingTop: insets.top }}
        >
          {darkRow}
        </LinearGradient>
      );
    }

    return <View style={[styles.dark, { paddingTop: insets.top }]}>{darkRow}</View>;
  }

  const content = (
    <>
      <View style={styles.bandRow}>
        {/* No brand mark in the band: the location leads the row, exactly as
              the reference does, so the action icon keeps its room. */}
        <Pressable
          style={({ pressed }) => [styles.locBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setLocOpen(true)}
          accessibilityRole="button"
        >
          {isGrocery ? (
            <View style={styles.groceryPin}>
              <MapPin size={16} color={colors.grocery[700]} strokeWidth={0} fill={colors.grocery[700]} />
            </View>
          ) : (
            <MapPin size={20} color={isTop ? colors.white : theme.strong} strokeWidth={0} fill={isTop ? colors.white : theme.strong} />
          )}
          <View style={styles.locText}>
            {isGrocery ? (
              <>
                {/* Real nearest-store ETA, mounted only on the Grocery route. */}
                <GroceryEtaRow />
                <View style={styles.groceryAddrRow}>
                  <Text style={styles.groceryAddrLabel} numberOfLines={1}>
                    {activeLoc.label}
                  </Text>
                  <Text style={styles.groceryAddrText} numberOfLines={1}>
                    · {activeLoc.address}
                  </Text>
                  <ChevronDown size={13} color="rgba(255,255,255,0.5)" />
                </View>
              </>
            ) : (
              <>
                <View style={styles.locLabelRow}>
                  <Text style={styles.locLabel} numberOfLines={1}>
                    {activeLoc.label}
                  </Text>
                  <ChevronDown size={14} color="rgba(255,255,255,0.5)" />
                </View>
                <Text style={[styles.locAddr, { color: isTop ? hero.muted : 'rgba(255,255,255,0.55)' }]} numberOfLines={1}>
                  {activeLoc.address}
                </Text>
              </>
            )}
          </View>
        </Pressable>

        <View style={styles.actions}>
          {/* Wallet replaces the old cart + notification pair: the balance is
                one tap away, and the reference band carries no cart or bell. */}
          <Pressable
            onPress={() => router.push('/wallet' as never)}
            style={styles.iconBtn}
            accessibilityLabel="Wallet"
          >
            <Wallet size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => router.push((user ? '/profile' : '/auth/login') as never)}
            style={styles.avatarWrap}
            accessibilityLabel="Account"
          >
            <Avatar name={user?.name ?? 'Guest'} size="md" />
          </Pressable>
        </View>
      </View>

      {customHeader ? (
        <View style={styles.customWrap}>{customHeader}</View>
      ) : showBandSearch ? (
        /* The module switcher now lives at the bottom of the screen (see
           `BottomNav`), so the top of a service route reads location →
           search, and there is deliberately only one switcher per screen.
           On the Food hero overlay the search moves into the page's own
           sticky search + Veg Mode row (below the hero), so the header
           renders neither. */
        <View style={styles.searchWrap}>
          <SearchBar variant="brand" />
        </View>
      ) : null}
    </>
  );

  return (
    <>
      {overlay ? (
        // Sits on the Food hero media: no gradient band and no shadow, so the
        // video shows through and the header reads as part of the hero.
        <View style={[styles.overlay, { paddingTop: insets.top + 6 }]}>{content}</View>
      ) : (
        <LinearGradient
          colors={hero.headerBg}
          style={[
            styles.band,
            { paddingTop: insets.top + 6 },
            // Same 14px the search row's wrapper carried, so the band keeps its
            // bottom breathing room after that row is gone.
            isRidesHome && { paddingBottom: 14 },
          ]}
        >
          {content}
        </LinearGradient>
      )}

      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  overlay: {
    paddingHorizontal: 16,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  groceryPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  locText: {
    flex: 1,
    minWidth: 0,
  },
  locLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  locAddr: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
  },
  groceryAddrRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groceryAddrLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  groceryAddrText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchWrap: {
    paddingBottom: 14,
    zIndex: 3,
  },
  customWrap: {
    paddingTop: 8,
    paddingBottom: 14,
  },
  dark: {
    backgroundColor: colors.ink[900],
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 48,
  },
  darkMiddle: {
    alignItems: 'center',
  },
  darkTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
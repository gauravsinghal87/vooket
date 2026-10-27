import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Car, ShoppingBasket, UtensilsCrossed } from 'lucide-react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useAppStore } from '@/stores/appStore';
import { SERVICE_ROUTES, activeService } from '@/theme';
import type { ServiceType } from '@/types/models';

const ICONS: Record<ServiceType, typeof Car> = {
  food: UtensilsCrossed,
  grocery: ShoppingBasket,
  rides: Car,
};

interface Props {
  activeServiceOverride?: ServiceType | null;
}

export function ServiceModuleSwitcher({ activeServiceOverride }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // The shared cart / checkout / search / product screens carry their module in
  // the query string (?type=grocery, ?service=food); serialize the current
  // route's params so `activeService` can resolve them and keep the owning
  // module lit on every one of its screens.
  const params = useGlobalSearchParams();
  const entries = Object.entries(params).flatMap(([key, value]) =>
    Array.isArray(value)
      ? value.map((item) => [key, item] as [string, string])
      : value
        ? [[key, value] as [string, string]]
        : []
  );
  const search = entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
  const setService = useAppStore((s) => s.setService);

  const active =
    activeServiceOverride !== undefined ? activeServiceOverride : activeService(pathname, search);

  const go = (value: ServiceType) => {
    setService(value);
    if (pathname === SERVICE_ROUTES[value]) return;
    router.push(SERVICE_ROUTES[value] as never);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.glass}>
        {/* Frosted sheen: a static top-lit highlight clipped to the track's own
            radius, so the surface reads as lit glass rather than a flat plate.
            It sits under the tabs and never intercepts touches. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.78)', 'rgba(255, 255, 255, 0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
        />
        {(Object.keys(SERVICE_ROUTES) as ServiceType[]).map((value) => {
          const Icon = ICONS[value];
          const isActive = active === value;

          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Open ${value[0].toUpperCase() + value.slice(1)}`}
              onPress={() => go(value)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <View style={styles.tabContent}>
                <Icon size={20} strokeWidth={2.1} color={isActive ? '#17140F' : '#6B675F'} />
                <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive]}>
                  {value[0].toUpperCase() + value.slice(1)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Full width: only a hairline inset keeps the track's rounded corners off
    // the physical screen edges — there is no centred max-width pill any more.
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    borderRadius: 26,
    /* Smoked-glass base — deliberately OPAQUE. It is the exact colour a 6% ink
       tint resolves to over the white dock, so it looks identical to the
       translucent version, but the paint is guaranteed to cover the whole
       track: a semi-transparent fill over a rounded, bordered, clipped box can
       drop out and let the bright dock show through as a stray white band
       behind the inactive tabs. */
    backgroundColor: '#F1F0EE',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 4,
    gap: 4,
    shadowColor: '#16120E',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    // No `overflow: hidden`: clipping a translucent box is what let the
    // artifact through, and every child now paints inside the radius itself.
  },
  // Matches `glass`'s radius exactly, so the sheen needs no clipping parent.
  sheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 8,
    // No border at all: a transparent 1pt border on a rounded Android Pressable
    // is another way that band can surface, and every tab already has the same
    // footprint from `flex: 1`.
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#16120E',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
    maxWidth: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: '#6B675F',
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '700',
    color: '#17140F',
  },
  underline: {
    position: 'absolute',
    bottom: 4,
    left: '26%',
    right: '26%',
    height: 2,
    borderRadius: 999,
    backgroundColor: '#F47B35',
    shadowColor: '#F47B35',
    shadowOpacity: 0.55,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});

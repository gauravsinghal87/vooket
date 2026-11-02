import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Car, ShoppingBasket, UtensilsCrossed } from 'lucide-react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useAppStore } from '@/shared/stores/appStore';
import { SERVICE_ROUTES, activeService, colors } from '@/shared/theme';
import type { ServiceType } from '@/shared/types/models';

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
  const storedService = useAppStore((s) => s.service);
  // `/orders` belongs to no single service: it is scoped by the switcher's own
  // selection, so the chosen tab stays lit there and picking a module reloads
  // the history list in place instead of navigating to that module's home.
  const routeService = activeService(pathname, search);
  const isHistoryScreen = pathname === '/orders';

  const active =
    activeServiceOverride !== undefined
      ? activeServiceOverride
      : (routeService ?? (isHistoryScreen ? storedService : null));

  const go = (value: ServiceType) => {
    setService(value);
    if (pathname === SERVICE_ROUTES[value]) return;
    if (isHistoryScreen) return;
    router.push(SERVICE_ROUTES[value] as never);
  };

  const getActiveColors = (value: ServiceType) => {
    if (value === 'food') {
      return {
        backgroundColor: '#e64252',
        borderColor: '#e64252',
        shadowColor: '#9B1423',
        iconColor: '#FFFFFF',
        labelColor: '#FFFFFF',
      };
    }
    if (value === 'grocery') {
      /* Dark foreground on the gold pill: white on #f5b921 is ~1.8:1 and was
         unreadable — more so now that the bar itself is white glass. */
      return {
        backgroundColor: '#f5b921',
        borderColor: '#f5b921',
        shadowColor: '#7A5A00',
        iconColor: colors.ink[900],
        labelColor: colors.ink[900],
      };
    }
    if (value === 'rides') {
      return {
        backgroundColor: '#1451e1',
        borderColor: '#1451e1',
        shadowColor: '#14419B',
        iconColor: '#FFFFFF',
        labelColor: '#FFFFFF',
      };
    }
    return {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderColor: 'rgba(255,255,255,0.3)',
      shadowColor: '#000000',
      iconColor: '#FFFFFF',
      labelColor: '#FFFFFF',
    };
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.glass}>
        {(Object.keys(SERVICE_ROUTES) as ServiceType[]).map((value) => {
          const Icon = ICONS[value];
          const isActive = active === value;
          const activeColors = isActive ? getActiveColors(value) : null;

          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Open ${value[0].toUpperCase() + value.slice(1)}`}
              onPress={() => go(value)}
              style={styles.tab}
            >
              {isActive && activeColors ? (
                <View
                  style={[
                    styles.tabActiveContainer,
                    {
                      backgroundColor: activeColors.backgroundColor,
                      borderColor: activeColors.borderColor,
                      shadowColor: activeColors.shadowColor,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.tabActiveTopHighlight} pointerEvents="none" />
                </View>
              ) : null}
              <View style={styles.tabContent}>
                <Icon
                  size={20}
                  strokeWidth={2.1}
                  color={isActive && activeColors ? activeColors.iconColor : colors.neutral[500]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    isActive && styles.labelActive,
                    isActive && activeColors && { color: activeColors.labelColor },
                  ]}
                >
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
    width: '100%',
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'transparent',
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tabActiveContainer: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  tabActiveTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
    maxWidth: '100%',
    zIndex: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '700',
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

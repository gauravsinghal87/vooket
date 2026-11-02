import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Mic, Search } from 'lucide-react-native';
import { useAppStore } from '@/shared/stores/appStore';
import { HERO_THEMES, activeService, serviceTheme, colors } from '@/shared/theme';

interface SearchBarProps {
  /**
   * 'dark' translucent-on-dark, 'brand' solid light on the themed band,
   * 'light' neutral pill, 'food' flat white rounded rectangle with the Food
   * accent outlined icons and a divider before the mic (Food home row).
   */
  variant?: 'dark' | 'brand' | 'light' | 'food';
  onMic?: () => void;
}

export function SearchBar({ variant = 'dark', onMic }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const storedService = useAppStore((s) => s.service);

  // Search stays service-specific per route, falling back to the stored service on `/`.
  const service = activeService(pathname) ?? storedService;
  const theme = serviceTheme(service);
  const light = variant === 'light';
  const brand = variant === 'brand';
  const food = variant === 'food';
  const hero = HERO_THEMES[activeService(pathname) ?? 'neutral'];
  const accent = colors.food[600];

  const goSearch = () => router.push(`/search?type=${service}` as never);

  return (
    <Pressable
      accessibilityLabel={theme.searchPlaceholder}
      onPress={goSearch}
      style={[
        styles.field,
        food ? styles.fieldFood : light ? styles.fieldLight : brand ? styles.fieldBrand : styles.fieldDark,
      ]}
    >
      <Search size={20} color={food ? accent : colors.neutral[400]} style={styles.searchIcon} />
      <Text style={[styles.placeholder, food && styles.placeholderFood]} numberOfLines={1}>
        {theme.searchPlaceholder}
      </Text>
      {food ? <View style={styles.divider} /> : null}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onMic?.();
        }}
        style={[
          styles.mic,
          food
            ? styles.micFood
            : brand
              ? { backgroundColor: hero.searchAccent }
              : light
                ? styles.micLight
                : { backgroundColor: theme.solid },
        ]}
        hitSlop={6}
        accessibilityLabel="Voice search"
      >
        <Mic
          size={food ? 20 : 18}
          color={food ? accent : brand ? hero.activeContrast : light ? colors.neutral[500] : theme.activeText}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 16,
    paddingRight: 6,
    gap: 10,
  },
  fieldFood: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingLeft: 14,
    paddingRight: 6,
    gap: 8,
  },
  fieldLight: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.ink[50],
  },
  fieldBrand: {
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fieldDark: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchIcon: {},  placeholder: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    color: colors.neutral[500],
  },
  placeholderFood: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: colors.neutral[500],
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.neutral[200],
    marginHorizontal: 2,
  },
  mic: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLight: {
    borderRadius: 999,
  },
  micFood: {
    backgroundColor: 'transparent',
  },
});
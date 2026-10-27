import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Minus, Plus, Star } from 'lucide-react-native';
import { colors, withAlpha } from '@/theme';

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={8}>
          <Text style={styles.more}>View all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Primary button                                                      */
/* ------------------------------------------------------------------ */

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  color?: string;
  textColor?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  color = colors.ink[900],
  textColor = '#fff',
  loading,
  icon,
  disabled,
  style,
  ...rest
}: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled || loading ? withAlpha(color, 0.6) : color },
        pressed && !disabled ? { opacity: 0.92 } : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.primaryLabel, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Quantity stepper                                                    */
/* ------------------------------------------------------------------ */

interface StepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  color?: string;
  size?: 'sm' | 'md';
}

export function Stepper({ quantity, onChange, color = colors.ink[900], size = 'md' }: StepperProps) {
  const dim = size === 'sm' ? 30 : 36;
  const icon = size === 'sm' ? 16 : 18;
  return (
    <View style={[styles.stepper, { borderRadius: size === 'sm' ? 12 : 14 }]}>
      <Pressable
        onPress={() => onChange(Math.max(1, quantity - 1))}
        style={[styles.stepBtn, { width: dim, height: dim }]}
        hitSlop={6}
        accessibilityLabel="Decrease quantity"
      >
        <Minus size={icon} color={color} strokeWidth={2.6} />
      </Pressable>
      <Text style={[styles.stepCount, { color }]}>{quantity}</Text>
      <Pressable
        onPress={() => onChange(Math.min(99, quantity + 1))}
        style={[styles.stepBtn, { width: dim, height: dim }]}
        hitSlop={6}
        accessibilityLabel="Increase quantity"
      >
        <Plus size={icon} color={color} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Veg / non-veg mark                                                  */
/* ------------------------------------------------------------------ */

export function VegMark({ isVeg, size = 14, bordered = false }: { isVeg?: boolean | null; size?: number; bordered?: boolean }) {
  const color = isVeg ? colors.success : colors.danger;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        borderWidth: bordered ? 1.4 : 1.8,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size * 0.44, height: size * 0.44, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rating                                                              */
/* ------------------------------------------------------------------ */

export function RatingStars({
  rating,
  count,
  color = colors.success,
  size = 14,
}: {
  rating: string | number | null | undefined;
  count?: number | null;
  color?: string;
  size?: number;
}) {
  const r = rating === null || rating === undefined || rating === '' ? 0 : parseFloat(String(rating));
  const show = !Number.isNaN(r) && r > 0;
  if (!show) return null;
  return (
    <View style={styles.ratingRow}>
      <Star size={size} color={color} fill={color} strokeWidth={0} />
      <Text style={[styles.ratingText, { color }]}>{r.toFixed(1)}</Text>
      {typeof count === 'number' && count > 0 ? (
        <Text style={styles.ratingCount}>({count})</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

export function Pill({
  label,
  color = colors.ink[900],
  textColor = '#fff',
  style,
}: {
  label: string;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color }, style]}>
      <Text style={[styles.pillText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SoftPill({
  label,
  color = colors.ink[900],
  style,
}: {
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.softPill, { backgroundColor: withAlpha(color, 0.1) }, style]}>
      <Text style={[styles.softPillText, { color }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state + loader                                                */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.ink[900]} size="large" />
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */

export function setTitleStyle(title: string): StyleProp<TextStyle> {
  return { color: colors.ink[900], fontSize: 17, fontWeight: '800' } as StyleProp<TextStyle>;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink[900],
  },
  more: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[700],
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  stepBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ratingCount: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  softPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  softPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyAction: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loaderLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
});